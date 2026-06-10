import { NextRequest, NextResponse } from "next/server";
import { createAnonClient, createServerAuthClient, createServiceClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/utils/rate-limit";
import { classifyPaperTopics } from "@/lib/utils/topic-tags";
import { loadScoringContext } from "@/lib/recommend/affinity";
import { scorePaper } from "@/lib/recommend/score";
import { fetchOnDemand } from "@/lib/pubmed/on-demand";
import { toPaperDto, PAPER_FEED_SELECT, type PaperRow } from "@/lib/papers/transform";
import { encodeCursor, decodeCursor, type FeedCursor } from "@/lib/papers/cursor";

const limiter = rateLimit({ windowMs: 60_000, maxRequests: 60 });

// Stricter per-user limit for on-demand PubMed fetch (3/min).
const onDemandLimiter = rateLimit({ windowMs: 60_000, maxRequests: 3 });

const ON_DEMAND_TIMEOUT_MS = 4_000;
const BUFFER_DAYS = 365;
const POOL_SIZE = 200;

function isBeyondBuffer(from?: string | null): boolean {
  if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from)) return false;
  const cutoff = Date.now() - BUFFER_DAYS * 24 * 60 * 60 * 1000;
  return new Date(from).getTime() < cutoff;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

interface QueryArgs {
  q: string;
  pmids: string;
  journals: string;
  from: string;
  to: string;
  sort: string;
  articleType: string;
}

// The column each sort orders by — also the keyset cursor's `v` value.
function sortColumn(sort: string): "epub_date" | "citation_count" {
  return sort === "citations" ? "citation_count" : "epub_date";
}

function buildPapersQuery(args: QueryArgs, withCount: boolean) {
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

type PapersQuery = ReturnType<typeof buildPapersQuery>;

// Restricts a query to rows strictly after the keyset cursor, matching the
// `(sortColumn DESC/ASC NULLS LAST, id DESC/ASC)` ordering.
function applyKeyset(query: PapersQuery, sort: string, cursor: { v: string | null; id: string }) {
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

export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const { success, remaining, resetAt } = limiter.check(ip);

  if (!success) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "RateLimit-Remaining": "0",
          "RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
        },
      }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get("q") || "";
  const pmids = searchParams.get("pmids") || "";
  const journals = searchParams.get("journals") || "";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const sortParam = searchParams.get("sort") || "date_desc";
  const personalized = searchParams.get("personalized") === "true";
  const articleType = searchParams.get("articleType") || "";
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20), 100);

  // Keyset pagination: the opaque `cursor` replaces page/offset. A missing or
  // malformed cursor decodes to null and is treated as the first page.
  const cursor = decodeCursor(searchParams.get("cursor"));
  const isFirstPage = cursor === null;
  // The personalized feed paginates by offset into its re-ranked pool.
  const personalizedOffset = cursor && cursor.m === "o" ? cursor.o : 0;

  const validSorts = ["date_desc", "date_asc", "citations"] as const;
  const sort = validSorts.includes(sortParam as (typeof validSorts)[number])
    ? sortParam
    : "date_desc";

  // Resolve auth for every request — needed for per-user social flags
  // (is_bookmarked / is_liked) on cards, even outside personalization.
  const authClient = await createServerAuthClient();
  const { data: { session } } = await authClient.auth.getSession();
  const user = session?.user ?? null;
  const personalizedActive = personalized && !!user;

  const queryArgs: QueryArgs = { q, pmids, journals, from, to, sort, articleType };

  // Initial read
  const runInitialQuery = async () => {
    let query = buildPapersQuery(queryArgs, isFirstPage);
    if (personalizedActive) {
      // Personalized: pull the whole scoring pool, ranked client-side below.
      return query.range(0, POOL_SIZE - 1);
    }
    if (cursor && cursor.m === "k") {
      query = applyKeyset(query, sort, cursor);
    }
    // Fetch one extra row to detect whether a further page exists.
    return query.limit(limit + 1);
  };

  let { data, error, count } = await runInitialQuery();

  if (error) {
    console.error("Papers query error:", error);
    return NextResponse.json({ error: "Failed to fetch papers" }, { status: 500 });
  }

  let rawRows: PaperRow[] = data || [];
  let dbTotal = count || 0;
  let dataSource: "db" | "db+live" | "db (timeout)" = "db";

  // ---- On-demand PubMed fetch (authenticated only, first page) ----
  const shouldAttempt =
    isFirstPage && ((q && (personalizedActive ? rawRows.length : dbTotal) < 20) || isBeyondBuffer(from));

  if (shouldAttempt && user) {
    const userKey = `user:${user.id}`;
    const userLimit = onDemandLimiter.check(userKey);
    if (userLimit.success) {
      try {
        const liveResult = await withTimeout(
          fetchOnDemand({
            query: q,
            journals: journals ? journals.split(",").filter(Boolean) : undefined,
            dateFrom: from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : undefined,
            dateTo: to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : undefined,
          }),
          ON_DEMAND_TIMEOUT_MS,
        );

        if (liveResult.inserted > 0) {
          const refetch = await runInitialQuery();
          if (!refetch.error && refetch.data) {
            rawRows = refetch.data;
            dbTotal = refetch.count || dbTotal;
          }
        }
        dataSource = "db+live";
      } catch (err) {
        if (err instanceof Error && err.message === "timeout") {
          dataSource = "db (timeout)";
        } else {
          console.warn("[Papers] on-demand fetch failed:", err);
        }
      }
    }
  }

  // ---- Pagination resolution: hasMore + the cursor for the next page ----
  let personalizedTotal: number | null = null;
  let hasMore = false;
  let nextCursor: string | null = null;

  if (personalizedActive && user) {
    // Personalization re-rank (authed only).
    const context = await loadScoringContext(authClient, user.id);
    const now = new Date();
    const scored = rawRows.map((paper) => {
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
    scored.sort((a, b) => b.score - a.score);
    personalizedTotal = scored.length;
    rawRows = scored.slice(personalizedOffset, personalizedOffset + limit).map((s) => s.paper);
    hasMore = personalizedOffset + limit < scored.length;
    if (hasMore) {
      nextCursor = encodeCursor({ m: "o", o: personalizedOffset + limit });
    }
  } else {
    // Timeline keyset: we fetched limit + 1 rows to detect a further page.
    hasMore = rawRows.length > limit;
    if (hasMore) rawRows = rawRows.slice(0, limit);
    const lastRow = rawRows[rawRows.length - 1];
    if (hasMore && lastRow) {
      const rawVal = sort === "citations" ? lastRow.citation_count : lastRow.epub_date;
      nextCursor = encodeCursor({
        m: "k",
        v: rawVal === null || rawVal === undefined ? null : String(rawVal),
        id: lastRow.id,
      } satisfies FeedCursor);
    }
  }

  const paperDtos = rawRows.map((row) => toPaperDto(row));

  // Collect like and bookmark counts for returned papers
  const paperPmids = paperDtos.map((p) => p.pmid);
  // Use service client for aggregate counts only — `bookmarks` and `paper_comments`
  // RLS restricts SELECT to the row owner / authed users, which would zero out the
  // counts under an anon client. We expose only aggregate numbers, not row data.
  const statsClient = createServiceClient();

  // Aggregate like / bookmark / comment / connection counts in a single RPC
  // round-trip instead of fetching every matching row across 5 tables and
  // counting them in JS. The function returns one row per input pmid.
  interface SocialCounts {
    like: number;
    bookmark: number;
    comment: number;
    connection: number;
  }
  const countMap = new Map<string, SocialCounts>();
  if (paperPmids.length > 0) {
    // `get_paper_social_counts` (migration 00036) is absent from the generated
    // Database types because it has not been applied to the linked database
    // yet — type the call shape manually until the migration lands.
    const socialCountsRpc = statsClient.rpc as unknown as (
      fn: "get_paper_social_counts",
      args: { p_pmids: string[] },
    ) => PromiseLike<{
      data: Array<{
        pmid: string;
        like_count: number;
        bookmark_count: number;
        comment_count: number;
        connection_count: number;
      }> | null;
      error: { message: string } | null;
    }>;
    const { data: countRows, error: countErr } = await socialCountsRpc(
      "get_paper_social_counts",
      { p_pmids: paperPmids },
    );
    if (countErr) {
      console.warn("[Papers] social counts RPC failed:", countErr);
    }
    for (const row of countRows ?? []) {
      countMap.set(row.pmid, {
        like: Number(row.like_count) || 0,
        bookmark: Number(row.bookmark_count) || 0,
        comment: Number(row.comment_count) || 0,
        connection: Number(row.connection_count) || 0,
      });
    }
  }

  // Per-user social state — only fetch when authenticated.
  const userBookmarkedSet = new Set<string>();
  const userLikedSet = new Set<string>();
  if (user && paperPmids.length > 0) {
    const [{ data: myBookmarks }, { data: myLikes }] = await Promise.all([
      statsClient.from("bookmarks")
        .select("pmid")
        .eq("user_id", user.id)
        .in("pmid", paperPmids),
      statsClient.from("paper_likes")
        .select("paper_pmid")
        .eq("user_id", user.id)
        .in("paper_pmid", paperPmids),
    ]);
    for (const row of myBookmarks ?? []) userBookmarkedSet.add(row.pmid);
    for (const row of myLikes ?? []) userLikedSet.add(row.paper_pmid);
  }

  const papers = paperDtos.map((paper) => {
    const counts = countMap.get(paper.pmid);
    return {
      ...paper,
      like_count: counts?.like ?? 0,
      bookmark_count: counts?.bookmark ?? 0,
      comment_count: counts?.comment ?? 0,
      connection_count: counts?.connection ?? 0,
      is_bookmarked: userBookmarkedSet.has(paper.pmid),
      is_liked: userLikedSet.has(paper.pmid),
    };
  });

  const total = personalizedActive ? (personalizedTotal ?? 0) : dbTotal;

  const response = NextResponse.json({
    papers,
    total,
    limit,
    hasMore,
    nextCursor,
    personalized: personalizedActive,
  });

  // CDN cache: authed (per-user social flags), personalized, or live merged
  // results must not be shared across users.
  if (user || personalizedActive || dataSource !== "db") {
    response.headers.set("Cache-Control", "private, no-store");
  } else {
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600",
    );
  }
  response.headers.set("X-Data-Source", dataSource);
  response.headers.set("RateLimit-Remaining", String(remaining));
  response.headers.set("RateLimit-Reset", String(Math.ceil(resetAt / 1000)));

  return response;
}
