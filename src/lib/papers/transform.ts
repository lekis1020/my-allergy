import { decodeHtmlEntities } from "@/lib/utils/html-entities";
import { classifyPaperTopics } from "@/lib/utils/topic-tags";
import type { PaperWithJournal } from "@/types/filters";

/**
 * The canonical select for any query whose rows feed toPaperDto(). Every
 * column PaperRow declares must be fetched — a narrower copy of this string
 * silently produces undefined DTO fields (this is how trending/agora/history
 * shipped without ai_summary). Keep the literal type (`as const`) so
 * supabase-js infers the row shape from it.
 */
// Feed cards only render the first few authors (by position) plus a total count
// (paper-card / paper-authors). Fetching every author — and especially the long
// `affiliation` string — for every row inflates the query, JSON, and SSR HTML
// for no display benefit. So we drop `affiliation`/`first_name` here and expose
// the true total via an aliased `count` aggregate; the full author list lives in
// the paper-detail select. Display feeds additionally cap the embedded rows with
// `.limit(3, { referencedTable: "paper_authors" })`.
export const PAPER_FEED_SELECT = `
      id, pmid, doi, title, abstract, ai_summary, publication_date, epub_date,
      volume, issue, pages, keywords, mesh_terms, citation_count, journal_id, publication_types,
      journals!inner (id, name, abbreviation, color, slug),
      paper_authors (last_name, initials, position),
      author_count:paper_authors (count)
    ` as const;

export interface PaperRow {
  id: string;
  pmid: string;
  doi: string | null;
  title: string;
  abstract: string | null;
  publication_date: string | null;
  epub_date: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  keywords: string[] | null;
  mesh_terms: string[] | null;
  ai_summary: string | null;
  citation_count: number | null;
  journal_id: string;
  publication_types: string[] | null;
  journals: { id: string; name: string; abbreviation: string; color: string; slug: string };
  paper_authors: Array<{
    last_name: string;
    initials: string | null;
    position: number;
  }>;
  // Aliased `count` aggregate embed — PostgREST returns it as `[{ count: N }]`.
  author_count?: Array<{ count: number }> | null;
}

export function toPaperDto(paper: PaperRow): PaperWithJournal {
  const journal = paper.journals;
  const authors = paper.paper_authors || [];
  const keywords = Array.isArray(paper.keywords)
    ? paper.keywords
        .filter((keyword): keyword is string => typeof keyword === "string")
        .map((keyword) => decodeHtmlEntities(keyword))
    : [];
  const meshTerms = Array.isArray(paper.mesh_terms)
    ? paper.mesh_terms
        .filter((term): term is string => typeof term === "string")
        .map((term) => decodeHtmlEntities(term))
    : [];
  const decodedTitle = decodeHtmlEntities(String(paper.title ?? ""));
  const decodedAbstract =
    typeof paper.abstract === "string" ? decodeHtmlEntities(paper.abstract) : null;
  const topicTags = classifyPaperTopics({
    title: decodedTitle,
    abstract: decodedAbstract,
    keywords,
    meshTerms,
  });

  return {
    id: paper.id,
    pmid: paper.pmid,
    doi: paper.doi,
    title: decodedTitle,
    abstract: decodedAbstract,
    publication_date: resolveDisplayedPublicationDate(paper.epub_date, paper.publication_date),
    volume: paper.volume,
    issue: paper.issue,
    pages: paper.pages,
    keywords,
    mesh_terms: meshTerms,
    citation_count: paper.citation_count,
    journal_id: paper.journal_id,
    journal_name: journal.name,
    journal_abbreviation: journal.abbreviation,
    journal_color: journal.color,
    journal_slug: journal.slug,
    topic_tags: topicTags,
    ai_summary: paper.ai_summary ?? null,
    authors: authors.map((a) => ({
      last_name: a.last_name,
      // first_name / affiliation are not fetched by the feed select; the
      // detail page carries the full author record.
      first_name: null,
      initials: a.initials,
      affiliation: null,
      position: a.position,
    })),
    // True total author count from the aggregate embed; falls back to the
    // (possibly capped) embedded row count when the aggregate is absent.
    authorCount: paper.author_count?.[0]?.count ?? authors.length,
  };
}

function resolveDisplayedPublicationDate(
  epubDate: string | null | undefined,
  publicationDate: string | null | undefined,
): string {
  return epubDate || publicationDate || "1970-01-01";
}
