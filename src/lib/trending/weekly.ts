import type { createServiceClient, createAnonClient } from "@/lib/supabase/server";
import { fetchSocialCounts } from "@/lib/papers/social-counts";
import { classifyPaperTopics } from "@/lib/utils/topic-tags";
import { decodeHtmlEntities } from "@/lib/utils/html-entities";

type ServiceClient = ReturnType<typeof createServiceClient>;
type AnonClient = ReturnType<typeof createAnonClient>;

export const WEEKLY_WINDOW_DAYS = 7;
export const WEEKLY_TOP_N = 20;

// Weight table for the composite ranking score. Change here, not in the
// query — the compute path is the single source of truth and the snapshot
// column captures whatever these weights produce.
const WEIGHTS = {
  bookmark: 2,
  like: 1,
  comment: 3,
  impactFactor: 3,      // multiplies (IF / max_IF) — journals with the highest IF get +3
  citation: 0.5,        // usually 0 for a week-old paper but not forced to 0
  recency: 1,           // multiplies (WEEKLY_WINDOW_DAYS - days_since_epub) / WEEKLY_WINDOW_DAYS
} as const;

const MAX_IMPACT_FACTOR = 30; // covers current allergy journal range (JACI ≈ 14.2)

export interface WeeklyRankedPaper {
  pmid: string;
  title: string;
  abstract: string | null;
  ai_summary: string | null;
  epub_date: string;
  citation_count: number;
  impact_factor: number | null;
  bookmark_count: number;
  like_count: number;
  comment_count: number;
  score: number;
  rank: number;
  journal: {
    id: string;
    name: string;
    abbreviation: string;
    color: string;
    slug: string;
    impact_factor: number | null;
  };
  authors: Array<{
    last_name: string;
    first_name: string | null;
    initials: string | null;
    affiliation: string | null;
    position: number;
  }>;
  keywords: string[];
  mesh_terms: string[];
  publication_types: string[] | null;
  is_fallback: boolean; // true when the paper only ranks because of IF fallback
}

interface RawPaperRow {
  pmid: string;
  title: string;
  abstract: string | null;
  ai_summary: string | null;
  epub_date: string | null;
  publication_date: string | null;
  citation_count: number | null;
  keywords: string[] | null;
  mesh_terms: string[] | null;
  publication_types: string[] | null;
  journals: {
    id: string;
    name: string;
    abbreviation: string;
    color: string;
    slug: string;
    impact_factor: number | null;
  };
  paper_authors: Array<{
    last_name: string;
    first_name: string | null;
    initials: string | null;
    affiliation: string | null;
    position: number;
  }>;
}

const RAW_SELECT = `
  pmid, title, abstract, ai_summary, epub_date, publication_date,
  citation_count, keywords, mesh_terms, publication_types,
  journals!inner (id, name, abbreviation, color, slug, impact_factor),
  paper_authors (last_name, first_name, initials, affiliation, position)
` as const;

/**
 * Monday of the ISO week that contains `date` (UTC). Returns YYYY-MM-DD.
 * Sunday counts as day 0 in JS getUTCDay(), which we treat as the LAST day
 * of the ISO week — so Sunday reports the *previous* Monday.
 */
export function isoWeekStart(date: Date): string {
  const day = date.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const daysBackToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(date);
  monday.setUTCDate(monday.getUTCDate() - daysBackToMonday);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

export function addDaysUTC(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Compute a weekly trending ranking for the ISO week that contains `today`.
 * Reads live papers + social counts, ranks by the composite score. Falls
 * back to IF ordering for papers whose social score is 0. Returns the top
 * WEEKLY_TOP_N ranked papers with rank + score attached.
 *
 * Callers pass a ServiceClient for the social-counts RPC (it aggregates over
 * RLS-restricted tables). The paper read itself is safe under an anon client
 * but reusing the ServiceClient here keeps one round-trip pool.
 */
export async function computeWeeklyTrending(
  client: ServiceClient | AnonClient,
  serviceClient: ServiceClient,
  today: Date = new Date(),
): Promise<WeeklyRankedPaper[]> {
  // ISO week (Monday–Sunday) that contains `today` — results align with the
  // snapshot table's week_starts_on and stay stable across a day's requests.
  const weekStart = isoWeekStart(today);
  const fromDate = weekStart;
  const toDate = addDaysUTC(weekStart, WEEKLY_WINDOW_DAYS - 1);

  const { data, error } = await client
    .from("papers")
    .select(RAW_SELECT)
    .gte("epub_date", fromDate)
    .lte("epub_date", toDate)
    .not("abstract", "is", null)
    .neq("abstract", "");

  if (error) {
    console.error("[weekly-trending] paper fetch failed:", error);
    return [];
  }

  const rows = (data ?? []) as unknown as RawPaperRow[];
  if (rows.length === 0) return [];

  // Filter to allergy-tagged papers (drop rows whose topic tags are all "others")
  const relevant = rows.filter((r) => {
    const tags = classifyPaperTopics({
      title: r.title,
      abstract: r.abstract,
      keywords: r.keywords ?? [],
      meshTerms: r.mesh_terms ?? [],
    });
    return tags.some((t) => t !== "others");
  });

  if (relevant.length === 0) return [];

  // Social counts for the filtered set.
  const pmids = relevant.map((r) => r.pmid);
  const socialMap = await fetchSocialCounts(serviceClient, pmids);

  const scored = relevant.map((r) => {
    const social = socialMap.get(r.pmid) ?? { bookmark: 0, like: 0, comment: 0, connection: 0 };
    const if_ = r.journals.impact_factor ?? 0;
    const if_norm = Math.min(if_ / MAX_IMPACT_FACTOR, 1);
    const daysSinceEpub = Math.max(
      0,
      Math.floor(
        (Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) -
          Date.UTC(
            Number(r.epub_date!.slice(0, 4)),
            Number(r.epub_date!.slice(5, 7)) - 1,
            Number(r.epub_date!.slice(8, 10)),
          )) /
          86_400_000,
      ),
    );
    const recency = Math.max(0, (WEEKLY_WINDOW_DAYS - daysSinceEpub) / WEEKLY_WINDOW_DAYS);

    const socialSubscore =
      social.bookmark * WEIGHTS.bookmark +
      social.like * WEIGHTS.like +
      social.comment * WEIGHTS.comment;

    const score =
      socialSubscore +
      if_norm * WEIGHTS.impactFactor +
      (r.citation_count ?? 0) * WEIGHTS.citation +
      recency * WEIGHTS.recency;

    return {
      row: r,
      social,
      score,
      is_fallback: socialSubscore === 0,
    };
  });

  // Sort: score desc → IF desc → epub_date desc → pmid asc
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ifA = a.row.journals.impact_factor ?? 0;
    const ifB = b.row.journals.impact_factor ?? 0;
    if (ifB !== ifA) return ifB - ifA;
    const dA = a.row.epub_date ?? "";
    const dB = b.row.epub_date ?? "";
    if (dB !== dA) return dB.localeCompare(dA);
    return a.row.pmid.localeCompare(b.row.pmid);
  });

  return scored.slice(0, WEEKLY_TOP_N).map((s, i): WeeklyRankedPaper => ({
    pmid: s.row.pmid,
    title: decodeHtmlEntities(s.row.title),
    abstract: s.row.abstract ? decodeHtmlEntities(s.row.abstract) : null,
    ai_summary: s.row.ai_summary,
    epub_date: s.row.epub_date ?? s.row.publication_date ?? "",
    citation_count: s.row.citation_count ?? 0,
    impact_factor: s.row.journals.impact_factor,
    bookmark_count: s.social.bookmark,
    like_count: s.social.like,
    comment_count: s.social.comment,
    score: Number(s.score.toFixed(3)),
    rank: i + 1,
    journal: s.row.journals,
    authors: s.row.paper_authors ?? [],
    keywords: (s.row.keywords ?? []).map(decodeHtmlEntities),
    mesh_terms: (s.row.mesh_terms ?? []).map(decodeHtmlEntities),
    publication_types: s.row.publication_types,
    is_fallback: s.is_fallback,
  }));
}

/**
 * Read the most recent snapshot from `weekly_trending_snapshots` and
 * hydrate it with live paper metadata for the API response. Returns null
 * if no snapshot exists yet (cron hasn't run for the current or any prior
 * week).
 */
export async function loadLatestWeeklySnapshot(
  client: ServiceClient | AnonClient,
): Promise<{
  weekStartsOn: string;
  papers: WeeklyRankedPaper[];
  previousWeekStartsOn: string | null;
  previousRankByPmid: Map<string, number>;
} | null> {
  const { data: latestRow } = await client
    .from("weekly_trending_snapshots")
    .select("week_starts_on")
    .order("week_starts_on", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestRow) return null;
  const weekStartsOn = String(latestRow.week_starts_on);

  const { data: snapshotRows } = await client
    .from("weekly_trending_snapshots")
    .select("rank, pmid, score, bookmark_count, like_count, comment_count, citation_count, impact_factor, epub_date")
    .eq("week_starts_on", weekStartsOn)
    .order("rank", { ascending: true });

  if (!snapshotRows || snapshotRows.length === 0) return null;

  const pmids = snapshotRows.map((r) => String(r.pmid));
  const { data: papers } = await client
    .from("papers")
    .select(RAW_SELECT)
    .in("pmid", pmids);

  const paperMap = new Map<string, RawPaperRow>();
  for (const p of (papers ?? []) as unknown as RawPaperRow[]) {
    paperMap.set(p.pmid, p);
  }

  const hydrated: WeeklyRankedPaper[] = [];
  for (const s of snapshotRows) {
    const row = paperMap.get(String(s.pmid));
    if (!row) continue; // paper was deleted — skip this row
    hydrated.push({
      pmid: String(s.pmid),
      title: decodeHtmlEntities(row.title),
      abstract: row.abstract ? decodeHtmlEntities(row.abstract) : null,
      ai_summary: row.ai_summary,
      epub_date: String(s.epub_date ?? row.epub_date ?? ""),
      citation_count: Number(s.citation_count ?? 0),
      impact_factor: s.impact_factor as number | null,
      bookmark_count: Number(s.bookmark_count ?? 0),
      like_count: Number(s.like_count ?? 0),
      comment_count: Number(s.comment_count ?? 0),
      score: Number(s.score),
      rank: Number(s.rank),
      journal: row.journals,
      authors: row.paper_authors ?? [],
      keywords: (row.keywords ?? []).map(decodeHtmlEntities),
      mesh_terms: (row.mesh_terms ?? []).map(decodeHtmlEntities),
      publication_types: row.publication_types,
      is_fallback:
        Number(s.bookmark_count ?? 0) * WEIGHTS.bookmark +
          Number(s.like_count ?? 0) * WEIGHTS.like +
          Number(s.comment_count ?? 0) * WEIGHTS.comment === 0,
    });
  }

  // Previous week snapshot for delta calc.
  const previousWeekStartsOn = addDaysUTC(weekStartsOn, -7);
  const { data: prevRows } = await client
    .from("weekly_trending_snapshots")
    .select("rank, pmid")
    .eq("week_starts_on", previousWeekStartsOn);

  const previousRankByPmid = new Map<string, number>();
  for (const r of prevRows ?? []) {
    previousRankByPmid.set(String(r.pmid), Number(r.rank));
  }

  return {
    weekStartsOn,
    papers: hydrated,
    previousWeekStartsOn: prevRows && prevRows.length > 0 ? previousWeekStartsOn : null,
    previousRankByPmid,
  };
}

/**
 * Upsert a snapshot for `weekStartsOn` from a freshly computed ranking.
 * Deletes stale rows from the same week whose pmid isn't in the new set,
 * so re-runs converge instead of accumulating orphan ranks.
 */
export async function writeWeeklySnapshot(
  serviceClient: ServiceClient,
  weekStartsOn: string,
  ranked: WeeklyRankedPaper[],
): Promise<void> {
  const rows = ranked.map((p) => ({
    week_starts_on: weekStartsOn,
    rank: p.rank,
    pmid: p.pmid,
    score: p.score,
    bookmark_count: p.bookmark_count,
    like_count: p.like_count,
    comment_count: p.comment_count,
    citation_count: p.citation_count,
    impact_factor: p.impact_factor,
    epub_date: p.epub_date || null,
    computed_at: new Date().toISOString(),
  }));

  if (rows.length === 0) return;

  await serviceClient
    .from("weekly_trending_snapshots")
    .upsert(rows, { onConflict: "week_starts_on,pmid" });

  const keptPmids = ranked.map((p) => p.pmid);
  await serviceClient
    .from("weekly_trending_snapshots")
    .delete()
    .eq("week_starts_on", weekStartsOn)
    .not("pmid", "in", `(${keptPmids.map((p) => `"${p}"`).join(",")})`);
}
