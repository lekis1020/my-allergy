"use client";

import { useRef, useEffect, useCallback } from "react";
import { PaperCard } from "./paper-card";
import { PaperCardSkeleton } from "@/components/ui/skeleton";
import { AdBanner } from "@/components/ads/ad-banner";
import type { PaperWithJournal } from "@/types/filters";
import { Loader2 } from "lucide-react";

const AD_INTERVAL = 5;

export type FeedMode = "latest" | "personalized";

interface PaperFeedProps {
  papers: PaperWithJournal[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  mode?: FeedMode;
  onModeChange?: (mode: FeedMode) => void;
  showModeToggle?: boolean;
}

export function PaperFeed({
  papers,
  total,
  hasMore,
  isLoading,
  isLoadingMore,
  onLoadMore,
  mode = "latest",
  onModeChange,
  showModeToggle = false,
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

  const modeToggle = showModeToggle && onModeChange ? (
    <div className="flex gap-1 border-b border-gray-200 px-2 py-1 text-xs dark:border-gray-800">
      {(["latest", "personalized"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onModeChange(m)}
          className={`rounded-full px-3 py-1 font-medium transition-colors ${
            mode === m
              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              : "text-gray-500 hover:bg-gray-50 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-200"
          }`}
        >
          {m === "latest" ? "Latest" : "For me"}
        </button>
      ))}
    </div>
  ) : null;

  if (isLoading) {
    return (
      <div>
        {modeToggle}
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
        {modeToggle}
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
            No papers found
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {mode === "personalized"
              ? "We need a bit more feedback to personalize. Try bookmarks, keyword alerts, or the latest tab."
              : "Try adjusting your filters or search terms"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {modeToggle}
      <div className="border-b border-gray-200 px-4 py-2 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        {mode === "personalized"
          ? `${total.toLocaleString()} papers ranked for you`
          : `${total.toLocaleString()} papers in your timeline`}
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
