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

    const year = extractText(pubDate?.Year ?? "");
    const month = extractText(pubDate?.Month ?? "01");
    const day = extractText(pubDate?.Day ?? "01");
    const medlineDate = extractText(pubDate?.MedlineDate ?? "");

    let publicationDate: string;
    if (year) {
      const monthNum = parseMonth(month);
      publicationDate = `${year}-${monthNum}-${day.padStart(2, "0")}`;
    } else if (medlineDate) {
      const yearMatch = medlineDate.match(/(\d{4})/);
      publicationDate = yearMatch ? `${yearMatch[1]}-01-01` : "1970-01-01";
    } else {
      publicationDate = "1970-01-01";
    }

    const articleHistory = (entry.PubmedData as Record<string, unknown>)
      ?.History as Record<string, unknown>;
    const pubmedPubDates = ensureArray(
      articleHistory?.PubMedPubDate
    ) as Record<string, unknown>[];
    const epubEntry = pubmedPubDates.find(
      (d) => d?.["@_PubStatus"] === "epublish"
    );
    const epubDate = epubEntry
      ? `${extractText(epubEntry.Year)}-${parseMonth(extractText(epubEntry.Month))}-${extractText(epubEntry.Day).padStart(2, "0")}`
      : null;

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
  const months: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04",
    May: "05", Jun: "06", Jul: "07", Aug: "08",
    Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };
  if (months[month]) return months[month];
  const num = parseInt(month, 10);
  if (!isNaN(num) && num >= 1 && num <= 12) return String(num).padStart(2, "0");
  return "01";
}
