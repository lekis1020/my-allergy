import { NextRequest, NextResponse } from "next/server";
import { createAnonClient, createServerAuthClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/utils/rate-limit";
import { classifyPaperTopics } from "@/lib/utils/topic-tags";
import { decodeHtmlEntities } from "@/lib/utils/html-entities";
import { loadUserAffinity } from "@/lib/recommend/affinity";
import { scorePaper } from "@/lib/recommend/score";

const limiter = rateLimit({ windowMs: 60_000, maxRequests: 60 });

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
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20), 100);
  const offset = (page - 1) * limit;

  // Personalized mode needs an authenticated user — fall through to the default
  // anon/RLS client if unauthenticated so the flag is silently ignored.
  let personalizedUserId: string | null = null;
  let authedSupabase: Awaited<ReturnType<typeof createServerAuthClient>> | null = null;
  if (personalized) {
    authedSupabase = await createServerAuthClient();
    const {
      data: { user },
    } = await authedSupabase.auth.getUser();
    if (user) personalizedUserId = user.id;
  }
  const personalizedActive = personalized && personalizedUserId !== null && authedSupabase !== null;

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

  if (personalizedActive) {
    // Pull a recency-ordered candidate pool — we re-rank in memory.
    query = query.order("epub_date", { ascending: false, nullsFirst: false });
  } else {
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
  }

  if (personalizedActive) {
    // Candidate pool large enough to support a few pages of re-ranked results.
    const POOL_SIZE = 300;
    query = query
      .order("position", { referencedTable: "paper_authors", ascending: true })
      .range(0, POOL_SIZE - 1);
  } else {
    query = query
      .order("position", { referencedTable: "paper_authors", ascending: true })
      .range(offset, offset + limit - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Papers query error:", error);
    return NextResponse.json({ error: "Failed to fetch papers" }, { status: 500 });
  }

  let rawRows = data || [];

  // Apply personalization re-ranking, then slice for the current page.
  let personalizedTotal: number | null = null;
  if (personalizedActive && authedSupabase && personalizedUserId) {
    const affinity = await loadUserAffinity(authedSupabase, personalizedUserId);
    const now = new Date();
    const scored = rawRows.map((paper) => {
      const journal = paper.journals;
      const journalSlug = journal?.slug ?? "";
      const keywords = Array.isArray(paper.keywords)
        ? paper.keywords.filter((k): k is string => typeof k === "string")
        : [];
      const meshTerms = Array.isArray(paper.mesh_terms)
        ? paper.mesh_terms.filter((t): t is string => typeof t === "string")
        : [];
      const score = scorePaper(
        {
          pmid: paper.pmid,
          journalSlug,
          publicationDate: paper.epub_date || paper.publication_date,
          citationCount: paper.citation_count,
          keywords,
          meshTerms,
          title: String(paper.title ?? ""),
          abstract: typeof paper.abstract === "string" ? paper.abstract : null,
        },
        affinity,
        now
      );
      return { paper, score };
    });
    scored.sort((a, b) => b.score - a.score);
    personalizedTotal = scored.length;
    rawRows = scored.slice(offset, offset + limit).map((s) => s.paper);
  }

  const papers = rawRows.map((paper) => {
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
  });

  const total = personalizedActive ? personalizedTotal ?? 0 : count || 0;
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

  // CDN cache: 5 min fresh, 10 min stale-while-revalidate.
  // Personalized responses are per-user, so keep them private.
  response.headers.set(
    "Cache-Control",
    personalizedActive
      ? "private, no-store"
      : "public, s-maxage=300, stale-while-revalidate=600"
  );
  response.headers.set("RateLimit-Remaining", String(remaining));
  response.headers.set("RateLimit-Reset", String(Math.ceil(resetAt / 1000)));

  return response;
}

function resolveDisplayedPublicationDate(
  epubDate: string | null | undefined,
  publicationDate: string | null | undefined,
): string {
  return epubDate || publicationDate || "1970-01-01";
}
