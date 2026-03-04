import { NextRequest, NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/utils/rate-limit";
import { classifyPaperTopics } from "@/lib/utils/topic-tags";
import { decodeHtmlEntities } from "@/lib/utils/html-entities";

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
      id, pmid, doi, title, abstract, publication_date,
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

  if (journals) {
    const slugs = journals.split(",").filter(Boolean).slice(0, 30);
    if (slugs.length > 0) {
      query = query.in("journals.slug", slugs);
    }
  }

  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    query = query.gte("publication_date", from);
  }

  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    query = query.lte("publication_date", to);
  }

  switch (sort) {
    case "date_asc":
      query = query.order("publication_date", { ascending: true });
      break;
    case "citations":
      query = query.order("citation_count", { ascending: false, nullsFirst: false });
      break;
    case "date_desc":
    default:
      query = query.order("publication_date", { ascending: false });
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

  const papers = (data || []).map((paper: Record<string, unknown>) => {
    const journal = paper.journals as Record<string, unknown>;
    const authors = (paper.paper_authors as Record<string, unknown>[]) || [];
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
      publication_date: paper.publication_date,
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

  const total = count || 0;

  const response = NextResponse.json({
    papers,
    total,
    page,
    limit,
    hasMore: offset + limit < total,
  });

  // CDN cache: 5 min fresh, 10 min stale-while-revalidate
  response.headers.set(
    "Cache-Control",
    "public, s-maxage=300, stale-while-revalidate=600"
  );
  response.headers.set("RateLimit-Remaining", String(remaining));
  response.headers.set("RateLimit-Reset", String(Math.ceil(resetAt / 1000)));

  return response;
}
