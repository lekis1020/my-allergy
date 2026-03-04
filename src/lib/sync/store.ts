import type { SupabaseClient } from "@supabase/supabase-js";
import type { PubMedArticle } from "@/lib/pubmed/types";

interface StoreResult {
  inserted: number;
  updated: number;
  errors: number;
}

const BATCH_SIZE = 100;

export async function storePapers(
  supabase: SupabaseClient,
  journalId: string,
  articles: PubMedArticle[]
): Promise<StoreResult> {
  let inserted = 0;
  let updated = 0;
  let errors = 0;

  // Process in batches
  for (let batchStart = 0; batchStart < articles.length; batchStart += BATCH_SIZE) {
    const batch = articles.slice(batchStart, batchStart + BATCH_SIZE);

    const paperRows = batch.map((article) => ({
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
      updated_at: new Date().toISOString(),
    }));

    try {
      // Check which pmids already exist BEFORE upsert
      const pmids = batch.map((a) => a.pmid);
      const { data: existingBefore } = await supabase
        .from("papers")
        .select("pmid")
        .in("pmid", pmids);

      const existingPmids = new Set((existingBefore ?? []).map((r: { pmid: string }) => r.pmid));

      const { data: upsertedPapers, error: upsertError } = await supabase
        .from("papers")
        .upsert(paperRows, { onConflict: "pmid" })
        .select("id, pmid");

      if (upsertError) {
        console.error("Batch upsert error:", upsertError);
        errors += batch.length;
        continue;
      }

      if (!upsertedPapers) {
        errors += batch.length;
        continue;
      }

      // Build pmid -> id map from upserted results
      const pmidToId = new Map<string, string>(
        upsertedPapers.map((p: { id: string; pmid: string }) => [p.pmid, p.id])
      );

      // Count inserted vs updated based on pre-upsert state
      for (const article of batch) {
        if (existingPmids.has(article.pmid)) {
          updated++;
        } else {
          inserted++;
        }
      }

      // Process authors in batch: delete old authors for all paper ids, then insert all
      const paperIds = upsertedPapers.map((p: { id: string }) => p.id);

      const { error: deleteError } = await supabase
        .from("paper_authors")
        .delete()
        .in("paper_id", paperIds);

      if (deleteError) {
        console.error("Error deleting old authors:", deleteError);
      }

      const allAuthorRows = batch.flatMap((article) => {
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

  return { inserted, updated, errors };
}
