import { inngest } from "./client";
import { createServiceClient } from "@/lib/supabase/server";
import {
  buildGraphSnapshots,
  type SourceData,
  type SourceAuthor,
  type SourceSimilarity,
} from "@/lib/graph/build-snapshots";
import type { GalaxySnapshot, TopicSnapshot } from "@/lib/graph/types";
import type { Json } from "@/types/supabase";

/**
 * Recomputes the DB-wide relationship-graph snapshots.
 *
 * Phase 1 ships with an event-only trigger so the operator can run it
 * controlled before flipping on the daily cron in Phase 3. The cron will
 * eventually be added alongside the event:
 *
 *   [{ event: "admin/graph.recompute" }, { cron: "TZ=UTC 0 18 * * *" }]
 *
 * The function is intentionally split into three named steps so Inngest's
 * step memoization caches intermediate output across retries.
 *
 * Note: Inngest serializes step return values as JSON, so Map objects do not
 * survive step boundaries. build-snapshots and write-snapshots are therefore
 * combined into a single "build-and-write" step. The final return value uses
 * counts captured inside that step.
 */
export const recomputeGraphFn = inngest.createFunction(
  { id: "relationship-graph.recompute", retries: 2 },
  [{ event: "admin/graph.recompute" }, { cron: "TZ=UTC 0 18 * * *" }],
  async ({ step }) => {
    const sourceData = await step.run("fetch-source-data", async () => {
      return await fetchSourceData();
    });

    const result = await step.run("build-and-write", async () => {
      const snapshots = buildGraphSnapshots(sourceData);
      const writtenRows = await writeSnapshots(snapshots.galaxy, snapshots.topics);
      return {
        topicCount: snapshots.topics.size,
        galaxyNodes: snapshots.galaxy.nodes.length,
        galaxyEdges: snapshots.galaxy.edges.length,
        writtenRows,
      };
    });

    return result;
  }
);

async function fetchSourceData(): Promise<SourceData> {
  const sb = createServiceClient();

  // Papers — title + abstract for topic classification, plus the fields the
  // snapshot needs at render time.
  const { data: papers, error: papersErr } = await sb
    .from("papers")
    .select("pmid, title, abstract, publication_date, epub_date, citation_count, journal_id");
  if (papersErr) throw new Error(`fetch papers: ${papersErr.message}`);

  const { data: citations, error: citErr } = await sb
    .from("paper_citations")
    .select("source_pmid, target_pmid");
  if (citErr) throw new Error(`fetch citations: ${citErr.message}`);

  const { data: mentions, error: menErr } = await sb
    .from("paper_mentions")
    .select("source_pmid, mentioned_pmid");
  if (menErr) throw new Error(`fetch mentions: ${menErr.message}`);

  const { data: journals, error: jErr } = await sb
    .from("journals")
    .select("id, abbreviation, color");
  if (jErr) throw new Error(`fetch journals: ${jErr.message}`);

  // Authors — first author rows (position = 1) and last-author rows
  // (position = MAX(position) per paper). We compute the max-position map
  // in JS rather than SQL because Supabase's PostgREST does not expose the
  // grouping aggregate cleanly.
  const { data: allAuthorRows, error: aErr } = await sb
    .from("paper_authors")
    .select("paper_id, last_name, first_name, initials, position, papers!inner(pmid)");
  if (aErr) throw new Error(`fetch authors: ${aErr.message}`);

  type Row = {
    paper_id: string;
    last_name: string;
    first_name: string | null;
    initials: string | null;
    position: number;
    papers: { pmid: string };
  };

  const rows: Row[] = allAuthorRows ?? [];

  const maxPosByPaper = new Map<string, number>();
  for (const r of rows) {
    const cur = maxPosByPaper.get(r.paper_id) ?? 0;
    if (r.position > cur) maxPosByPaper.set(r.paper_id, r.position);
  }

  const authors: SourceAuthor[] = [];
  for (const r of rows) {
    const isLast = r.position === maxPosByPaper.get(r.paper_id);
    if (r.position !== 1 && !isLast) continue;
    authors.push({
      pmid: r.papers.pmid,
      last_name: r.last_name,
      first_name: r.first_name,
      initials: r.initials,
      position: r.position,
      is_last: isLast,
    });
  }

  const similarities = await fetchSimilarities(sb);

  return {
    papers: papers ?? [],
    citations: citations ?? [],
    mentions: mentions ?? [],
    journals: journals ?? [],
    authors,
    similarities,
  };
}

/**
 * Loads embedding-based similarity edges via the
 * `paper_similarity_edges_topk` RPC. Returns an empty array (no
 * similarity edges contributed this run) if pgvector is unavailable, the
 * RPC is missing, or no rows have embeddings yet — none of these
 * conditions are fatal.
 */
const SIMILARITY_K = 8;
const SIMILARITY_THRESHOLD = 0.55;

async function fetchSimilarities(
  sb: ReturnType<typeof createServiceClient>
): Promise<SourceSimilarity[]> {
  const { data, error } = await sb.rpc("paper_similarity_edges_topk", {
    p_k: SIMILARITY_K,
    p_threshold: SIMILARITY_THRESHOLD,
  });
  if (error) {
    console.warn(`[recompute-graph] similarity rpc skipped: ${error.message}`);
    return [];
  }
  return (data ?? []).map((r) => ({
    source_pmid: String(r.source_pmid),
    target_pmid: String(r.target_pmid),
    similarity: Number(r.similarity),
  }));
}

type SnapshotRow = {
  scope: string;
  payload: Json;
  node_count: number;
  edge_count: number;
};

async function writeSnapshots(
  galaxy: GalaxySnapshot,
  topics: Map<string, TopicSnapshot>
): Promise<number> {
  const sb = createServiceClient();

  const rows: SnapshotRow[] = [
    {
      scope: "galaxy",
      payload: galaxy as unknown as Json,
      node_count: galaxy.nodes.length,
      edge_count: galaxy.edges.length,
    },
    ...[...topics.entries()].map(([slug, snap]) => ({
      scope: `topic:${slug}`,
      payload: snap as unknown as Json,
      node_count: snap.nodes.length,
      edge_count: snap.edges.length,
    })),
  ];

  const { error } = await sb
    .from("paper_graph_snapshots")
    .upsert(rows, { onConflict: "scope" });
  if (error) throw new Error(`upsert snapshots: ${error.message}`);
  return rows.length;
}
