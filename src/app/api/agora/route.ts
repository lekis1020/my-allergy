import { NextRequest, NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/utils/rate-limit";
import { classifyPaperTopics } from "@/lib/utils/topic-tags";
import { decodeHtmlEntities } from "@/lib/utils/html-entities";

const limiter = rateLimit({ windowMs: 60_000, maxRequests: 60 });

// Cap on how many recent comment rows we scan to derive the active-paper list.
// 2000 is generous for the current discussion volume; revisit when the
// community grows enough that this becomes a bottleneck.
const COMMENT_SCAN_LIMIT = 2000;

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
      },
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20),
    100,
  );
  const offset = (page - 1) * limit;

  const supabase = createAnonClient();

  // 1. Pull recent comment rows; RLS already hides deleted/blocked rows.
  const { data: commentRows, error: commentError } = await supabase
    .from("paper_comments")
    .select("paper_pmid, created_at")
    .order("created_at", { ascending: false })
    .limit(COMMENT_SCAN_LIMIT);

  if (commentError) {
    console.error("Agora comment query error:", commentError);
    return NextResponse.json({ error: "Failed to load Agora feed" }, { status: 500 });
  }

  // 2. Aggregate: count per pmid + remember most-recent comment timestamp.
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
  const pagePmids = sortedPmids.slice(offset, offset + limit);

  if (pagePmids.length === 0) {
    return NextResponse.json({
      papers: [],
      total,
      page,
      limit,
      hasMore: false,
    });
  }

  // 3. Fetch full paper data for the paginated pmids.
  const { data: papersData, error: papersError } = await supabase
    .from("papers")
    .select(
      `
      id, pmid, doi, title, abstract, publication_date, epub_date,
      volume, issue, pages, keywords, mesh_terms, citation_count, journal_id,
      journals!inner (id, name, abbreviation, color, slug),
      paper_authors (last_name, first_name, initials, affiliation, position)
    `,
    )
    .in("pmid", pagePmids)
    .order("position", { referencedTable: "paper_authors", ascending: true });

  if (papersError) {
    console.error("Agora paper query error:", papersError);
    return NextResponse.json({ error: "Failed to load papers" }, { status: 500 });
  }

  const papersByPmid = new Map<string, PaperRow>();
  for (const p of (papersData ?? []) as unknown as PaperRow[]) {
    papersByPmid.set(p.pmid, p);
  }

  // Preserve the latest-comment ordering from step 2.
  const ordered = pagePmids
    .map((pmid) => papersByPmid.get(pmid))
    .filter((p): p is PaperRow => Boolean(p))
    .map((p) => toPaperDto(p, counts.get(p.pmid) ?? 0, latest.get(p.pmid) ?? null));

  const response = NextResponse.json({
    papers: ordered,
    total,
    page,
    limit,
    hasMore: offset + limit < total,
  });

  response.headers.set("Cache-Control", "public, s-maxage=5, stale-while-revalidate=10");
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

function toPaperDto(
  paper: PaperRow,
  commentCount: number,
  latestCommentAt: string | null,
) {
  const journal = paper.journals;
  const authors = paper.paper_authors || [];
  const keywords = Array.isArray(paper.keywords)
    ? paper.keywords
        .filter((k): k is string => typeof k === "string")
        .map((k) => decodeHtmlEntities(k))
    : [];
  const meshTerms = Array.isArray(paper.mesh_terms)
    ? paper.mesh_terms
        .filter((t): t is string => typeof t === "string")
        .map((t) => decodeHtmlEntities(t))
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
    publication_date: paper.epub_date || paper.publication_date || "1970-01-01",
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
    comment_count: commentCount,
    latest_comment_at: latestCommentAt,
  };
}
