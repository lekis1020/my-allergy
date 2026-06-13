import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient, createServiceClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/utils/rate-limit";
import { distributedRateLimit } from "@/lib/utils/distributed-rate-limit";
import { classifyPaperTopics } from "@/lib/utils/topic-tags";
import { loadScoringContext } from "@/lib/recommend/affinity";
import { scoreFeedRows } from "@/lib/recommend/score-feed";
import { fetchOnDemand } from "@/lib/pubmed/on-demand";
import { toPaperDto, type PaperRow } from "@/lib/papers/transform";
import { buildPapersQuery, applyKeyset, type QueryArgs } from "@/lib/papers/feed-query";
import { fetchSocialCounts, fetchUserSocialState } from "@/lib/papers/social-counts";
import { encodeCursor, decodeCursor, type FeedCursor } from "@/lib/papers/cursor";

const limiter = rateLimit({ windowMs: 60_000, maxRequests: 60 });

// Stricter per-user limit for on-demand PubMed fetch (3/min). Distributed:
// this guards the external PubMed quota, which an in-memory per-instance
// counter cannot protect under serverless fan-out.
const onDemandLimiter = distributedRateLimit({
  windowMs: 60_000,
  maxRequests: 3,
  prefix: "ondemand",
});

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
  // getUser() verifies the JWT against Supabase Auth; getSession() would
  // trust a client-supplied cookie payload, and the user id gates reads
  // of per-user rows through the service client below.
  const authClient = await createServerAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
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
    const userLimit = await onDemandLimiter.check(userKey);
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
    const scored = scoreFeedRows(rawRows, context, new Date());
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
  const paperPmids = paperDtos.map((p) => p.pmid);

  // Aggregate counts + per-user social state. Service client — see
  // lib/papers/social-counts.ts for the RLS rationale.
  const statsClient = createServiceClient();
  const countMap = await fetchSocialCounts(statsClient, paperPmids);
  const { bookmarked: userBookmarkedSet, liked: userLikedSet } = user
    ? await fetchUserSocialState(statsClient, user.id, paperPmids)
    : { bookmarked: new Set<string>(), liked: new Set<string>() };

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
