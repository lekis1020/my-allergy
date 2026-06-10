import { inngest } from "./client";
import { createServiceClient } from "@/lib/supabase/server";
import { embedTexts } from "@/lib/openai/embed";

/**
 * Generates `papers.embedding` for every row where it is currently NULL.
 *
 * `text-embedding-3-small` is cheap (~$0.02 per 1M tokens) so we
 * intentionally embed `title + abstract` directly — no truncation games,
 * no caching layer. The OpenAI API accepts batched inputs and the cost is
 * the same per token whether single or batched, but batching saves
 * round-trips significantly.
 *
 * Trigger event: `admin/embed.backfill` with optional `data.limit`
 * (default = no limit, process everything).
 *
 * After completion we dispatch `admin/graph.recompute` so the snapshot
 * picks up the new similarity edges in the same pipeline run.
 */
const CHUNK_SIZE = 64;

export const embedPapersFn = inngest.createFunction(
  { id: "papers.embed-backfill", retries: 0, concurrency: 1 },
  { event: "admin/embed.backfill" },
  async ({ event, step }) => {
    const limit =
      typeof event.data?.limit === "number" && event.data.limit > 0
        ? Math.floor(event.data.limit)
        : null;

    const pmidsToEmbed = await step.run("load-targets", async () => {
      const sb = createServiceClient();
      const cap = limit ?? 10000;
      const { data, error } = await sb
        .from("papers")
        .select("pmid, title, abstract")
        .is("embedding", null)
        .limit(cap);
      if (error) throw new Error(`load embed targets: ${error.message}`);
      return (data ?? []).map((r) => ({
        pmid: String(r.pmid),
        title: String(r.title ?? ""),
        abstract: r.abstract ? String(r.abstract) : "",
      }));
    });

    let totalEmbedded = 0;
    let totalSkippedShort = 0;
    let totalErrors = 0;

    for (let i = 0; i < pmidsToEmbed.length; i += CHUNK_SIZE) {
      const chunk = pmidsToEmbed.slice(i, i + CHUNK_SIZE);
      const stepName = `embed-${i}-${i + chunk.length}`;
      const chunkResult = await step.run(stepName, async () => {
        const texts = chunk.map((p) => {
          const abs = p.abstract || "";
          return `${p.title}\n\n${abs}`.trim();
        });

        let vectors: (number[] | null)[];
        try {
          vectors = await embedTexts(texts);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { embedded: 0, short: 0, errors: chunk.length, error: msg };
        }

        const updates: Array<{ pmid: string; vec: number[] }> = [];
        let short = 0;
        vectors.forEach((vec, idx) => {
          if (vec) updates.push({ pmid: chunk[idx].pmid, vec });
          else short += 1;
        });

        // Supabase does not support upserting vector columns in bulk
        // through PostgREST batch, so we issue one UPDATE per row. With
        // CHUNK_SIZE=64 and ~5ms latency each, this is ~300ms per chunk.
        const sb = createServiceClient();
        let errors = 0;
        for (const u of updates) {
          // The pgvector column is `string | null` in the generated types,
          // but PostgREST accepts (and serializes) a number[] at runtime.
          const { error } = await sb
            .from("papers")
            .update({ embedding: u.vec as unknown as string })
            .eq("pmid", u.pmid);
          if (error) errors += 1;
        }

        return { embedded: updates.length - errors, short, errors };
      });

      totalEmbedded += chunkResult.embedded;
      totalSkippedShort += chunkResult.short;
      totalErrors += chunkResult.errors;
    }

    if (totalEmbedded > 0) {
      await step.sendEvent("trigger-recompute", {
        name: "admin/graph.recompute",
        data: {},
      });
    }

    return {
      considered: pmidsToEmbed.length,
      totalEmbedded,
      totalSkippedShort,
      totalErrors,
    };
  }
);
