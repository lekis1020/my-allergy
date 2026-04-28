import type { Metadata } from "next";
import { Suspense } from "react";
import { BarChart3 } from "lucide-react";
import { createAnonClient } from "@/lib/supabase/server";
import { toPaperDto, type PaperRow } from "@/lib/papers/transform";
import { TrendingFeed } from "@/components/papers/trending-feed";
import { PaperCardSkeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Trending | My Allergy",
};

export const dynamic = "force-dynamic";

const POOL_SIZE = 50;
const RESULT_LIMIT = 10;

async function fetchTrendingPapers() {
  const supabase = createAnonClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 180);
  const fromDate = cutoff.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("papers")
    .select(
      `
      id, pmid, doi, title, abstract, publication_date, epub_date,
      volume, issue, pages, keywords, mesh_terms, citation_count, journal_id, publication_types,
      journals!inner (id, name, abbreviation, color, slug),
      paper_authors (last_name, first_name, initials, affiliation, position)
    `
    )
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

  const allPapers = (data || []).map((row) => toPaperDto(row as unknown as PaperRow));

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
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-[1280px] px-0 sm:px-4 sm:py-4">
          <div className="mx-auto max-w-2xl border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {Array.from({ length: 5 }).map((_, i) => (
                <PaperCardSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      }
    >
      {analysis && (
        <div className="border-b border-gray-200 px-4 py-5 dark:border-gray-800">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-gray-900 dark:text-gray-100">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            이번 달 연구 동향
          </h2>
          <div className="whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {analysis.ai_summary}
          </div>
          {(analysis.stats_json as any)?.topTopics && (
            <div className="mt-4 flex flex-wrap gap-2">
              {((analysis.stats_json as any).topTopics as Array<{ name: string; count: number }>).map((t) => (
                <span key={t.name} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  {t.name} · {t.count}편
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      <TrendingFeed initialPapers={papers} />
    </Suspense>
  );
}
