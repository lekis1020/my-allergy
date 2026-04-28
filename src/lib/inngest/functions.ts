import { inngest } from "./client";
import { JOURNALS } from "@/lib/constants/journals";
import { fetchPapersForJournal } from "@/lib/sync/fetcher";
import { storePapers } from "@/lib/sync/store";
import { enrichPapersWithCrossRef } from "@/lib/sync/enricher";
import { collectCitations } from "@/lib/sync/citations";
import { createServiceClient } from "@/lib/supabase/server";
import { getDateRange } from "@/lib/utils/date";
import { generatePaperSummary } from "@/lib/gemini/summarize";
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

      // Generate AI summaries for papers without one
      const summarized = await step.run("generate-ai-summaries", async () => {
        const serviceClient = createServiceClient();
        const { data: unsummarized } = await serviceClient
          .from("papers")
          .select("pmid, abstract")
          .eq("journal_id", journalId)
          .is("ai_summary", null)
          .not("abstract", "is", null)
          .order("publication_date", { ascending: false })
          .limit(20);

        let count = 0;
        for (const paper of unsummarized ?? []) {
          const summary = await generatePaperSummary(paper.abstract);
          if (summary) {
            await serviceClient
              .from("papers")
              .update({ ai_summary: summary })
              .eq("pmid", paper.pmid);
            count++;
          }
        }
        return count;
      });

      // Collect citation relationships for newly inserted papers
      const citationResult = await step.run("collect-citations", async () => {
        if (storeResult.insertedPmids.length === 0) {
          return { processed: 0, citationsInserted: 0, errors: 0 };
        }
        return collectCitations(supabase, storeResult.insertedPmids);
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

      console.log(`[Inngest] Synced ${journal.abbreviation}: ${articles.length} found, ${storeResult.inserted} inserted, enriched ${enrichResult.enriched}, citations ${citationResult.citationsInserted}`);

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
 * Daily cron job that generates trending analysis using Gemini.
 * Runs at 06:00 UTC every day.
 */
export const generateTrendingAnalysisFn = inngest.createFunction(
  { id: "generate-trending-analysis", retries: 2 },
  { cron: "0 6 * * *" },
  async ({ step }) => {
    const stats = await step.run("collect-stats", async () => {
      const supabase = createServiceClient();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: papers } = await supabase
        .from("papers")
        .select("keywords, publication_date")
        .gte("publication_date", thirtyDaysAgo.toISOString().split("T")[0]);

      const topicCounts = new Map<string, number>();
      for (const p of papers ?? []) {
        for (const tag of (p.keywords as string[]) ?? []) {
          topicCounts.set(tag, (topicCounts.get(tag) ?? 0) + 1);
        }
      }

      const topTopics = Array.from(topicCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return { totalPapers: papers?.length ?? 0, topTopics };
    });

    const aiSummary = await step.run("generate-analysis", async () => {
      const { getGeminiClient } = await import("@/lib/gemini/client");
      const client = getGeminiClient();
      const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `다음은 알레르기/임상면역학 분야 최근 30일간 논문 통계입니다:

총 논문 수: ${stats.totalPapers}편
토픽별 분포: ${stats.topTopics.map((t) => `${t.name}(${t.count}편)`).join(", ")}

이 데이터를 바탕으로 한국어로 2~3문단의 연구 동향 분석을 작성하세요.
주요 토픽별 연구 동향, 주목할 만한 변화, 새로운 연구 방향을 포함하세요.
마크다운 서식 없이 일반 텍스트로 작성하세요.`;

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      return result.response.text()?.trim() ?? "";
    });

    await step.run("save-analysis", async () => {
      const supabase = createServiceClient();
      const today = new Date().toISOString().split("T")[0];

      await supabase.from("trending_analysis").upsert(
        { date: today, ai_summary: aiSummary, stats_json: stats },
        { onConflict: "date" }
      );
    });

    return { date: new Date().toISOString().split("T")[0], stats };
  }
);

