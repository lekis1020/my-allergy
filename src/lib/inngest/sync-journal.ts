import { inngest } from "./client";
import { JOURNALS } from "@/lib/constants/journals";
import { fetchPapersForJournal } from "@/lib/sync/fetcher";
import { storePapers } from "@/lib/sync/store";
import { enrichPapersWithCrossRef } from "@/lib/sync/enricher";
import { collectCitations } from "@/lib/sync/citations";
import { embedTexts } from "@/lib/openai/embed";
import { createServiceClient } from "@/lib/supabase/server";
import { getDateRange } from "@/lib/utils/date";
import { generatePaperSummary } from "@/lib/openai/summarize";

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
        const list = unsummarized ?? [];
        for (let i = 0; i < list.length; i++) {
          const paper = list[i];
          const summary = await generatePaperSummary(paper.abstract);
          if (summary) {
            await serviceClient
              .from("papers")
              .update({ ai_summary: summary })
              .eq("pmid", paper.pmid);
            count++;
          }
          // Light throttle between OpenAI calls; generatePaperSummary also
          // retries 429s. OpenAI rate limits are generous, so a short gap
          // is plenty.
          if (i < list.length - 1) {
            await new Promise((r) => setTimeout(r, 250));
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

      // Embed newly inserted papers so the relationship-graph snapshot
      // can pick up their similarity edges on the next recompute.
      // Snapshot refresh is deferred (cron or manual
      // admin/graph.recompute) so 7 parallel journal syncs don't kick
      // off 7 recomputes back-to-back.
      const embedResult = await step.run("embed-new-papers", async () => {
        if (storeResult.insertedPmids.length === 0) {
          return { embedded: 0, short: 0, errors: 0 };
        }

        const { data: rows, error: readErr } = await supabase
          .from("papers")
          .select("pmid, title, abstract")
          .in("pmid", storeResult.insertedPmids);
        if (readErr || !rows || rows.length === 0) {
          return { embedded: 0, short: 0, errors: 0 };
        }

        const texts = rows.map((r) =>
          `${String(r.title ?? "")}\n\n${r.abstract ? String(r.abstract) : ""}`.trim()
        );
        let vectors: (number[] | null)[];
        try {
          vectors = await embedTexts(texts);
        } catch {
          return { embedded: 0, short: 0, errors: rows.length };
        }

        const sb = supabase;

        let embedded = 0;
        let short = 0;
        let errors = 0;
        for (let i = 0; i < rows.length; i++) {
          const vec = vectors[i];
          if (!vec) {
            short += 1;
            continue;
          }
          // The pgvector column is `string | null` in the generated types,
          // but PostgREST accepts (and serializes) a number[] at runtime.
          const { error } = await sb
            .from("papers")
            .update({ embedding: vec as unknown as string })
            .eq("pmid", String(rows[i].pmid));
          if (error) errors += 1;
          else embedded += 1;
        }

        return { embedded, short, errors };
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

      console.log(`[Inngest] Synced ${journal.abbreviation}: ${articles.length} found, ${storeResult.inserted} inserted, enriched ${enrichResult.enriched}, citations ${citationResult.citationsInserted}, embedded ${embedResult.embedded}`);

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
