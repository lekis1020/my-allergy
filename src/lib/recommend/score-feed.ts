import { classifyPaperTopics } from "@/lib/utils/topic-tags";
import { scorePaper } from "./score";
import type { ScoringContext } from "./score";
import type { PaperRow } from "@/lib/papers/transform";

/**
 * Scores feed rows against the user's affinity profile for the
 * personalized re-rank. Pure: derives the scoring inputs from each row
 * and returns { paper, score } pairs in input order — the caller sorts.
 */
export function scoreFeedRows(
  rows: PaperRow[],
  context: ScoringContext,
  now: Date,
): Array<{ paper: PaperRow; score: number }> {
  return rows.map((paper) => {
    const journal = paper.journals;
    const journalSlug = journal?.slug ?? "";
    const keywords = Array.isArray(paper.keywords)
      ? paper.keywords.filter((k): k is string => typeof k === "string").map((k) => k.toLowerCase())
      : [];
    const meshTerms = Array.isArray(paper.mesh_terms)
      ? paper.mesh_terms.filter((t): t is string => typeof t === "string").map((t) => t.toLowerCase())
      : [];
    const publicationTypes = Array.isArray(paper.publication_types)
      ? paper.publication_types.filter((t): t is string => typeof t === "string")
      : [];
    const topicTags = classifyPaperTopics({
      title: String(paper.title ?? ""),
      abstract: typeof paper.abstract === "string" ? paper.abstract : null,
      keywords,
      meshTerms,
    }).filter((t) => t !== "others");
    const authorKeys = (paper.paper_authors ?? []).map(
      (a: { last_name: string; initials: string | null }) =>
        `${a.last_name}_${a.initials ?? ""}`.replace(/\s+/g, "")
    );

    const score = scorePaper(
      {
        pmid: paper.pmid,
        journalSlug,
        publicationDate: paper.epub_date || paper.publication_date,
        citationCount: paper.citation_count,
        keywords,
        meshTerms,
        topicTags,
        authorKeys,
        publicationTypes,
      },
      context,
      now,
    );
    return { paper, score };
  });
}
