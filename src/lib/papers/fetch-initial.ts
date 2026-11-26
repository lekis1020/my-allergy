import "server-only";
import { createAnonClient, createServiceClient } from "@/lib/supabase/server";
import { toPaperDto, PAPER_FEED_SELECT, type PaperRow } from "./transform";
import { encodeCursor } from "./cursor";
import { fetchSocialCounts } from "./social-counts";
import type { PapersResponse } from "@/types/filters";

const INITIAL_LIMIT = 10;

const EMPTY: PapersResponse = {
  papers: [],
  total: 0,
  limit: INITIAL_LIMIT,
  hasMore: false,
  nextCursor: null,
};

// SSR fallback for the default (date_desc) timeline feed. Must produce rows in
// the same order as /api/papers' first page — including the `id` tiebreaker —
// so the keyset `nextCursor` it returns lets SWR fetch page 2 seamlessly.
export async function fetchInitialPapers(): Promise<PapersResponse> {
  const supabase = createAnonClient();

  // Fetch one extra row to detect a further page without an exact COUNT.
  const { data, count, error } = await supabase
    .from("papers")
    .select(PAPER_FEED_SELECT, { count: "estimated" })
    .not("abstract", "is", null)
    .neq("abstract", "")
    .order("epub_date", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .order("position", { referencedTable: "paper_authors", ascending: true })
    .range(0, INITIAL_LIMIT);

  if (error) {
    console.error("[fetchInitialPapers] error:", error);
    return EMPTY;
  }

  const rows: PaperRow[] = data || [];
  const hasMore = rows.length > INITIAL_LIMIT;
  const pageRows = hasMore ? rows.slice(0, INITIAL_LIMIT) : rows;
  const paperDtos = pageRows.map((row) => toPaperDto(row));

  const countMap = await fetchSocialCounts(
    createServiceClient(),
    paperDtos.map((p) => p.pmid),
  );
  const papers = paperDtos.map((paper) => {
    const counts = countMap.get(paper.pmid);
    return {
      ...paper,
      like_count: counts?.like ?? 0,
      bookmark_count: counts?.bookmark ?? 0,
      comment_count: counts?.comment ?? 0,
      connection_count: counts?.connection ?? 0,
    };
  });

  const lastRow = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && lastRow
      ? encodeCursor({ m: "k", v: lastRow.epub_date ?? null, id: lastRow.id })
      : null;

  return {
    papers,
    total: count || 0,
    limit: INITIAL_LIMIT,
    hasMore,
    nextCursor,
  };
}
