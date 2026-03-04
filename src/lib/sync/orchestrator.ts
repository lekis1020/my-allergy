import type { SupabaseClient } from "@supabase/supabase-js";
import { JOURNALS } from "@/lib/constants/journals";
import { fetchPapersForJournal } from "./fetcher";
import { storePapers } from "./store";
import { enrichPapersWithCrossRef } from "./enricher";
import { getDateRange } from "@/lib/utils/date";

interface SyncResult {
  journal: string;
  found: number;
  inserted: number;
  updated: number;
  errors: number;
}

export async function syncAllJournals(
  supabase: SupabaseClient,
  options: { days?: number; fullSync?: boolean } = {}
): Promise<SyncResult[]> {
  const { days = 30, fullSync = false } = options;
  const results: SyncResult[] = [];

  // Clean up stale sync logs stuck in "running" for over 10 minutes
  await supabase
    .from("sync_logs")
    .update({
      status: "error",
      error_message: "Timed out (stale lock)",
      completed_at: new Date().toISOString(),
    })
    .eq("status", "running")
    .lt("started_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());

  // Prevent concurrent syncs by checking for running sync logs
  const { data: runningSyncs } = await supabase
    .from("sync_logs")
    .select("id")
    .eq("status", "running")
    .limit(1);

  if (runningSyncs && runningSyncs.length > 0) {
    throw new Error("A sync is already in progress");
  }

  const { data: dbJournals } = await supabase
    .from("journals")
    .select("id, slug");

  if (!dbJournals) {
    throw new Error("Failed to fetch journals from database");
  }

  const journalMap = new Map(dbJournals.map((j) => [j.slug, j.id]));

  const dateRange = fullSync
    ? { from: "2020/01/01", to: getDateRange(0).to }
    : getDateRange(days);

  for (const journal of JOURNALS) {
    const journalId = journalMap.get(journal.slug);
    if (!journalId) {
      console.warn(`Journal ${journal.slug} not found in database, skipping`);
      continue;
    }

    const syncLogData = {
      journal_id: journalId,
      sync_type: fullSync ? "full" : "incremental",
      status: "running",
      papers_found: 0,
      papers_inserted: 0,
      papers_updated: 0,
      started_at: new Date().toISOString(),
    };

    const { data: syncLog } = await supabase
      .from("sync_logs")
      .insert(syncLogData)
      .select("id")
      .single();

    try {
      const articles = await fetchPapersForJournal(journal, {
        mindate: dateRange.from,
        maxdate: dateRange.to,
      });

      const storeResult = await storePapers(supabase, journalId, articles);

      const result: SyncResult = {
        journal: journal.abbreviation,
        found: articles.length,
        inserted: storeResult.inserted,
        updated: storeResult.updated,
        errors: storeResult.errors,
      };

      results.push(result);

      if (syncLog) {
        await supabase
          .from("sync_logs")
          .update({
            status: "success",
            papers_found: articles.length,
            papers_inserted: storeResult.inserted,
            papers_updated: storeResult.updated,
            completed_at: new Date().toISOString(),
          })
          .eq("id", syncLog.id);
      }
    } catch (error) {
      console.error(`Sync failed for ${journal.abbreviation}:`, error);

      if (syncLog) {
        await supabase
          .from("sync_logs")
          .update({
            status: "error",
            error_message: error instanceof Error ? error.message : String(error),
            completed_at: new Date().toISOString(),
          })
          .eq("id", syncLog.id);
      }

      results.push({
        journal: journal.abbreviation,
        found: 0,
        inserted: 0,
        updated: 0,
        errors: 1,
      });
    }
  }

  // Enrich with CrossRef data
  console.log("[Orchestrator] Enriching papers with CrossRef data...");
  const enrichResult = await enrichPapersWithCrossRef(supabase, 100);
  console.log(`[Orchestrator] Enriched ${enrichResult.enriched} papers`);

  return results;
}
