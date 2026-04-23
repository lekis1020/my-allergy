import "server-only";
import { createAnonClient, createServerAuthClient } from "@/lib/supabase/server";
import { toPaperDto, type PaperRow } from "./transform";
import type { PapersResponse } from "@/types/filters";

const COMMENT_SCAN_LIMIT = 2000;
const INITIAL_LIMIT = 20;

export async function fetchInitialAgora(): Promise<PapersResponse> {
  const authClient = await createServerAuthClient();
  const { data: commentRows, error: commentError } = await authClient
    .from("paper_comments")
    .select("paper_pmid, created_at")
    .order("created_at", { ascending: false })
    .limit(COMMENT_SCAN_LIMIT);

  if (commentError) {
    console.error("[fetchInitialAgora] comment error:", commentError);
    return { papers: [], total: 0, page: 1, limit: INITIAL_LIMIT, hasMore: false };
  }

  const counts = new Map<string, number>();
  const latest = new Map<string, string>();
  for (const row of commentRows ?? []) {
    const pmid = row.paper_pmid as string;
    const createdAt = row.created_at as string;
    counts.set(pmid, (counts.get(pmid) ?? 0) + 1);
    if (!latest.has(pmid)) latest.set(pmid, createdAt);
  }

  const sortedPmids = Array.from(latest.entries())
    .sort(([, a], [, b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([pmid]) => pmid);

  const total = sortedPmids.length;
  const pagePmids = sortedPmids.slice(0, INITIAL_LIMIT);

  if (pagePmids.length === 0) {
    return { papers: [], total: 0, page: 1, limit: INITIAL_LIMIT, hasMore: false };
  }

  const supabase = createAnonClient();
  const { data: papersData, error: papersError } = await supabase
    .from("papers")
    .select(
      `
      id, pmid, doi, title, abstract, publication_date, epub_date,
      volume, issue, pages, keywords, mesh_terms, citation_count, journal_id, publication_types,
      journals!inner (id, name, abbreviation, color, slug),
      paper_authors (last_name, first_name, initials, affiliation, position)
    `,
    )
    .in("pmid", pagePmids)
    .order("position", { referencedTable: "paper_authors", ascending: true });

  if (papersError) {
    console.error("[fetchInitialAgora] papers error:", papersError);
    return { papers: [], total: 0, page: 1, limit: INITIAL_LIMIT, hasMore: false };
  }

  const papersByPmid = new Map<string, PaperRow>();
  for (const p of (papersData ?? []) as unknown as PaperRow[]) {
    papersByPmid.set(p.pmid, p);
  }

  const papers = pagePmids
    .map((pmid) => papersByPmid.get(pmid))
    .filter((p): p is PaperRow => Boolean(p))
    .map((p) => ({
      ...toPaperDto(p),
      comment_count: counts.get(p.pmid) ?? 0,
      latest_comment_at: latest.get(p.pmid) ?? null,
    }));

  return {
    papers,
    total,
    page: 1,
    limit: INITIAL_LIMIT,
    hasMore: INITIAL_LIMIT < total,
  };
}
