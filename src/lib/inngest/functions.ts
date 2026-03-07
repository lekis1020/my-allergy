import { inngest } from "./client";
import { JOURNALS } from "@/lib/constants/journals";
import { fetchPapersForJournal } from "@/lib/sync/fetcher";
import { storePapers } from "@/lib/sync/store";
import { enrichPapersWithCrossRef } from "@/lib/sync/enricher";
import { createServiceClient } from "@/lib/supabase/server";
import { getDateRange } from "@/lib/utils/date";

/**
 * Syncs a single journal: fetch from PubMed, store, then enrich with CrossRef.
 */
export const syncJournalFn = inngest.createFunction(
  { id: "sync-journal", retries: 3 },
  { event: "sync/journal.requested" },
  async ({ event, step }) => {
    const { journalSlug, fullSync, days } = event.data as {
      journalSlug: string;
      fullSync: boolean;
      days: number;
    };

    const journal = JOURNALS.find((j) => j.slug === journalSlug);
    if (!journal) {
      throw new Error(`Journal not found: ${journalSlug}`);
    }

    const supabase = createServiceClient();

    // Resolve journal DB id
    const journalId = await step.run("resolve-journal-id", async () => {
      const { data } = await supabase
        .from("journals")
        .select("id")
        .eq("slug", journalSlug)
        .single();

      if (!data) {
        throw new Error(`Journal ${journalSlug} not found in database`);
      }
      return data.id as string;
    });

    // Fetch papers from PubMed
    const articles = await step.run("fetch-papers", async () => {
      const dateRange = fullSync
        ? { from: "2020/01/01", to: getDateRange(0).to }
        : getDateRange(days);

      return fetchPapersForJournal(journal, {
        mindate: dateRange.from,
        maxdate: dateRange.to,
      });
    });

    if (articles.length === 0) {
      return { journal: journal.abbreviation, found: 0, inserted: 0, updated: 0, errors: 0 };
    }

    // Store papers in Supabase
    const storeResult = await step.run("store-papers", async () => {
      return storePapers(supabase, journalId, articles);
    });

    // Enrich with CrossRef data
    const enrichResult = await step.run("enrich-crossref", async () => {
      return enrichPapersWithCrossRef(supabase, 100);
    });

    console.log(`[Inngest] Synced ${journal.abbreviation}: ${articles.length} found, ${storeResult.inserted} inserted, enriched ${enrichResult.enriched}`);

    return {
      journal: journal.abbreviation,
      found: articles.length,
      inserted: storeResult.inserted,
      updated: storeResult.updated,
      errors: storeResult.errors,
      enriched: enrichResult.enriched,
    };
  }
);

/**
 * Fans out sync to all journals by emitting per-journal events.
 */
export const syncAllFn = inngest.createFunction(
  { id: "sync-all-journals" },
  { event: "sync/all.requested" },
  async ({ event, step }) => {
    const { fullSync = false, days = 180 } = event.data as {
      fullSync?: boolean;
      days?: number;
    };

    const supabase = createServiceClient();

    // Clean up stale sync logs and check for running syncs
    await step.run("check-sync-lock", async () => {
      await supabase
        .from("sync_logs")
        .update({
          status: "error",
          error_message: "Timed out (stale lock)",
          completed_at: new Date().toISOString(),
        })
        .eq("status", "running")
        .lt("started_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());

      const { data: runningSyncs } = await supabase
        .from("sync_logs")
        .select("id")
        .eq("status", "running")
        .limit(1);

      if (runningSyncs && runningSyncs.length > 0) {
        throw new Error("A sync is already in progress");
      }
    });

    // Fan out: send one event per journal
    const events = JOURNALS.map((journal) => ({
      name: "sync/journal.requested" as const,
      data: { journalSlug: journal.slug, fullSync, days },
    }));

    await step.sendEvent("fan-out-journals", events);

    return {
      message: `Dispatched sync for ${JOURNALS.length} journals`,
      journalCount: JOURNALS.length,
      fullSync,
      days,
    };
  }
);
