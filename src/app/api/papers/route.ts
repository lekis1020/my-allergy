import { NextRequest, NextResponse } from "next/server";
import { createAnonClient, createServerAuthClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/utils/rate-limit";
import { classifyPaperTopics } from "@/lib/utils/topic-tags";
import { decodeHtmlEntities } from "@/lib/utils/html-entities";
import { fetchOnDemand } from "@/lib/pubmed/on-demand";

const limiter = rateLimit({ windowMs: 60_000, maxRequests: 60 });

// Stricter per-user limit for on-demand PubMed fetch (3/min).
const onDemandLimiter = rateLimit({ windowMs: 60_000, maxRequests: 3 });

const ON_DEMAND_TIMEOUT_MS = 8_000;
const BUFFER_DAYS = 365;

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
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20), 100);
  const offset = (page - 1) * limit;

  // Validate sort parameter
  const validSorts = ["date_desc", "date_asc", "citations"] as const;
  const sort = validSorts.includes(sortParam as typeof validSorts[number])
    ? sortParam
    : "date_desc";

  const supabase = createAnonClient();

  let query = supabase
    .from("papers")
    .select(
      `
      id, pmid, doi, title, abstract, publication_date, epub_date,
      volume, issue, pages, keywords, mesh_terms, citation_count, journal_id,
      journals!inner (id, name, abbreviation, color, slug),
      paper_authors (last_name, first_name, initials, affiliation, position)
    `,
      { count: "exact" }
    );

  // Timeline should only contain papers with visible abstract text.
  query = query.not("abstract", "is", null).neq("abstract", "");

  // Full-text search using stored tsvector column with weighted GIN index
  if (q) {
    query = query.textSearch('search_vector', q, { type: 'websearch' });
  }

  // Filter by specific PMIDs (used by bookmarks page)
  if (pmids) {
    const pmidList = pmids.split(",").filter(Boolean).slice(0, 100);
    if (pmidList.length > 0) {
      query = query.in("pmid", pmidList);
    }
  }

  if (journals) {
    const slugs = journals.split(",").filter(Boolean).slice(0, 30);
    if (slugs.length > 0) {
      query = query.in("journals.slug", slugs);
    }
  }

  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    query = query.gte("epub_date", from);
  }

  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    query = query.lte("epub_date", to);
  }

  switch (sort) {
    case "date_asc":
      query = query.order("epub_date", { ascending: true, nullsFirst: false });
      break;
    case "citations":
      query = query.order("citation_count", { ascending: false, nullsFirst: false });
      break;
    case "date_desc":
    default:
      query = query.order("epub_date", { ascending: false, nullsFirst: false });
      break;
  }

  query = query
    .order("position", { referencedTable: "paper_authors", ascending: true })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("Papers query error:", error);
    return NextResponse.json({ error: "Failed to fetch papers" }, { status: 500 });
  }

  let papers = (data || []).map(toPaperDto);
  let total = count || 0;
  let dataSource: "db" | "db+live" | "db (timeout)" = "db";

  // ---- On-demand PubMed fetch (authenticated only) ----
  const shouldAttempt =
    page === 1 &&
    ((q && total < 20) || isBeyondBuffer(from));

  if (shouldAttempt) {
    try {
      const authClient = await createServerAuthClient();
      const { data: userData } = await authClient.auth.getUser();
      const user = userData?.user ?? null;

      if (user) {
        const userKey = `user:${user.id}`;
        const userLimit = onDemandLimiter.check(userKey);
        if (userLimit.success) {
          const liveResult = await withTimeout(
            fetchOnDemand({
              query: q,
              journals: journals ? journals.split(",").filter(Boolean) : undefined,
              dateFrom: from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : undefined,
              dateTo: to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : undefined,
            }),
            ON_DEMAND_TIMEOUT_MS,
          );

          // If we inserted new papers, re-run the DB query to include them.
          if (liveResult.inserted > 0) {
            const merged = await refetchAfterLive({
              q,
              pmids,
              journals,
              from,
              to,
              sort,
              offset,
              limit,
            });
            if (merged) {
              papers = mergeUniqueByPmid(papers, merged.papers);
              total = Math.max(total, merged.total);
            }
          }
          dataSource = "db+live";
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message === "timeout") {
        dataSource = "db (timeout)";
      } else {
        console.warn("[Papers] on-demand fetch failed:", err);
      }
    }
  }

  const response = NextResponse.json({
    papers,
    total,
    page,
    limit,
    hasMore: offset + limit < total,
  });

  // CDN cache: live results must not be shared across users.
  if (dataSource === "db") {
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600",
    );
  } else {
    response.headers.set("Cache-Control", "private, no-store");
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

async function refetchAfterLive(args: {
  q: string;
  pmids: string;
  journals: string;
  from: string;
  to: string;
  sort: string;
  offset: number;
  limit: number;
}): Promise<{ papers: ReturnType<typeof toPaperDto>[]; total: number } | null> {
  const supabase = createAnonClient();
  let query = supabase
    .from("papers")
    .select(
      `
      id, pmid, doi, title, abstract, publication_date, epub_date,
      volume, issue, pages, keywords, mesh_terms, citation_count, journal_id,
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

  query = query
    .order("position", { referencedTable: "paper_authors", ascending: true })
    .range(args.offset, args.offset + args.limit - 1);

  const { data, count, error } = await query;
  if (error || !data) return null;
  return { papers: data.map(toPaperDto), total: count ?? 0 };
}

function mergeUniqueByPmid<T extends { pmid: string }>(primary: T[], extra: T[]): T[] {
  const seen = new Set(primary.map((p) => p.pmid));
  const merged = [...primary];
  for (const p of extra) {
    if (!seen.has(p.pmid)) {
      merged.push(p);
      seen.add(p.pmid);
    }
  }
  return merged;
}

function resolveDisplayedPublicationDate(
  epubDate: string | null | undefined,
  publicationDate: string | null | undefined,
): string {
  return epubDate || publicationDate || "1970-01-01";
}
