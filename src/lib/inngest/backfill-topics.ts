import { inngest } from "./client";
import { createServiceClient } from "@/lib/supabase/server";
import { classifyPaperTopics } from "@/lib/utils/topic-tags";

/**
 * One-time (and idempotent) backfill of `papers.topic_tags` for rows that
 * predate migration 00045. New rows get classified at sync time in
 * src/lib/sync/store.ts; this fills in the historical corpus.
 *
 * Each batch reads a SMALL page of unclassified rows (title + abstract +
 * keywords + MeSH) inside its own step, so we never repeat the unbounded
 * full-corpus abstract scan that was timing out the recompute. Steps are
 * memoized across retries, so a transient statement timeout resumes rather
 * than restarting.
 *
 * The loop re-queries `topic_tags IS NULL` each batch instead of paginating by
 * cursor: rows leave the filter as they are updated, so "the next N null rows"
 * naturally advances and terminates when none remain.
 *
 * Trigger event: `admin/topics.backfill`. On completion (if anything was
 * classified) it dispatches `admin/graph.recompute` so the snapshot picks up
 * the freshly classified corpus.
 */
const BATCH_SIZE = 200;
const MAX_BATCHES = 250; // safety stop: 250 * 200 = 50k rows

export const backfillTopicsFn = inngest.createFunction(
  { id: "papers.backfill-topics", retries: 3, concurrency: 1 },
  { event: "admin/topics.backfill" },
  async ({ step }) => {
    let totalClassified = 0;
    let batchesRun = 0;

    for (let page = 0; page < MAX_BATCHES; page++) {
      const { fetched, updated } = await step.run(`classify-page-${page}`, async () => {
        const sb = createServiceClient();
        const { data, error } = await sb
          .from("papers")
          .select("pmid, title, abstract, keywords, mesh_terms")
          .is("topic_tags", null)
          .order("pmid", { ascending: true })
          .limit(BATCH_SIZE);
        if (error) throw new Error(`load unclassified: ${error.message}`);

        const rows = data ?? [];
        let updated = 0;
        for (const r of rows) {
          const tags = classifyPaperTopics({
            title: r.title,
            abstract: r.abstract,
            keywords: r.keywords ?? [],
            meshTerms: r.mesh_terms ?? [],
          });
          const { error: upErr } = await sb
            .from("papers")
            .update({ topic_tags: tags })
            .eq("pmid", r.pmid);
          if (!upErr) updated += 1;
        }
        return { fetched: rows.length, updated };
      });

      batchesRun += 1;
      totalClassified += updated;
      // Fewer rows fetched than a full batch means the unclassified pool is
      // drained. (Terminate on rows fetched, not rows updated, so a failed
      // update does not end the run early and orphan NULL rows.)
      if (fetched < BATCH_SIZE) break;
    }

    if (totalClassified > 0) {
      await step.sendEvent("trigger-recompute", {
        name: "admin/graph.recompute",
        data: {},
      });
    }

    return { totalClassified, batchesRun };
  }
);
