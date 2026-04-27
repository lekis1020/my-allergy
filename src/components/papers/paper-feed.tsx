"use client";

import { useRef, useEffect, useCallback } from "react";
import { PaperCard } from "./paper-card";
import { PaperCardSkeleton } from "@/components/ui/skeleton";
import { AdBanner } from "@/components/ads/ad-banner";
import type { PaperWithJournal, ArticleType } from "@/types/filters";
import { ARTICLE_TYPE_LABELS } from "@/types/filters";
import { Loader2, FileSearch } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { DataSource } from "@/hooks/use-papers";

const AD_INTERVAL = 12;

const ARTICLE_TYPES: ArticleType[] = [
  "original",
  "review",
  "rct",
  "systematic_review",
  "meta_analysis",
  "retrospective",
  "case_report",
];

interface PaperFeedProps {
  papers: PaperWithJournal[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  personalized?: boolean;
  articleType?: ArticleType;
  onArticleTypeChange?: (type: ArticleType | undefined) => void;
  dataSource?: DataSource;
  isLiveLoading?: boolean;
}

export function PaperFeed({
  papers,
  total,
  hasMore,
  isLoading,
  isLoadingMore,
  onLoadMore,
  personalized = false,
  articleType,
  onArticleTypeChange,
  dataSource,
  isLiveLoading,
}: PaperFeedProps) {
  const observerRef = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !isLoadingMore) {
        onLoadMore();
      }
    },
    [hasMore, isLoadingMore, onLoadMore]
  );

  useEffect(() => {
    const element = observerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleObserver, {
      threshold: 0,
      rootMargin: "200px",
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [handleObserver]);

  const typeFilter = onArticleTypeChange ? (
    <div className="flex flex-wrap gap-1.5 border-b border-gray-200 px-3 py-2 dark:border-gray-800">
      <button
        type="button"
        onClick={() => onArticleTypeChange(undefined)}
        aria-label="Show all article types"
        aria-pressed={!articleType}
        className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
          !articleType
            ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
        }`}
      >
        All
      </button>
      {ARTICLE_TYPES.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onArticleTypeChange(articleType === t ? undefined : t)}
          aria-label={`Filter by ${ARTICLE_TYPE_LABELS[t]}`}
          aria-pressed={articleType === t}
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
            articleType === t
              ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          }`}
        >
          {ARTICLE_TYPE_LABELS[t]}
        </button>
      ))}
    </div>
  ) : null;

  if (isLoading) {
    return (
      <div>
        {typeFilter}
        <div className="divide-y divide-gray-200 dark:divide-gray-800">
          {Array.from({ length: 5 }).map((_, i) => (
            <PaperCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (papers.length === 0) {
    return (
      <div>
        {typeFilter}
        <EmptyState
          icon={<FileSearch className="h-12 w-12" />}
          title="No papers found"
          description={
            personalized
              ? "We need a bit more feedback to personalize. Try bookmarks, keyword alerts, or the Timeline tab."
              : articleType
                ? `No ${ARTICLE_TYPE_LABELS[articleType]} papers found. Try removing the filter.`
                : "Try adjusting your filters or search terms"
          }
        />
      </div>
    );
  }

  const totalLabel = personalized
    ? `${total.toLocaleString()} papers ranked for you`
    : `${total.toLocaleString()} papers in your timeline`;

  return (
    <div>
      {typeFilter}
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-2 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <span>{totalLabel}</span>
        {(isLiveLoading || dataSource === "db+live") && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:bg-red-950/40 dark:text-red-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            PubMed 실시간 검색 중...
          </span>
        )}
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-800">
        {papers.map((paper, index) => (
          <div key={paper.id}>
            <PaperCard paper={paper} />
            {(index + 1) % AD_INTERVAL === 0 && (
              <AdBanner variant="feed-inline" />
            )}
          </div>
        ))}
      </div>

      <div ref={observerRef} className="flex justify-center py-8">
        {isLoadingMore && (
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        )}
        {!hasMore && papers.length > 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            All papers loaded
          </p>
        )}
      </div>
    </div>
  );
}
