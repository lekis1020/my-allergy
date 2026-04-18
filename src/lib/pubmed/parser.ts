import { XMLParser } from "fast-xml-parser";
import type { PubMedArticle, PubMedAuthor } from "./types";
import { decodeHtmlEntities } from "@/lib/utils/html-entities";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => {
    return [
      "PubmedArticle",
      "Author",
      "Keyword",
      "MeshHeading",
      "ArticleId",
      "AbstractText",
    ].includes(name);
  },
});

function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function extractText(value: unknown): string {
  if (typeof value === "string") return decodeHtmlEntities(value);
  if (typeof value === "object" && value !== null) {
    if ("#text" in (value as Record<string, unknown>)) {
      return decodeHtmlEntities(String((value as Record<string, string>)["#text"]));
    }
  }
  return decodeHtmlEntities(String(value ?? ""));
}

export function parsePubMedXml(xml: string): PubMedArticle[] {
  const parsed = parser.parse(xml);
  const articles = ensureArray(
    parsed?.PubmedArticleSet?.PubmedArticle
  );

  return articles.map(parseArticle).filter(Boolean) as PubMedArticle[];
}

function parseArticle(entry: Record<string, unknown>): PubMedArticle | null {
  try {
    const medlineCitation = entry.MedlineCitation as Record<string, unknown>;
    const article = medlineCitation?.Article as Record<string, unknown>;
    if (!article) return null;

    const pmid = extractText(
      (medlineCitation.PMID as Record<string, unknown>)?.["#text"] ??
        medlineCitation.PMID
    );

    const title = extractText(article.ArticleTitle);

    const abstractTexts = ensureArray(
      (article.Abstract as Record<string, unknown>)?.AbstractText
    );
    const abstract =
      abstractTexts.length > 0
        ? abstractTexts
            .map((t) => {
              const label = typeof t === "object" && t !== null
                ? (t as Record<string, string>)["@_Label"]
                : undefined;
              const text = extractText(t);
              return label ? `${label}: ${text}` : text;
            })
            .join("\n")
        : null;

    const journal = article.Journal as Record<string, unknown>;
    const journalIssue = journal?.JournalIssue as Record<string, unknown>;
    const pubDate = journalIssue?.PubDate as Record<string, unknown>;

    const publicationDateFromIssue = parsePublicationDateFromIssue(pubDate);
    const parsedEpubDate = parseEpubDate(article, entry);
    const publicationDate = publicationDateFromIssue ?? parsedEpubDate ?? "1970-01-01";
    const epubDate = parsedEpubDate ?? publicationDateFromIssue ?? null;

    const authorList = ensureArray(
      (article.AuthorList as Record<string, unknown>)?.Author
    ) as Record<string, unknown>[];
    const authors: PubMedAuthor[] = authorList.map((a, index) => ({
      lastName: extractText(a.LastName ?? a.CollectiveName ?? "Unknown"),
      firstName: a.ForeName ? extractText(a.ForeName) : null,
      initials: a.Initials ? extractText(a.Initials) : null,
      affiliation: a.AffiliationInfo
        ? extractText(
            (ensureArray(a.AffiliationInfo)[0] as Record<string, unknown>)
              ?.Affiliation
          )
        : null,
    }));

    const articleIdList = (entry.PubmedData as Record<string, unknown>)?.ArticleIdList as Record<string, unknown> | undefined;
    const articleIds = ensureArray(
      articleIdList?.ArticleId
    ) as Record<string, unknown>[];
    const doiEntry = articleIds.find((id) => id?.["@_IdType"] === "doi");
    const doi = doiEntry ? extractText(doiEntry["#text"] ?? doiEntry) : null;

    const keywordList = ensureArray(
      (medlineCitation.KeywordList as Record<string, unknown>)?.Keyword
    );
    const keywords = keywordList.map(extractText);

    const meshList = ensureArray(
      (medlineCitation.MeshHeadingList as Record<string, unknown>)?.MeshHeading
    ) as Record<string, unknown>[];
    const meshTerms = meshList
      .map((m) => extractText((m.DescriptorName as Record<string, unknown>)?.["#text"] ?? m.DescriptorName))
      .filter(Boolean);

    return {
      pmid,
      title,
      abstract,
      authors,
      journalTitle: extractText(journal?.Title),
      journalAbbreviation: extractText(journal?.ISOAbbreviation),
      volume: journalIssue?.Volume ? extractText(journalIssue.Volume) : null,
      issue: journalIssue?.Issue ? extractText(journalIssue.Issue) : null,
      pages: article.Pagination
        ? extractText((article.Pagination as Record<string, unknown>)?.MedlinePgn)
        : null,
      publicationDate,
      epubDate,
      doi,
      keywords,
      meshTerms,
    };
  } catch (error) {
    console.error("Failed to parse PubMed article:", error);
    return null;
  }
}

function parseMonth(month: string): string {
  const normalized = month.trim().toLowerCase();
  const months: Record<string, string> = {
    jan: "01",
    january: "01",
    feb: "02",
    february: "02",
    mar: "03",
    march: "03",
    apr: "04",
    april: "04",
    may: "05",
    jun: "06",
    june: "06",
    jul: "07",
    july: "07",
    aug: "08",
    august: "08",
    sep: "09",
    sept: "09",
    september: "09",
    oct: "10",
    october: "10",
    nov: "11",
    november: "11",
    dec: "12",
    december: "12",
    spring: "03",
    summer: "06",
    fall: "09",
    autumn: "09",
    winter: "12",
  };

  if (months[normalized]) return months[normalized];

  const leadingToken = normalized.split(/[^a-z0-9]+/).find(Boolean);
  if (leadingToken && months[leadingToken]) {
    return months[leadingToken];
  }

  const num = parseInt(normalized, 10);
  if (!isNaN(num) && num >= 1 && num <= 12) return String(num).padStart(2, "0");
  return "01";
}

function parseDay(day: string): string {
  const num = parseInt(day.trim(), 10);
  if (Number.isFinite(num) && num >= 1 && num <= 31) {
    return String(num).padStart(2, "0");
  }
  return "01";
}

function parseDateFromParts(
  yearRaw: string,
  monthRaw: string,
  dayRaw: string,
): string | null {
  const year = yearRaw.trim();
  if (!/^\d{4}$/.test(year)) return null;
  const month = parseMonth(monthRaw);
  const day = parseDay(dayRaw);
  return `${year}-${month}-${day}`;
}

function parsePublicationDateFromIssue(pubDate: Record<string, unknown> | undefined): string | null {
  const year = extractText(pubDate?.Year ?? "");
  const month = extractText(pubDate?.Month ?? "01");
  const day = extractText(pubDate?.Day ?? "01");
  const medlineDate = extractText(pubDate?.MedlineDate ?? "");

  const dated = parseDateFromParts(year, month, day);
  if (dated) return dated;

  if (medlineDate) {
    const yearMatch = medlineDate.match(/(\d{4})/);
    if (yearMatch) return `${yearMatch[1]}-01-01`;
  }

  return null;
}

function parseEpubDate(
  article: Record<string, unknown>,
  entry: Record<string, unknown>,
): string | null {
  const articleHistory = (entry.PubmedData as Record<string, unknown>)
    ?.History as Record<string, unknown>;
  const pubmedPubDates = ensureArray(
    articleHistory?.PubMedPubDate,
  ) as Record<string, unknown>[];

  // Prefer true online publication dates first.
  // `pubmed`/`medline` are indexing dates and can be later than actual online release.
  // NOTE: `pmc-release` is the PMC embargo lift date (typically +12 months), NOT
  // the actual publication date — do NOT include it here.
  const statusPriority = ["epublish", "aheadofprint"];
  for (const status of statusPriority) {
    const match = pubmedPubDates.find(
      (d) => String(d?.["@_PubStatus"] ?? "").toLowerCase() === status,
    );
    if (!match) continue;
    const dated = parseDateFromParts(
      extractText(match.Year),
      extractText(match.Month),
      extractText(match.Day),
    );
    if (dated) return dated;
  }

  const articleDates = ensureArray(article.ArticleDate) as Record<string, unknown>[];
  if (articleDates.length > 0) {
    const electronic =
      articleDates.find((d) =>
        String(d?.["@_DateType"] ?? "").toLowerCase().includes("electronic"),
      ) ?? articleDates[0];

    const articleDate = parseDateFromParts(
      extractText(electronic.Year),
      extractText(electronic.Month),
      extractText(electronic.Day),
    );
    if (articleDate) return articleDate;
  }

  // Final fallback: indexing date in PubMed history
  const pubmedMatch = pubmedPubDates.find(
    (d) => String(d?.["@_PubStatus"] ?? "").toLowerCase() === "pubmed",
  );
  if (pubmedMatch) {
    return parseDateFromParts(
      extractText(pubmedMatch.Year),
      extractText(pubmedMatch.Month),
      extractText(pubmedMatch.Day),
    );
  }

  return null;
}
