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
  });

  console.log(`[Fetcher] Found ${searchResult.count} results for ${journal.abbreviation}`);

  if (searchResult.idList.length === 0) {
    return [];
  }

  const articles = await efetchAndParse(searchResult.idList);

  console.log(`[Fetcher] Parsed ${articles.length} articles for ${journal.abbreviation}`);

  // Exclude records without meaningful abstract text.
  const articlesWithAbstract = articles.filter(
    (article) => typeof article.abstract === "string" && article.abstract.trim().length > 0
  );

  if (articlesWithAbstract.length !== articles.length) {
    console.log(
      `[Fetcher] Filtered out ${articles.length - articlesWithAbstract.length} articles without abstract for ${journal.abbreviation}`
    );
  }

  return articlesWithAbstract;
}
