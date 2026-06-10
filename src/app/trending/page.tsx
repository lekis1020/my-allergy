import type { Metadata } from "next";
import { createAnonClient } from "@/lib/supabase/server";
import { toPaperDto, PAPER_FEED_SELECT } from "@/lib/papers/transform";
import { TrendingFeed } from "@/components/papers/trending-feed";
import { TrendingInsightsDrawer } from "@/components/papers/trending-insights-drawer";
import { TopFirstAuthors } from "@/components/insights/top-first-authors";
import { FirstAuthorGeography } from "@/components/insights/first-author-geography";

export const metadata: Metadata = {
  title: "Trending | My Allergy",
};

// Trending data only shifts as citations are refreshed (every few hours), so
// the page does not need a fresh server render per request. ISR serves a
// cached render and regenerates every 30 minutes — this removes the
// per-request blocking on the (cold-slow) trending query.
export const revalidate = 1800;

const POOL_SIZE = 50;
const RESULT_LIMIT = 10;

async function fetchTrendingPapers() {
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
    console.error("[fetchTrendingPapers] error:", error);
    return [];
  }

  const allPapers = (data || []).map((row) => toPaperDto(row));

  // Keep only papers with at least one allergy-related topic tag
  return allPapers
    .filter((p) => p.topic_tags.some((tag) => tag !== "others"))
    .slice(0, RESULT_LIMIT);
}

async function fetchTrendingAnalysis() {
  const supabase = createAnonClient();
  const { data } = await supabase
    .from("trending_analysis")
    .select("ai_summary, stats_json, date")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

export default async function TrendingPage() {
  const [papers, analysis] = await Promise.all([
    fetchTrendingPapers(),
    fetchTrendingAnalysis(),
  ]);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-0 sm:px-4 sm:py-4">
      <div className="grid min-h-[calc(100vh-56px)] grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        {/* Left sidebar: top first authors leaderboard (xl+ only) */}
        <div className="hidden xl:block xl:pr-4">
          <div className="sticky top-20 max-h-[calc(100vh-96px)] overflow-y-auto pr-1">
            <TopFirstAuthors />
          </div>
        </div>

        {/* Center: trending feed */}
        <TrendingFeed initialPapers={papers} analysis={analysis} />

        {/* Right sidebar: first author geography (xl+ only) */}
        <div className="hidden xl:block xl:pl-4">
          <div className="sticky top-20 max-h-[calc(100vh-96px)] overflow-y-auto pr-1">
            <FirstAuthorGeography />
          </div>
        </div>
      </div>

      {/* Below xl: both insight widgets surface through a slide-in drawer */}
      <TrendingInsightsDrawer />
    </div>
  );
}
