"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, TrendingUp } from "lucide-react";
import { PaperCard } from "@/components/papers/paper-card";
import { PaperCardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useTrending, type TrendingWindow, type WeeklyPaperWithDelta } from "@/hooks/use-trending";
import type { PaperWithJournal } from "@/types/filters";
import { formatDate } from "@/lib/utils/date";
import { decodeHtmlEntities } from "@/lib/utils/html-entities";

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
  const [window, setWindow] = useState<TrendingWindow>("default");
  const trending = useTrending(window, initialPapers);
  const topTopics = (
    analysis?.stats_json as { topTopics?: Array<{ name: string; count: number }> } | null
  )?.topTopics;

  return (
    <div className="min-w-0 border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      {/* Sticky header + subtab row */}
      <div className="sticky top-14 z-20 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-gray-900 dark:text-gray-100" />
          <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Trending
          </h1>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-[12px] font-medium dark:border-gray-700 dark:bg-gray-900">
            <button
              type="button"
              onClick={() => setWindow("default")}
              className={`rounded-md px-3 py-1 transition-colors ${
                window === "default"
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
              }`}
            >
              기본
            </button>
            <button
              type="button"
              onClick={() => setWindow("week")}
              className={`rounded-md px-3 py-1 transition-colors ${
                window === "week"
                  ? "bg-violet-600 text-white"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
              }`}
            >
              이번 주
            </button>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {window === "week"
              ? trending.weekStartsOn
                ? `${trending.weekStartsOn} ~ (7일) · 활동 + IF`
                : "이번 주 · 활동 + IF"
              : "Last 6 months · 인용수 기준"}
          </span>
        </div>
      </div>

      {window === "default" ? (
        <DefaultView
          analysis={analysis}
          topTopics={topTopics}
          papers={trending.papers}
          isLoading={trending.isLoading}
          error={trending.error}
        />
      ) : (
        <WeekView
          papers={trending.weekPapers}
          hasPreviousWeek={trending.hasPreviousWeek}
          isLoading={trending.isLoading}
          error={trending.error}
        />
      )}
    </div>
  );
}

function DefaultView({
  analysis,
  topTopics,
  papers,
  isLoading,
  error,
}: {
  analysis: TrendingAnalysis | null | undefined;
  topTopics: Array<{ name: string; count: number }> | undefined;
  papers: PaperWithJournal[];
  isLoading: boolean;
  error: unknown;
}) {
  return (
    <>
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
    </>
  );
}

function WeekView({
  papers,
  hasPreviousWeek,
  isLoading,
  error,
}: {
  papers: WeeklyPaperWithDelta[];
  hasPreviousWeek: boolean;
  isLoading: boolean;
  error: unknown;
}) {
  const allFallback = papers.length > 0 && papers.every((p) => p.is_fallback);

  return (
    <>
      <div className="border-b border-gray-200 bg-violet-50/50 px-4 py-3 text-xs text-violet-900 dark:border-gray-800 dark:bg-violet-950/20 dark:text-violet-200">
        <p>
          <strong>이번 주 나온 논문</strong>을 사용자 반응(북마크·라이크·댓글)과
          저널 IF로 랭킹합니다. 활동이 없으면 IF·발행일 순으로 fallback.
        </p>
      </div>

      {isLoading ? (
        <div className="divide-y divide-gray-200 dark:divide-gray-800">
          {Array.from({ length: 5 }).map((_, i) => (
            <PaperCardSkeleton key={i} />
          ))}
        </div>
      ) : papers.length === 0 ? (
        error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Failed to load this week&apos;s papers
            </p>
          </div>
        ) : (
          <EmptyState
            icon={<TrendingUp className="h-12 w-12" />}
            title="이번 주엔 아직 논문이 없어요"
            description="이번 주 발행 논문이 아직 인덱스에 반영되지 않았습니다. 잠시 후 다시 확인해주세요."
          />
        )
      ) : (
        <>
          {allFallback && (
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-[11px] text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
              📭 이번 주엔 아직 사이트 활동이 없어요. IF·최신순으로 보여드리는 중.
            </div>
          )}
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {papers.map((p) => (
              <WeekPaperRow key={p.pmid} paper={p} hasPreviousWeek={hasPreviousWeek} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function WeekPaperRow({
  paper,
  hasPreviousWeek,
}: {
  paper: WeeklyPaperWithDelta;
  hasPreviousWeek: boolean;
}) {
  return (
    <Link
      href={`/paper/${paper.pmid}`}
      className="block px-4 py-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-900/50"
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
          {paper.rank}
        </span>
        {paper.is_fallback ? (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            IF fallback
          </span>
        ) : (
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            score {paper.score.toFixed(1)}
          </span>
        )}
        {hasPreviousWeek && paper.is_new && (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300">
            NEW
          </span>
        )}
        {hasPreviousWeek && paper.rank_delta !== null && paper.rank_delta > 0 && (
          <span className="rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:border-blue-800/50 dark:bg-blue-950/40 dark:text-blue-300">
            ↑ {paper.rank_delta}
          </span>
        )}
        {hasPreviousWeek && paper.rank_delta !== null && paper.rank_delta < 0 && (
          <span className="rounded-full border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
            ↓ {Math.abs(paper.rank_delta)}
          </span>
        )}
      </div>
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span
          className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
          style={{ background: paper.journal.color }}
        >
          {paper.journal.abbreviation}
        </span>
        {paper.impact_factor !== null && <span>IF {paper.impact_factor}</span>}
        {paper.epub_date && <span>· {formatDate(paper.epub_date)}</span>}
      </div>
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        {decodeHtmlEntities(paper.title)}
      </p>
      <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
        🔖 <strong>{paper.bookmark_count}</strong> · ❤ <strong>{paper.like_count}</strong> · 💬{" "}
        <strong>{paper.comment_count}</strong>
        {paper.citation_count > 0 && (
          <>
            {" "}
            · ❝ <strong>{paper.citation_count}</strong>
          </>
        )}
      </p>
    </Link>
  );
}
