"use client";

import { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import { PaperCard } from "@/components/papers/paper-card";
import { PaperCardSkeleton } from "@/components/ui/skeleton";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { buildApiUrl } from "@/lib/utils/url";
import type { PaperWithJournal, PapersResponse } from "@/types/filters";

export default function BookmarksPage() {
  const { pmids, loading: bookmarksLoading } = useBookmarks();
  const [papers, setPapers] = useState<PaperWithJournal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (bookmarksLoading) return;

    if (pmids.length === 0) {
      setPapers([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const url = buildApiUrl("/api/papers", {
      pmids: pmids.join(","),
      limit: 100,
    });

    fetch(url)
      .then((res) => res.json())
      .then((data: PapersResponse) => {
        if (!cancelled) setPapers(data.papers);
      })
      .catch(() => {
        if (!cancelled) setPapers([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pmids, bookmarksLoading]);

  const showSkeleton = bookmarksLoading || isLoading;

  return (
    <div className="mx-auto w-full max-w-[1280px] px-0 sm:px-4 sm:py-4">
      <div className="mx-auto max-w-2xl border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="sticky top-14 z-20 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
          <div className="flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-gray-900 dark:text-gray-100" />
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Bookmarks
            </h1>
            {papers.length > 0 && (
              <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
                {papers.length} saved
              </span>
            )}
          </div>
        </div>

        {showSkeleton ? (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {Array.from({ length: 3 }).map((_, i) => (
              <PaperCardSkeleton key={i} />
            ))}
          </div>
        ) : papers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bookmark className="mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" />
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
              No saved papers yet
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Bookmark papers to see them here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {papers.map((paper) => (
              <PaperCard key={paper.id} paper={paper} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
