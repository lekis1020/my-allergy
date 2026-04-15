import { inngest } from "./client";
import { JOURNALS } from "@/lib/constants/journals";
import { fetchPapersForJournal } from "@/lib/sync/fetcher";
import { storePapers } from "@/lib/sync/store";
import { enrichPapersWithCrossRef } from "@/lib/sync/enricher";
import { createServiceClient } from "@/lib/supabase/server";
import { getDateRange } from "@/lib/utils/date";
import { sendJournalAlerts, sendKeywordAlerts } from "@/lib/email/notify";

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

    const syncLogId = await step.run("create-sync-log", async () => {
      const { data, error } = await supabase
        .from("sync_logs")
        .insert({
          journal_id: journalId,
          sync_type: fullSync ? "full" : "incremental",
          status: "running",
          papers_found: 0,
          papers_inserted: 0,
          papers_updated: 0,
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? `Failed to create sync log for ${journalSlug}`);
      }

      return data.id as string;
    });

    try {
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
        await step.run("mark-sync-success-empty", async () => {
          const { error } = await supabase
            .from("sync_logs")
            .update({
              status: "success",
              papers_found: 0,
              papers_inserted: 0,
              papers_updated: 0,
              error_message: null,
              completed_at: new Date().toISOString(),
            })
            .eq("id", syncLogId);

          if (error) {
            throw new Error(error.message);
          }
        });

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

      await step.run("mark-sync-success", async () => {
        const { error } = await supabase
          .from("sync_logs")
          .update({
            status: "success",
            papers_found: articles.length,
            papers_inserted: storeResult.inserted,
            papers_updated: storeResult.updated,
            error_message: null,
            completed_at: new Date().toISOString(),
          })
          .eq("id", syncLogId);

        if (error) {
          throw new Error(error.message);
        }
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
    } catch (error) {
      await step.run("mark-sync-error", async () => {
        const { error: updateError } = await supabase
          .from("sync_logs")
          .update({
            status: "error",
            error_message: error instanceof Error ? error.message : String(error),
            completed_at: new Date().toISOString(),
          })
          .eq("id", syncLogId);

        if (updateError) {
          throw new Error(updateError.message);
        }
      });

      throw error;
    }
  }
);

/**
 * Fans out sync to all journals by emitting per-journal events.
 */
export const syncAllFn = inngest.createFunction(
  { id: "sync-all-journals" },
  { event: "sync/all.requested" },
  async ({ event, step }) => {
    const { fullSync = false, days = 365 } = event.data as {
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

    // Trigger email notifications after a delay to allow journal syncs to complete
    await step.sendEvent("trigger-notifications", [
      {
        name: "sync/notifications.requested" as const,
        data: { journalCount: JOURNALS.length },
      },
    ]);

    return {
      message: `Dispatched sync for ${JOURNALS.length} journals`,
      journalCount: JOURNALS.length,
      fullSync,
      days,
    };
  }
);

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

/**
 * Background CrossRef enrichment triggered after on-demand PubMed fetch.
 */
export const onDemandEnrichFn = inngest.createFunction(
  { id: "on-demand-enrich", retries: 2 },
  { event: "pubmed/on-demand.enrich.requested" },
  async ({ step }) => {
    const enrichResult = await step.run("on-demand-crossref", async () => {
      const supabase = createServiceClient();
      return enrichPapersWithCrossRef(supabase, 50);
    });
    return enrichResult;
  },
);

/**
 * Sends email notifications after sync completes.
 * Queries papers inserted in the last N hours (default 25h for daily sync + buffer).
 */
export const sendNotificationsFn = inngest.createFunction(
  { id: "send-notifications", retries: 2 },
  { event: "sync/notifications.requested" },
  async ({ step }) => {
    // Wait 10 minutes for journal syncs to complete
    await step.sleep("wait-for-syncs", "10m");

    const newPapers = await step.run("fetch-new-papers", async () => {
      const supabase = createServiceClient();
      const notificationLookbackHours = Number(process.env.NOTIFICATION_LOOKBACK_HOURS ?? "25");
      const lookbackHours = Number.isFinite(notificationLookbackHours) && notificationLookbackHours > 0
        ? notificationLookbackHours
        : 25;
      const lookbackTime = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();

      const { data: papers } = await supabase
        .from("papers")
        .select(
          "pmid, title, journal_id, journals!inner(slug, name), paper_authors(last_name, initials, position)",
        )
        .gte("created_at", lookbackTime)
        .order("created_at", { ascending: false })
        .limit(500);

      if (!papers || papers.length === 0) return [];

      return papers.map((p: Record<string, unknown>) => {
        const journal = p.journals as Record<string, unknown>;
        const authors = (
          p.paper_authors as Array<{
            last_name: string;
            initials: string;
            position: number;
          }>
        )
          .sort((a, b) => a.position - b.position)
          .slice(0, 3)
          .map((a) => `${a.last_name} ${a.initials}`)
          .join(", ");

        return {
          pmid: p.pmid as string,
          title: p.title as string,
          journal_slug: journal.slug as string,
          journal_name: journal.name as string,
          authors: authors + ((p.paper_authors as unknown[]).length > 3 ? " et al." : ""),
        };
      });
    });

    if (newPapers.length === 0) {
      return { message: "No new papers found", journalAlerts: 0, keywordAlerts: 0 };
    }

    // Send journal subscription alerts
    const journalResult = await step.run("send-journal-alerts", async () => {
      return sendJournalAlerts(newPapers);
    });

    // Send keyword alerts
    const keywordResult = await step.run("send-keyword-alerts", async () => {
      return sendKeywordAlerts(newPapers);
    });

    console.log(
      `[Notifications] Journal alerts: ${journalResult.sent} sent, ${journalResult.errors} errors. Keyword alerts: ${keywordResult.sent} sent, ${keywordResult.errors} errors.`,
    );

    return {
      message: `Processed ${newPapers.length} new papers`,
      journalAlerts: journalResult,
      keywordAlerts: keywordResult,
    };
  },
);
