import { NextRequest, NextResponse } from "next/server";
import { createAnonClient, createServiceClient } from "@/lib/supabase/server";
import { toPaperDto, PAPER_FEED_SELECT } from "@/lib/papers/transform";
import {
  computeWeeklyTrending,
  isoWeekStart,
  loadLatestWeeklySnapshot,
  type WeeklyRankedPaper,
} from "@/lib/trending/weekly";

const POOL_SIZE = 50;
const RESULT_LIMIT = 10;

export async function GET(request: NextRequest) {
  const window = request.nextUrl.searchParams.get("window") ?? "default";

  if (window === "week") {
    return handleWeeklyWindow();
  }

  return handleDefaultWindow();
}

async function handleDefaultWindow() {
  const supabase = createAnonClient();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 180);
  const fromDate = cutoff.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("papers")
    .select(PAPER_FEED_SELECT)
    .not("abstract", "is", null)
    .neq("abstract", "")
    .gte("epub_date", fromDate)
    .not("citation_count", "is", null)
    .gt("citation_count", 0)
    .order("citation_count", { ascending: false, nullsFirst: false })
    .order("epub_date", { ascending: false })
    .order("position", { referencedTable: "paper_authors", ascending: true })
    .limit(POOL_SIZE);

  if (error) {
    console.error("Trending query error:", error);
    return NextResponse.json(
      { error: "Failed to fetch trending papers" },
      { status: 500 }
    );
  }

  const allPapers = (data || []).map((row) => toPaperDto(row));

  // Keep only papers with at least one allergy-related topic tag
  const papers = allPapers
    .filter((p) => p.topic_tags.some((tag) => tag !== "others"))
    .slice(0, RESULT_LIMIT);

  const response = NextResponse.json({
    papers,
    window: "default",
    generatedAt: new Date().toISOString(),
  });

  response.headers.set(
    "Cache-Control",
    "public, s-maxage=300, stale-while-revalidate=600"
  );

  return response;
}

async function handleWeeklyWindow() {
  const anon = createAnonClient();
  const service = createServiceClient();

  // Prefer the pre-computed snapshot. Fall back to live compute (with
  // rank-delta disabled) if no snapshot exists yet.
  const snapshot = await loadLatestWeeklySnapshot(anon);
  let weekStartsOn: string;
  let ranked: WeeklyRankedPaper[];
  let previousRankByPmid: Map<string, number>;

  if (snapshot && snapshot.papers.length > 0) {
    weekStartsOn = snapshot.weekStartsOn;
    ranked = snapshot.papers;
    previousRankByPmid = snapshot.previousRankByPmid;
  } else {
    weekStartsOn = isoWeekStart(new Date());
    ranked = await computeWeeklyTrending(anon, service);
    previousRankByPmid = new Map();
  }

  const papers = ranked.slice(0, RESULT_LIMIT).map((p) => {
    const prevRank = previousRankByPmid.get(p.pmid);
    const rankDelta =
      prevRank !== undefined ? prevRank - p.rank : null;
    const isNew = prevRank === undefined && previousRankByPmid.size > 0;
    return { ...p, prev_rank: prevRank ?? null, rank_delta: rankDelta, is_new: isNew };
  });

  const response = NextResponse.json({
    papers,
    window: "week",
    weekStartsOn,
    hasPreviousWeek: previousRankByPmid.size > 0,
    generatedAt: new Date().toISOString(),
  });

  response.headers.set(
    "Cache-Control",
    "public, s-maxage=600, stale-while-revalidate=1800"
  );

  return response;
}
