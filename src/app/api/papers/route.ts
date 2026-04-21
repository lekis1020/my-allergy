import { NextRequest, NextResponse } from "next/server";
import { createAnonClient, createServerAuthClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/utils/rate-limit";
import { classifyPaperTopics } from "@/lib/utils/topic-tags";
import { decodeHtmlEntities } from "@/lib/utils/html-entities";
import { loadScoringContext } from "@/lib/recommend/affinity";
import { scorePaper } from "@/lib/recommend/score";
import { fetchOnDemand } from "@/lib/pubmed/on-demand";

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

function buildPapersQuery(args: QueryArgs) {
  const supabase = createAnonClient();
  let query = supabase
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

  switch (args.sort) {
    case "date_asc":
      query = query.order("epub_date", { ascending: true, nullsFirst: false });
      break;
    case "citations":
      query = query.order("citation_count", { ascending: false, nullsFirst: false });
      break;
    default:
      query = query.order("epub_date", { ascending: false, nullsFirst: false });
  }

  return query.order("position", { referencedTable: "paper_authors", ascending: true });
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
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20), 100);
  const offset = (page - 1) * limit;

  const validSorts = ["date_desc", "date_asc", "citations"] as const;
  const sort = validSorts.includes(sortParam as (typeof validSorts)[number])
    ? sortParam
    : "date_desc";

  // Resolve authenticated user once — reused for personalization + on-demand gating.
  // Middleware already verified the user via getUser(); use getSession() here
  // to avoid a redundant network round-trip to Supabase auth.
  const authClient = await createServerAuthClient();
  const {
    data: { session },
  } = await authClient.auth.getSession();
  const user = session?.user ?? null;
  const personalizedActive = personalized && !!user;

  const queryArgs: QueryArgs = { q, pmids, journals, from, to, sort, articleType };

  // Initial read
  const runInitialQuery = async () => {
    const base = buildPapersQuery(queryArgs);
    const ranged = personalizedActive
      ? base.range(0, POOL_SIZE - 1)
      : base.range(offset, offset + limit - 1);
    return ranged;
  };

  let { data, error, count } = await runInitialQuery();

  if (error) {
    console.error("Papers query error:", error);
    return NextResponse.json({ error: "Failed to fetch papers" }, { status: 500 });
  }

  let rawRows = data || [];
  let dbTotal = count || 0;
  let dataSource: "db" | "db+live" | "db (timeout)" = "db";

  // ---- On-demand PubMed fetch (authenticated only, page 1) ----
  const shouldAttempt =
    page === 1 && ((q && (personalizedActive ? rawRows.length : dbTotal) < 20) || isBeyondBuffer(from));

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

  // ---- Personalization re-rank (authed only) ----
  let personalizedTotal: number | null = null;
  if (personalizedActive && user) {
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
    rawRows = scored.slice(offset, offset + limit).map((s) => s.paper);
  }

  const papers = rawRows.map(toPaperDto);
  const total = personalizedActive ? (personalizedTotal ?? 0) : dbTotal;
  const hasMore = personalizedActive
    ? offset + limit < (personalizedTotal ?? 0)
    : offset + limit < total;

  const response = NextResponse.json({
    papers,
    total,
    page,
    limit,
    hasMore,
    personalized: personalizedActive,
  });

  // CDN cache: personalized or live merged results must not be shared across users.
  if (personalizedActive || dataSource !== "db") {
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

interface PaperRow {
  id: string;
  pmid: string;
  doi: string | null;
  title: string;
  abstract: string | null;
  publication_date: string | null;
  epub_date: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  keywords: string[] | null;
  mesh_terms: string[] | null;
  citation_count: number | null;
  journal_id: string;
  publication_types: string[] | null;
  journals: { id: string; name: string; abbreviation: string; color: string; slug: string };
  paper_authors: Array<{
    last_name: string;
    first_name: string | null;
    initials: string | null;
    affiliation: string | null;
    position: number;
  }>;
}

function toPaperDto(paper: PaperRow) {
  const journal = paper.journals;
  const authors = paper.paper_authors || [];
  const keywords = Array.isArray(paper.keywords)
    ? paper.keywords
        .filter((keyword): keyword is string => typeof keyword === "string")
        .map((keyword) => decodeHtmlEntities(keyword))
    : [];
  const meshTerms = Array.isArray(paper.mesh_terms)
    ? paper.mesh_terms
        .filter((term): term is string => typeof term === "string")
        .map((term) => decodeHtmlEntities(term))
    : [];
  const decodedTitle = decodeHtmlEntities(String(paper.title ?? ""));
  const decodedAbstract =
    typeof paper.abstract === "string" ? decodeHtmlEntities(paper.abstract) : null;
  const topicTags = classifyPaperTopics({
    title: decodedTitle,
    abstract: decodedAbstract,
    keywords,
    meshTerms,
  });

  return {
    id: paper.id,
    pmid: paper.pmid,
    doi: paper.doi,
    title: decodedTitle,
    abstract: decodedAbstract,
    publication_date: resolveDisplayedPublicationDate(paper.epub_date, paper.publication_date),
    volume: paper.volume,
    issue: paper.issue,
    pages: paper.pages,
    keywords,
    mesh_terms: meshTerms,
    citation_count: paper.citation_count,
    journal_id: paper.journal_id,
    journal_name: journal.name,
    journal_abbreviation: journal.abbreviation,
    journal_color: journal.color,
    journal_slug: journal.slug,
    topic_tags: topicTags,
    authors: authors.map((a) => ({
      last_name: a.last_name,
      first_name: a.first_name,
      initials: a.initials,
      affiliation: a.affiliation,
      position: a.position,
    })),
  };
}

function resolveDisplayedPublicationDate(
  epubDate: string | null | undefined,
  publicationDate: string | null | undefined,
): string {
  return epubDate || publicationDate || "1970-01-01";
}
