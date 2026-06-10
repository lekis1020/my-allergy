import { createAnonClient } from "@/lib/supabase/server";
import { PAPER_FEED_SELECT } from "./transform";

export interface QueryArgs {
  q: string;
  pmids: string;
  journals: string;
  from: string;
  to: string;
  sort: string;
  articleType: string;
}

// The column each sort orders by — also the keyset cursor's `v` value.
export function sortColumn(sort: string): "epub_date" | "citation_count" {
  return sort === "citations" ? "citation_count" : "epub_date";
}

export function buildPapersQuery(args: QueryArgs, withCount: boolean) {
  const supabase = createAnonClient();
  const papersTable = supabase.from("papers");
  // `estimated` count (planner stats, no scan) only on the first page — it
  // feeds the header label and the on-demand-fetch heuristic. Cursor pages
  // skip counting entirely.
  let query = papersTable
    .select(PAPER_FEED_SELECT, { count: withCount ? "estimated" : undefined })
    .not("abstract", "is", null)
    .neq("abstract", "");

  if (args.q) query = query.textSearch("search_vector", args.q, { type: "websearch" });

  if (args.pmids) {
    const list = args.pmids.split(",").filter(Boolean).slice(0, 100);
    if (list.length > 0) query = query.in("pmid", list);
  }

  if (args.journals) {
    const slugs = args.journals.split(",").filter(Boolean).slice(0, 30);
    if (slugs.length > 0) query = query.in("journals.slug", slugs);
  }

  if (args.from && /^\d{4}-\d{2}-\d{2}$/.test(args.from)) {
    query = query.gte("epub_date", args.from);
  }
  if (args.to && /^\d{4}-\d{2}-\d{2}$/.test(args.to)) {
    query = query.lte("epub_date", args.to);
  }

  if (args.articleType) {
    const pubTypeMap: Record<string, string[]> = {
      original: ["Journal Article"],
      review: ["Review"],
      rct: ["Randomized Controlled Trial"],
      systematic_review: ["Systematic Review"],
      meta_analysis: ["Meta-Analysis"],
      retrospective: ["Observational Study"],
      case_report: ["Case Reports"],
    };
    const pubTypeValues = pubTypeMap[args.articleType];
    if (pubTypeValues) {
      query = query.overlaps("publication_types", pubTypeValues);
    }
  }

  const ascending = args.sort === "date_asc";
  query = query.order(sortColumn(args.sort), { ascending, nullsFirst: false });
  // Stable secondary key so keyset pagination never skips or repeats rows when
  // the sort column has ties (or nulls). id direction follows the sort.
  query = query.order("id", { ascending });

  return query.order("position", { referencedTable: "paper_authors", ascending: true });
}

export type PapersQuery = ReturnType<typeof buildPapersQuery>;

// Restricts a query to rows strictly after the keyset cursor, matching the
// `(sortColumn DESC/ASC NULLS LAST, id DESC/ASC)` ordering.
export function applyKeyset(
  query: PapersQuery,
  sort: string,
  cursor: { v: string | null; id: string },
) {
  const col = sortColumn(sort);
  const ascending = sort === "date_asc";
  if (cursor.v === null) {
    // The cursor row is already in the NULLS-LAST tail; only id breaks ties.
    return ascending
      ? query.is(col, null).gt("id", cursor.id)
      : query.is(col, null).lt("id", cursor.id);
  }
  const cmp = ascending ? "gt" : "lt";
  // Past the cursor value, OR tied on it but past the id, OR into the null tail.
  return query.or(
    `${col}.${cmp}.${cursor.v},and(${col}.eq.${cursor.v},id.${cmp}.${cursor.id}),${col}.is.null`,
  );
}
