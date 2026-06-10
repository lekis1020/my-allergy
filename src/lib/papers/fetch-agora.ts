import "server-only";
import { createAnonClient, createServerAuthClient } from "@/lib/supabase/server";
import { toPaperDto, PAPER_FEED_SELECT, type PaperRow } from "./transform";
import type { PapersResponse } from "@/types/filters";

const INITIAL_LIMIT = 20;

// Fallback scan cap, used only when the get_agora_papers RPC is unavailable
// (e.g. migration 00039 has not been applied yet).
const COMMENT_SCAN_LIMIT = 2000;

type AuthClient = Awaited<ReturnType<typeof createServerAuthClient>>;

interface PageAggregate {
  pagePmids: string[];
  counts: Map<string, number>;
  latest: Map<string, string>;
  total: number;
}

/**
 * Primary path: aggregate the discussed-papers list for one page in Postgres
 * via the get_agora_papers RPC. Returns null if the RPC is missing/errors so
 * the caller can fall back to the JS scan.
 */
async function aggregateViaRpc(
  authClient: AuthClient,
  limit: number,
  offset: number,
): Promise<PageAggregate | null> {
  const { data, error } = await authClient.rpc("get_agora_papers", {
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    console.warn("[agora] get_agora_papers RPC unavailable, falling back to scan:", error.message);
    return null;
  }

  const rows = data ?? [];
  return {
    pagePmids: rows.map((r) => r.paper_pmid),
    counts: new Map(rows.map((r) => [r.paper_pmid, Number(r.comment_count) || 0])),
    latest: new Map(rows.map((r) => [r.paper_pmid, r.latest_comment_at])),
    total: rows.length > 0 ? Number(rows[0].total_count) || 0 : 0,
  };
}

/**
 * Fallback path: scan recent comment rows and aggregate in JS. Only reached
 * when the RPC is unavailable.
 */
async function aggregateViaScan(
  authClient: AuthClient,
  limit: number,
  offset: number,
): Promise<PageAggregate | null> {
  const { data: commentRows, error } = await authClient
    .from("paper_comments")
    .select("paper_pmid, created_at")
    .order("created_at", { ascending: false })
    .limit(COMMENT_SCAN_LIMIT);

  if (error) {
    console.error("[agora] comment scan error:", error);
    return null;
  }

  const counts = new Map<string, number>();
  const latest = new Map<string, string>();
  for (const row of commentRows ?? []) {
    const pmid = row.paper_pmid as string;
    counts.set(pmid, (counts.get(pmid) ?? 0) + 1);
    if (!latest.has(pmid)) latest.set(pmid, row.created_at as string);
  }

  const sortedPmids = Array.from(latest.entries())
    .sort(([, a], [, b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([pmid]) => pmid);

  return {
    pagePmids: sortedPmids.slice(offset, offset + limit),
    counts,
    latest,
    total: sortedPmids.length,
  };
}

function emptyResponse(page: number, limit: number): PapersResponse {
  return { papers: [], total: 0, page, limit, hasMore: false };
}

/**
 * Fetch one page of the Agora feed: papers that have comments, ordered by
 * most-recent discussion. Shared by the SSR loader and the /api/agora route.
 */
export async function fetchAgoraPage(page: number, limit: number): Promise<PapersResponse> {
  const offset = (page - 1) * limit;
  const authClient = await createServerAuthClient();

  const aggregate =
    (await aggregateViaRpc(authClient, limit, offset)) ??
    (await aggregateViaScan(authClient, limit, offset));

  if (!aggregate) return emptyResponse(page, limit);

  const { pagePmids, counts, latest, total } = aggregate;
  if (pagePmids.length === 0) {
    return { papers: [], total, page, limit, hasMore: false };
  }

  const supabase = createAnonClient();
  const { data: papersData, error: papersError } = await supabase
    .from("papers")
    .select(PAPER_FEED_SELECT)
    .in("pmid", pagePmids)
    .order("position", { referencedTable: "paper_authors", ascending: true });

  if (papersError) {
    console.error("[agora] paper query error:", papersError);
    return emptyResponse(page, limit);
  }

  const papersByPmid = new Map<string, PaperRow>();
  for (const p of papersData ?? []) {
    papersByPmid.set(p.pmid, p);
  }

  // Preserve the latest-comment ordering from the aggregate step.
  const papers = pagePmids
    .map((pmid) => papersByPmid.get(pmid))
    .filter((p): p is PaperRow => Boolean(p))
    .map((p) => ({
      ...toPaperDto(p),
      comment_count: counts.get(p.pmid) ?? 0,
      latest_comment_at: latest.get(p.pmid) ?? null,
    }));

  return { papers, total, page, limit, hasMore: offset + limit < total };
}

export async function fetchInitialAgora(): Promise<PapersResponse> {
  return fetchAgoraPage(1, INITIAL_LIMIT);
}
