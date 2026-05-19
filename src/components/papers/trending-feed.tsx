"use client";

import { BarChart3, TrendingUp } from "lucide-react";
import { PaperCard } from "@/components/papers/paper-card";
import { PaperCardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useTrending } from "@/hooks/use-trending";
import type { PaperWithJournal } from "@/types/filters";

interface TrendingAnalysis {
  ai_summary: string | null;
  stats_json: unknown;
  date: string;
}

interface TrendingFeedProps {
  initialPapers?: PaperWithJournal[];
  analysis?: TrendingAnalysis | null;
}

export function TrendingFeed({ initialPapers, analysis }: TrendingFeedProps) {
  const { papers, isLoading, error } = useTrending(initialPapers);
  const topTopics = (
    analysis?.stats_json as { topTopics?: Array<{ name: string; count: number }> } | null
  )?.topTopics;

  return (
    <div className="min-w-0 border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="sticky top-14 z-20 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-gray-900 dark:text-gray-100" />
          <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Trending
          </h1>
          {papers.length > 0 && (
            <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
              Last 6 months
            </span>
          )}
        </div>
      </div>

      {analysis && (
        <div className="border-b border-gray-200 px-4 py-5 dark:border-gray-800">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-gray-900 dark:text-gray-100">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            이번 달 연구 동향
          </h2>
          <div className="whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {analysis.ai_summary}
          </div>
          {topTopics && topTopics.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {topTopics.map((t) => (
                <span
                  key={t.name}
                  className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                >
                  {t.name} · {t.count}편
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="divide-y divide-gray-200 dark:divide-gray-800">
          {Array.from({ length: 5 }).map((_, i) => (
            <PaperCardSkeleton key={i} />
          ))}
        </div>
      ) : papers.length === 0 ? (
        // Only fall back to the error/empty UI when there is nothing to
        // show. A failed *revalidation* must not discard valid papers that
        // were already rendered (e.g. from the SSR fallback).
        error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Failed to load trending papers
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Please try again later.
            </p>
          </div>
        ) : (
          <EmptyState
            icon={<TrendingUp className="h-12 w-12" />}
            title="No trending papers yet"
            description="Most cited papers from the last 6 months will appear here."
          />
        )
      ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-800">
          {papers.map((paper, index) => (
            <div key={paper.id} className="relative">
              <div className="absolute left-4 top-4 z-10 flex items-center gap-1.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  {index + 1}
                </span>
                {paper.citation_count !== null && paper.citation_count > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    {paper.citation_count} citations
                  </span>
                )}
              </div>
              <div className="pt-8">
                <PaperCard paper={paper} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
