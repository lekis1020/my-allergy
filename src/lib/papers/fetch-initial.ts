import "server-only";
import { createAnonClient } from "@/lib/supabase/server";
import { toPaperDto, type PaperRow } from "./transform";
import type { PapersResponse } from "@/types/filters";

const INITIAL_LIMIT = 10;

export async function fetchInitialPapers(): Promise<PapersResponse> {
  const supabase = createAnonClient();

  const { data, count, error } = await supabase
    .from("papers")
    .select(
      `
      id, pmid, doi, title, abstract, publication_date, epub_date,
      volume, issue, pages, keywords, mesh_terms, citation_count, journal_id, publication_types,
      journals!inner (id, name, abbreviation, color, slug),
      paper_authors (last_name, first_name, initials, affiliation, position)
    `,
      { count: "exact" },
    )
    .not("abstract", "is", null)
    .neq("abstract", "")
    .order("epub_date", { ascending: false, nullsFirst: false })
    .order("position", { referencedTable: "paper_authors", ascending: true })
    .range(0, INITIAL_LIMIT - 1);

  if (error) {
    console.error("[fetchInitialPapers] error:", error);
    return { papers: [], total: 0, page: 1, limit: INITIAL_LIMIT, hasMore: false };
  }

  const papers = (data || []).map((row) => toPaperDto(row as unknown as PaperRow));
  const total = count || 0;

  return {
    papers,
    total,
    page: 1,
    limit: INITIAL_LIMIT,
    hasMore: INITIAL_LIMIT < total,
  };
}
