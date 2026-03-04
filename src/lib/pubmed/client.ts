import type { ESearchResponse, PubMedSearchResult } from "./types";
import type { PubMedArticle } from "./types";
import { parsePubMedXml } from "./parser";
import { withRetry } from "@/lib/utils/retry";

const BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const RATE_LIMIT_MS = 250;

let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
  }
  lastRequestTime = Date.now();
  const response = await withRetry(() => fetch(url));
  if (!response.ok) {
    throw new Error(`PubMed API error: ${response.status} ${response.statusText}`);
  }
  return response;
}

function getApiKeyParam(): string {
  const apiKey = process.env.PUBMED_API_KEY;
  return apiKey && apiKey !== "your_pubmed_api_key" ? `&api_key=${apiKey}` : "";
}

export async function esearch(
  query: string,
  options: { retmax?: number; mindate?: string; maxdate?: string } = {}
): Promise<PubMedSearchResult> {
  const { retmax = 500, mindate, maxdate } = options;
  let url = `${BASE_URL}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${retmax}&retmode=json&usehistory=y${getApiKeyParam()}`;

  if (mindate) url += `&mindate=${mindate}`;
  if (maxdate) url += `&maxdate=${maxdate}`;
  url += "&datetype=pdat";

  const response = await rateLimitedFetch(url);
  const data: ESearchResponse = await response.json();

  return {
    count: parseInt(data.esearchresult.count, 10),
    idList: data.esearchresult.idlist || [],
    webEnv: data.esearchresult.webenv,
    queryKey: data.esearchresult.querykey,
  };
}

// Fetches articles in batches and parses each batch separately
// to avoid invalid XML from joining multiple XML documents
export async function efetchAndParse(pmids: string[]): Promise<PubMedArticle[]> {
  const BATCH_SIZE = 200;
  const allArticles: PubMedArticle[] = [];

  for (let i = 0; i < pmids.length; i += BATCH_SIZE) {
    const batch = pmids.slice(i, i + BATCH_SIZE);
    const url = `${BASE_URL}/efetch.fcgi?db=pubmed&id=${batch.join(",")}&retmode=xml${getApiKeyParam()}`;
    const response = await rateLimitedFetch(url);
    const xml = await response.text();
    const articles = parsePubMedXml(xml);
    allArticles.push(...articles);
  }

  return allArticles;
}
