import { inngest } from "./client";
import { createServiceClient } from "@/lib/supabase/server";
import {
  buildGraphSnapshots,
  type SourceData,
  type SourcePaper,
  type SourceAuthor,
  type SourceSimilarity,
} from "@/lib/graph/build-snapshots";
import type { GalaxySnapshot, TopicSnapshot } from "@/lib/graph/types";
import type { Json } from "@/types/supabase";

/**
 * Recomputes the DB-wide relationship-graph snapshots.
 *
 * Triggered daily by cron (03:00 KST) and on demand via the
 * `admin/graph.recompute` event.
 *
 * IMPORTANT — single-step design: fetch, build, and write all run inside ONE
 * step. The full source dataset (papers + abstracts + author rows) is tens of
 * MB at the current corpus size and MUST NOT cross an Inngest step boundary —
 * step output is capped (~4MB) and a previous split-step design serialized the
 * whole `SourceData` as a step return value, which silently failed on every
 * run once the corpus grew past the limit (snapshot froze 2026-06-02). The
 * step now returns only small counts. See fetchSourceData for the matching
 * keyset/range pagination that avoids the Postgres statement-timeout on the
 * unbounded `papers`/`paper_authors` reads.
 */
export const recomputeGraphFn = inngest.createFunction(
  { id: "relationship-graph.recompute", retries: 2 },
  [{ event: "admin/graph.recompute" }, { cron: "TZ=UTC 0 18 * * *" }],
  async ({ step }) => {
    const result = await step.run("fetch-build-write", async () => {
      const sourceData = await fetchSourceData();
      const snapshots = buildGraphSnapshots(sourceData);
      const writtenRows = await writeSnapshots(snapshots.galaxy, snapshots.topics);
      return {
        papers: sourceData.papers.length,
        authors: sourceData.authors.length,
        topicCount: snapshots.topics.size,
        galaxyNodes: snapshots.galaxy.nodes.length,
        galaxyEdges: snapshots.galaxy.edges.length,
        writtenRows,
      };
    });

    return result;
  }
);

/**
 * Pages through a table using keyset (seek) pagination on a unique, ordered
 * column. Unlike OFFSET/range pagination this never scans-and-discards rows,
 * so a wide table (e.g. `papers` with abstracts) does not blow the Postgres
 * statement timeout at deep offsets, and it cannot silently truncate at
 * PostgREST's row cap.
 */
const PAGE_SIZE = 1000;

async function paginateKeyset<T>(
  label: string,
  keyOf: (row: T) => string,
  makeQuery: (after: string | null) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>
): Promise<T[]> {
  const out: T[] = [];
  let after: string | null = null;
  for (;;) {
    const { data, error } = await makeQuery(after);
    if (error) throw new Error(`fetch ${label}: ${error.message}`);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    after = keyOf(rows[rows.length - 1]);
  }
  return out;
}

async function fetchSourceData(): Promise<SourceData> {
  const sb = createServiceClient();

  // Papers — lightweight columns only. Topic classification is read from the
  // persisted `topic_tags` column (populated at sync time + backfill), NOT by
  // re-fetching abstracts: an unbounded select of the full corpus with
  // abstracts (~27MB) timed out the Postgres statement and froze the snapshot.
  // Keyset-paginated on `pmid` to avoid the PostgREST row cap.
  const papers = await paginateKeyset<SourcePaper>(
    "papers",
    (r) => r.pmid,
    (after) => {
      let q = sb
        .from("papers")
        .select("pmid, title, topic_tags, publication_date, epub_date, citation_count, journal_id")
        .order("pmid", { ascending: true })
        .limit(PAGE_SIZE);
      if (after !== null) q = q.gt("pmid", after);
      return q as unknown as PromiseLike<{ data: SourcePaper[] | null; error: { message: string } | null }>;
    }
  );

  // Citations — narrow join table, no single-column key, so range-paginate
  // on a deterministic order. Small today but future-proofed against the
  // PostgREST row cap.
  const citations: { source_pmid: string; target_pmid: string }[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await sb
      .from("paper_citations")
      .select("source_pmid, target_pmid")
      .order("source_pmid", { ascending: true })
      .order("target_pmid", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`fetch citations: ${error.message}`);
    const rows = data ?? [];
    citations.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }

  const mentions = await paginateKeyset<{
    id: string;
    source_pmid: string;
    mentioned_pmid: string;
  }>(
    "mentions",
    (r) => r.id,
    (after) => {
      let q = sb
        .from("paper_mentions")
        .select("id, source_pmid, mentioned_pmid")
        .order("id", { ascending: true })
        .limit(PAGE_SIZE);
      if (after !== null) q = q.gt("id", after);
      return q;
    }
  );

  const { data: journals, error: jErr } = await sb
    .from("journals")
    .select("id, abbreviation, color");
  if (jErr) throw new Error(`fetch journals: ${jErr.message}`);

  // Authors — first author rows (position = 1) and last-author rows
  // (position = MAX(position) per paper). We compute the max-position map
  // in JS rather than SQL because Supabase's PostgREST does not expose the
  // grouping aggregate cleanly. Keyset-paginated on the `id` PK (38k+ rows).
  type Row = {
    id: string;
    paper_id: string;
    last_name: string;
    first_name: string | null;
    initials: string | null;
    position: number;
    papers: { pmid: string };
  };

  const rows = await paginateKeyset<Row>(
    "authors",
    (r) => r.id,
    (after) => {
      let q = sb
        .from("paper_authors")
        .select("id, paper_id, last_name, first_name, initials, position, papers!inner(pmid)")
        .order("id", { ascending: true })
        .limit(PAGE_SIZE);
      if (after !== null) q = q.gt("id", after);
      return q as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>;
    }
  );

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
