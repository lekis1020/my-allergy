"use client";

import { useState, useMemo } from "react";
import { Clock, Bookmark, MessageCircle } from "lucide-react";
import { PaperCard } from "@/components/papers/paper-card";
import { PaperCardSkeleton } from "@/components/ui/skeleton";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useAuth } from "@/hooks/use-auth";
import type { PaperWithJournal } from "@/types/filters";
import type { HistoryInitialData } from "@/lib/papers/fetch-history";

type FilterTab = "all" | "bookmarks" | "chat";

interface HistoryFeedProps {
  initialData?: HistoryInitialData;
}

export function HistoryFeed({ initialData }: HistoryFeedProps) {
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterTab>("all");
  const { pmids, loading: bookmarksLoading } = useBookmarks();

  // Use server-prefetched data if available, otherwise wait for client fetch
  const hasServerData = initialData?.authenticated && initialData.bookmarkedPapers.length > 0;

  const bookmarkedPapers = hasServerData
    ? initialData.bookmarkedPapers
    : [];
  const chatPapers = hasServerData
    ? initialData.chatPapers
    : [];
  const chatSessions = initialData?.chatSessions ?? [];

  const chatPmidSet = useMemo(
    () => new Set(chatSessions.map((s) => s.paper_pmid)),
    [chatSessions],
  );
  const bookmarkPmidSet = useMemo(() => new Set(pmids), [pmids]);

  const allPapers = useMemo(() => {
    const combined = [...bookmarkedPapers, ...chatPapers];
    return combined.filter(
      (p, i, arr) => arr.findIndex((x) => x.pmid === p.pmid) === i,
    );
  }, [bookmarkedPapers, chatPapers]);

  const filteredPapers = useMemo(() => {
    if (filter === "bookmarks") return allPapers.filter((p) => bookmarkPmidSet.has(p.pmid));
    if (filter === "chat") return allPapers.filter((p) => chatPmidSet.has(p.pmid));
    return allPapers;
  }, [filter, allPapers, bookmarkPmidSet, chatPmidSet]);

  const showSkeleton = !hasServerData && (bookmarksLoading || !user);

  const tabClass = (tab: FilterTab) =>
    `px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
      filter === tab
        ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
        : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
    }`;

  return (
    <div className="mx-auto w-full max-w-[1280px] px-0 sm:px-4 sm:py-4">
      <div className="mx-auto max-w-2xl border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="sticky top-14 z-20 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-900 dark:text-gray-100" />
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              History
            </h1>
          </div>
          <div className="mt-2 flex gap-1.5">
            <button onClick={() => setFilter("all")} className={tabClass("all")}>
              전체
            </button>
            <button onClick={() => setFilter("bookmarks")} className={tabClass("bookmarks")}>
              북마크
            </button>
            <button onClick={() => setFilter("chat")} className={tabClass("chat")}>
              AI 채팅
            </button>
          </div>
        </div>

        {showSkeleton ? (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {Array.from({ length: 3 }).map((_, i) => (
              <PaperCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredPapers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Clock className="mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" />
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
              기록이 없습니다
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              논문을 북마크하거나 AI Chat을 이용하면 여기에 표시됩니다.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {filteredPapers.map((paper) => (
              <div key={paper.pmid} className="relative">
                <div className="absolute right-3 top-3 flex gap-1">
                  {bookmarkPmidSet.has(paper.pmid) && (
                    <Bookmark className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  )}
                  {chatPmidSet.has(paper.pmid) && (
                    <MessageCircle className="h-3.5 w-3.5 text-purple-500" />
                  )}
                </div>
                <PaperCard paper={paper} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
