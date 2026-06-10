import { createAnonClient } from "@/lib/supabase/server";
import type { LinkedPaper } from "@/components/papers/paper-list-section";

type AnonClient = ReturnType<typeof createAnonClient>;

/**
 * Find papers that cite or are cited by the given paper, from the
 * paper_citations table.
 *
 * - references: this paper cites others (source = this, target = others)
 * - cited_by:   others cite this paper (source = others, target = this)
 */
export async function findCitationsFromDb(
  supabase: AnonClient,
  pmid: string,
  direction: "references" | "cited_by"
): Promise<LinkedPaper[]> {
  const column = direction === "references" ? "source_pmid" : "target_pmid";
  const linkedColumn = direction === "references" ? "target_pmid" : "source_pmid";

  const { data: citations } = await supabase
    .from("paper_citations")
    .select(linkedColumn)
    .eq(column, pmid);

  if (!citations || citations.length === 0) return [];

  const linkedPmids = citations.map((row) =>
    String(row[linkedColumn as keyof typeof row])
  );

  const { data: papers } = await supabase
    .from("papers")
    .select(`
      pmid, title, publication_date, epub_date, citation_count,
      journals!inner (abbreviation, color)
    `)
    .in("pmid", linkedPmids)
    .order("epub_date", { ascending: false });

  return (papers ?? []).map((row) => {
    const journal = row.journals;
    return {
      pmid: String(row.pmid),
      title: String(row.title ?? ""),
      publication_date: String(row.publication_date ?? "1970-01-01"),
      epub_date:
        typeof row.epub_date === "string" && row.epub_date.length > 0
          ? row.epub_date
          : null,
      citation_count:
        typeof row.citation_count === "number" ? row.citation_count : null,
      journal_abbreviation: String(journal.abbreviation ?? ""),
      journal_color: String(journal.color ?? "#6B7280"),
    };
  });
}

/**
 * Load all bookmarked PMIDs for the current user (anonymous-safe).
 */
export async function loadBookmarkedPmids(
  supabase: AnonClient
): Promise<Set<string>> {
  const { data } = await supabase.from("bookmarks").select("pmid");
  return new Set((data ?? []).map((row) => String(row.pmid)));
}

export function resolveDisplayedPublicationDate(
  epubDate: string | null | undefined,
  publicationDate: string | null | undefined,
): string {
  return epubDate || publicationDate || "1970-01-01";
}
