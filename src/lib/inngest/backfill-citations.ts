import { inngest } from "./client";
import { createServiceClient } from "@/lib/supabase/server";
import { collectCitations } from "@/lib/sync/citations";

/**
 * Backfills `paper_citations` for already-stored papers.
 *
 * The standard sync pipeline only calls `collectCitations` for *newly
 * inserted* PMIDs (`syncJournalFn` → `storeResult.insertedPmids`). Papers
 * that pre-date the citation collection feature, or that were inserted
 * before being eligible for it, never get their internal edges populated.
 * This is the only reason `internal_citations = 0` in production even
 * though we have ~700 papers in our DB.
 *
 * Trigger event: `admin/citations.backfill` with optional `data.days`
 * (default 90). The function loads recent-N-days PMIDs, runs
 * `collectCitations` over them in chunks of `CHUNK_SIZE`, then dispatches
 * `admin/graph.recompute` so the snapshot picks up the new edges.
 */
const CHUNK_SIZE = 50;
const DEFAULT_DAYS = 90;

export const backfillCitationsFn = inngest.createFunction(
  { id: "citations.backfill", retries: 0, concurrency: 1 },
  { event: "admin/citations.backfill" },
  async ({ event, step }) => {
    const days =
      typeof event.data?.days === "number" && event.data.days > 0
        ? Math.floor(event.data.days)
        : DEFAULT_DAYS;

    const pmids = await step.run("load-pmids", async () => {
      const sb = createServiceClient();
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceIso = since.toISOString().slice(0, 10);

      const all: string[] = [];
      let offset = 0;
      const PAGE = 5000;
      while (true) {
        const { data, error } = await sb
          .from("papers")
          .select("pmid")
          .gte("publication_date", sinceIso)
          .range(offset, offset + PAGE - 1);
        if (error) throw new Error(`load pmids: ${error.message}`);
        if (!data || data.length === 0) break;
        for (const r of data) all.push(r.pmid as string);
        if (data.length < PAGE) break;
        offset += PAGE;
      }
      return all;
    });

    let totalProcessed = 0;
    let totalInserted = 0;
    let totalErrors = 0;

    for (let i = 0; i < pmids.length; i += CHUNK_SIZE) {
      const chunk = pmids.slice(i, i + CHUNK_SIZE);
      const stepName = `collect-${i}-${i + chunk.length}`;
      const chunkResult = await step.run(stepName, async () => {
        const sb = createServiceClient();
        return collectCitations(sb, chunk);
      });
      totalProcessed += chunkResult.processed;
      totalInserted += chunkResult.citationsInserted;
      totalErrors += chunkResult.errors;
    }

    // Recompute snapshots so the UI picks up the new edges without an
    // additional manual trigger.
    await step.sendEvent("trigger-recompute", {
      name: "admin/graph.recompute",
      data: {},
    });

    return {
      days,
      pmidsConsidered: pmids.length,
      totalProcessed,
      totalInserted,
      totalErrors,
    };
  }
);
