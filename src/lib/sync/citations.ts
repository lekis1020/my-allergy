import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchLinkedPmids } from "@/lib/pubmed/links";

interface CitationResult {
  processed: number;
  citationsInserted: number;
  errors: number;
}

const BATCH_SIZE = 20;

/**
 * Fetch citation relationships from PubMed elink for the given PMIDs,
 * then store only relationships where both sides exist in our DB.
 *
 * Called after papers are synced — processes newly inserted PMIDs.
 */
export async function collectCitations(
  supabase: SupabaseClient,
  pmids: string[]
): Promise<CitationResult> {
  if (pmids.length === 0) return { processed: 0, citationsInserted: 0, errors: 0 };

  // Load all PMIDs in our DB for fast lookup
  const dbPmids = await loadAllDbPmids(supabase);

  let processed = 0;
  let citationsInserted = 0;
  let errors = 0;

  // Process in batches to avoid overwhelming PubMed API
  for (let i = 0; i < pmids.length; i += BATCH_SIZE) {
    const batch = pmids.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map((pmid) => collectCitationsForPaper(supabase, pmid, dbPmids))
    );

    for (const result of results) {
      processed++;
      if (result.status === "fulfilled") {
        citationsInserted += result.value;
      } else {
        errors++;
      }
    }

    // Rate limit: 200ms pause between batches
    if (i + BATCH_SIZE < pmids.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return { processed, citationsInserted, errors };
}

/**
 * Fetch refs and cited-by for a single paper, store in paper_citations.
 * Returns the number of citation rows inserted.
 */
async function collectCitationsForPaper(
  supabase: SupabaseClient,
  pmid: string,
  dbPmids: Set<string>
): Promise<number> {
  // Fetch both directions from PubMed
  const [refs, citedBy] = await Promise.all([
    fetchLinkedPmids(pmid, "pubmed_pubmed_refs", 100),
    fetchLinkedPmids(pmid, "pubmed_pubmed_citedin", 100),
  ]);

  const rows: Array<{ source_pmid: string; target_pmid: string }> = [];

  // This paper cites these refs (source=this, target=ref)
  for (const ref of refs) {
    if (dbPmids.has(ref)) {
      rows.push({ source_pmid: pmid, target_pmid: ref });
    }
  }

  // These papers cite this paper (source=citer, target=this)
  for (const citer of citedBy) {
    if (dbPmids.has(citer)) {
      rows.push({ source_pmid: citer, target_pmid: pmid });
    }
  }

  if (rows.length === 0) return 0;

  const { data, error } = await supabase
    .from("paper_citations")
    .upsert(rows, { onConflict: "source_pmid,target_pmid", ignoreDuplicates: true })
    .select("source_pmid");

  if (error) {
    console.warn(`[Citations] Error storing citations for ${pmid}:`, error.message);
    return 0;
  }

  return data?.length ?? 0;
}

/**
 * Load all PMIDs from our papers table into a Set for fast lookup.
 */
async function loadAllDbPmids(supabase: SupabaseClient): Promise<Set<string>> {
  const pmids = new Set<string>();
  let offset = 0;
  const pageSize = 5000;

  while (true) {
    const { data } = await supabase
      .from("papers")
      .select("pmid")
      .range(offset, offset + pageSize - 1);

    if (!data || data.length === 0) break;

    for (const row of data) {
      pmids.add(row.pmid as string);
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return pmids;
}
