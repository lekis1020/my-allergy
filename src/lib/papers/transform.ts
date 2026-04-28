import { decodeHtmlEntities } from "@/lib/utils/html-entities";
import { classifyPaperTopics } from "@/lib/utils/topic-tags";
import type { PaperWithJournal } from "@/types/filters";

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
    first_name: string | null;
    initials: string | null;
    affiliation: string | null;
    position: number;
  }>;
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
      first_name: a.first_name,
      initials: a.initials,
      affiliation: a.affiliation,
      position: a.position,
    })),
  };
}

function resolveDisplayedPublicationDate(
  epubDate: string | null | undefined,
  publicationDate: string | null | undefined,
): string {
  return epubDate || publicationDate || "1970-01-01";
}
