import type { SupabaseClient } from "@supabase/supabase-js";
import type { PubMedArticle } from "@/lib/pubmed/types";
import { classifyPaperTopics } from "@/lib/utils/topic-tags";

export interface StoreResult {
  inserted: number;
  updated: number;
  unchanged: number;
  errors: number;
  insertedPmids: string[];
}

const BATCH_SIZE = 100;

/**
 * The PubMed-derived fields that make up a paper's content. If every one of
 * these already matches what we have stored, re-writing the row is pure write
 * amplification: even a no-op UPDATE produces a dead tuple, WAL, and index
 * maintenance. The daily cron re-syncs a wide date window (CRON_SYNC_DAYS), so
 * the overwhelming majority of rows it sees are byte-identical to what is
 * already stored — skipping those is the single biggest Disk IO reduction on
 * the sync path.
 */
export interface ComparablePaper {
  title: string;
  abstract: string | null;
  doi: string | null;
  publication_date: string;
  epub_date: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  keywords: string[] | null;
  mesh_terms: string[] | null;
  publication_types: string[] | null;
  topic_tags: string[] | null;
}

// Columns selected from the existing row for the unchanged-comparison. Kept in
// sync with ComparablePaper.
const COMPARE_COLUMNS =
  "pmid, title, abstract, doi, publication_date, epub_date, volume, issue, pages, keywords, mesh_terms, publication_types, topic_tags";

function scalarEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? null) === (b ?? null);
}

// Order-sensitive compare; null and [] are treated as equivalent so legacy rows
// that stored NULL for an empty array don't trigger a spurious rewrite.
function arraysEqual(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
  const aa = a ?? [];
  const bb = b ?? [];
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i++) {
    if (aa[i] !== bb[i]) return false;
  }
  return true;
}

/**
 * True when the incoming article is identical (in every stored field) to the
 * existing row — i.e. re-writing it would be a no-op. Exported for unit tests.
 */
export function isPaperUnchanged(incoming: ComparablePaper, existing: ComparablePaper): boolean {
  return (
    scalarEqual(incoming.title, existing.title) &&
    scalarEqual(incoming.abstract, existing.abstract) &&
    scalarEqual(incoming.doi, existing.doi) &&
    scalarEqual(incoming.publication_date, existing.publication_date) &&
    scalarEqual(incoming.epub_date, existing.epub_date) &&
    scalarEqual(incoming.volume, existing.volume) &&
    scalarEqual(incoming.issue, existing.issue) &&
    scalarEqual(incoming.pages, existing.pages) &&
    arraysEqual(incoming.keywords, existing.keywords) &&
    arraysEqual(incoming.mesh_terms, existing.mesh_terms) &&
    arraysEqual(incoming.publication_types, existing.publication_types) &&
    arraysEqual(incoming.topic_tags, existing.topic_tags)
  );
}

export async function storePapers(
  supabase: SupabaseClient,
  journalId: string,
  articles: PubMedArticle[]
): Promise<StoreResult> {
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let errors = 0;
  const insertedPmids: string[] = [];

  // Process in batches
  for (let batchStart = 0; batchStart < articles.length; batchStart += BATCH_SIZE) {
    const batch = articles.slice(batchStart, batchStart + BATCH_SIZE);

    // Classify topics once per article, at store time, so the relationship-graph
    // recompute can read the persisted column instead of re-scanning every
    // abstract (see migration 00045). Reused for both the unchanged-comparison
    // and the row we write.
    const topicTagsByPmid = new Map<string, string[]>(
      batch.map((article) => [
        article.pmid,
        classifyPaperTopics({
          title: article.title,
          abstract: article.abstract,
          keywords: article.keywords ?? [],
          meshTerms: article.meshTerms ?? [],
        }),
      ])
    );

    const toComparable = (article: PubMedArticle): ComparablePaper => ({
      title: article.title,
      abstract: article.abstract,
      doi: article.doi,
      publication_date: article.publicationDate,
      epub_date: article.epubDate,
      volume: article.volume,
      issue: article.issue,
      pages: article.pages,
      keywords: article.keywords ?? null,
      mesh_terms: article.meshTerms ?? null,
      publication_types: article.publicationTypes ?? null,
      topic_tags: topicTagsByPmid.get(article.pmid) ?? null,
    });

    try {
      const pmids = batch.map((a) => a.pmid);

      // Load existing rows (with comparable fields) to detect new/changed/unchanged.
      const { data: existingRows, error: selectError } = await supabase
        .from("papers")
        .select(COMPARE_COLUMNS)
        .in("pmid", pmids);

      if (selectError) {
        console.error("Batch existing-row lookup error:", selectError);
        errors += batch.length;
        continue;
      }

      const existingByPmid = new Map<string, ComparablePaper>(
        (existingRows ?? []).map((r) => [(r as { pmid: string }).pmid, r as unknown as ComparablePaper])
      );

      // Partition the batch: only NEW or CHANGED papers are written. Unchanged
      // papers (the common case for a wide re-sync window) are skipped entirely
      // — no paper rewrite and, crucially, no author delete+reinsert.
      const articlesToWrite: PubMedArticle[] = [];
      for (const article of batch) {
        const existing = existingByPmid.get(article.pmid);
        if (!existing) {
          inserted++;
          insertedPmids.push(article.pmid);
          articlesToWrite.push(article);
        } else if (isPaperUnchanged(toComparable(article), existing)) {
          unchanged++;
        } else {
          updated++;
          articlesToWrite.push(article);
        }
      }

      if (articlesToWrite.length === 0) {
        continue;
      }

      const writtenAt = new Date().toISOString();
      const paperRows = articlesToWrite.map((article) => ({
        journal_id: journalId,
        pmid: article.pmid,
        doi: article.doi,
        title: article.title,
        abstract: article.abstract,
        publication_date: article.publicationDate,
        epub_date: article.epubDate,
        volume: article.volume,
        issue: article.issue,
        pages: article.pages,
        keywords: article.keywords,
        mesh_terms: article.meshTerms,
        publication_types: article.publicationTypes,
        topic_tags: topicTagsByPmid.get(article.pmid),
        updated_at: writtenAt,
      }));

      const { data: upsertedPapers, error: upsertError } = await supabase
        .from("papers")
        .upsert(paperRows, { onConflict: "pmid" })
        .select("id, pmid");

      if (upsertError) {
        console.error("Batch upsert error:", upsertError);
        errors += articlesToWrite.length;
        continue;
      }

      if (!upsertedPapers) {
        errors += articlesToWrite.length;
        continue;
      }

      // Build pmid -> id map from upserted results
      const pmidToId = new Map<string, string>(
        upsertedPapers.map((p: { id: string; pmid: string }) => [p.pmid, p.id])
      );

      // Authors: only rewrite for the papers we just wrote (new + changed).
      // Unchanged papers keep their existing author rows untouched — this
      // delete+reinsert was previously run for every paper in the sync window
      // on every run and was the dominant source of dead tuples / WAL.
      const paperIds = upsertedPapers.map((p: { id: string }) => p.id);

      const { error: deleteError } = await supabase
        .from("paper_authors")
        .delete()
        .in("paper_id", paperIds);

      if (deleteError) {
        console.error("Error deleting old authors:", deleteError);
      }

      const allAuthorRows = articlesToWrite.flatMap((article) => {
        const paperId = pmidToId.get(article.pmid);
        if (!paperId || article.authors.length === 0) return [];
        return article.authors.map((author, index) => ({
          paper_id: paperId,
          last_name: author.lastName,
          first_name: author.firstName,
          initials: author.initials,
          affiliation: author.affiliation,
          position: index + 1,
        }));
      });

      if (allAuthorRows.length > 0) {
        const { error: authorError } = await supabase
          .from("paper_authors")
          .insert(allAuthorRows);

        if (authorError) {
          console.error("Error inserting authors batch:", authorError);
        }
      }
    } catch (error) {
      console.error(`Error processing batch starting at index ${batchStart}:`, error);
      errors += batch.length;
    }
  }

  return { inserted, updated, unchanged, errors, insertedPmids };
}
