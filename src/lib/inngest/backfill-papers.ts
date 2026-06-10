import { inngest } from "./client";
import { JOURNALS } from "@/lib/constants/journals";
import { fetchPapersForJournal } from "@/lib/sync/fetcher";
import { storePapers } from "@/lib/sync/store";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Backfills a single journal over a specific date range (e.g., 6~12 months).
 * Intended as a one-shot job to extend the storage window from 6 → 12 months.
 */
export const backfillJournalFn = inngest.createFunction(
  { id: "backfill-journal", retries: 2, concurrency: { limit: 2 } },
  { event: "sync/backfill.requested" },
  async ({ event, step }) => {
    const { journalSlug, mindate, maxdate } = event.data as {
      journalSlug: string;
      mindate: string;
      maxdate: string;
    };

    const journal = JOURNALS.find((j) => j.slug === journalSlug);
    if (!journal) {
      throw new Error(`Journal not found: ${journalSlug}`);
    }

    const supabase = createServiceClient();

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

    const articles = await step.run("backfill-fetch", async () => {
      return fetchPapersForJournal(journal, { mindate, maxdate });
    });

    if (articles.length === 0) {
      return { journal: journal.abbreviation, found: 0, inserted: 0, updated: 0 };
    }

    const storeResult = await step.run("backfill-store", async () => {
      return storePapers(supabase, journalId, articles);
    });

    console.log(
      `[Inngest][Backfill] ${journal.abbreviation} ${mindate}→${maxdate}: ${articles.length} found, ${storeResult.inserted} inserted`,
    );

    return {
      journal: journal.abbreviation,
      mindate,
      maxdate,
      found: articles.length,
      inserted: storeResult.inserted,
      updated: storeResult.updated,
    };
  },
);

/**
 * Fans out backfill requests for the 6→12 month gap across all journals.
 */
export const backfillAllFn = inngest.createFunction(
  { id: "backfill-all-journals" },
  { event: "sync/backfill-all.requested" },
  async ({ event, step }) => {
    const { mindate, maxdate } = event.data as {
      mindate: string;
      maxdate: string;
    };

    const events = JOURNALS.map((journal) => ({
      name: "sync/backfill.requested" as const,
      data: { journalSlug: journal.slug, mindate, maxdate },
    }));

    await step.sendEvent("fan-out-backfill", events);

    return {
      message: `Dispatched backfill for ${JOURNALS.length} journals`,
      journalCount: JOURNALS.length,
      mindate,
      maxdate,
    };
  },
);
