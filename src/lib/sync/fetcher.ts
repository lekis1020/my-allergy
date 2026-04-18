import { esearch, efetchAndParse } from "@/lib/pubmed/client";
import type { PubMedArticle } from "@/lib/pubmed/types";
import type { JournalConfig } from "@/lib/constants/journals";

export async function fetchPapersForJournal(
  journal: JournalConfig,
  options: { mindate?: string; maxdate?: string } = {}
): Promise<PubMedArticle[]> {
  console.log(`[Fetcher] Searching PubMed for: ${journal.abbreviation}`);

  const searchResult = await esearch(journal.pubmedQuery, {
    retmax: 500,
    mindate: options.mindate,
    maxdate: options.maxdate,
    fetchAll: true,
  });

  console.log(`[Fetcher] Found ${searchResult.count} results for ${journal.abbreviation}`);

  if (searchResult.idList.length === 0) {
    return [];
  }

  const articles = await efetchAndParse(searchResult.idList);

  console.log(`[Fetcher] Parsed ${articles.length} articles for ${journal.abbreviation}`);

  // Exclude records without meaningful abstract text and errata/retractions
  // (title-based filter replaces the former PubMed NOT [pt] query filter which
  // broke due to a PubMed publication-type indexing change circa April 2026).
  const ERRATUM_RE = /^(published erratum|erratum|retract|correction|corrigendum)\b/i;

  const filtered = articles.filter((article) => {
    if (typeof article.abstract !== "string" || article.abstract.trim().length === 0) return false;
    if (ERRATUM_RE.test((article.title ?? "").trim())) return false;
    return true;
  });

  const removed = articles.length - filtered.length;
  if (removed > 0) {
    console.log(
      `[Fetcher] Filtered out ${removed} articles (no abstract / erratum) for ${journal.abbreviation}`
    );
  }

  return filtered;
}
