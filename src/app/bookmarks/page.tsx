"use client";

import { useState } from "react";
import { Clock, Bookmark, MessageCircle } from "lucide-react";
import useSWR from "swr";
import { PaperCard } from "@/components/papers/paper-card";
import { PaperCardSkeleton } from "@/components/ui/skeleton";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useAuth } from "@/hooks/use-auth";
import { buildApiUrl } from "@/lib/utils/url";
import type { PaperWithJournal, PapersResponse } from "@/types/filters";

type FilterTab = "all" | "bookmarks" | "chat";

interface ChatSessionItem {
  paper_pmid: string;
  message_count: number;
  updated_at: string;
}

const papersFetcher = (url: string) =>
  fetch(url)
    .then((res) => res.json())
    .then((data: PapersResponse) => data.papers);

const chatFetcher = (url: string) =>
  fetch(url)
    .then((res) => res.json())
    .then((data: { sessions: ChatSessionItem[] }) => data.sessions);

export default function HistoryPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterTab>("all");
  const { pmids, loading: bookmarksLoading } = useBookmarks();

  // Fetch bookmarked papers
  const bookmarkUrl =
    !bookmarksLoading && pmids.length > 0
      ? buildApiUrl("/api/papers", { pmids: pmids.join(","), limit: 100 })
      : null;
  const { data: bookmarkedPapers = [], isLoading: bkLoading } =
    useSWR<PaperWithJournal[]>(bookmarkUrl, papersFetcher, { revalidateOnFocus: false });

  // Fetch chat sessions
  const { data: chatSessions = [], isLoading: chatLoading } =
    useSWR<ChatSessionItem[]>(user ? "/api/chat/history" : null, chatFetcher, {
      revalidateOnFocus: false,
    });

  // Fetch papers for chat sessions (pmids not already in bookmarks)
  const chatPmids = chatSessions.map((s) => s.paper_pmid);
  const chatOnlyPmids = chatPmids.filter((p) => !pmids.includes(p));
  const chatPapersUrl =
    chatOnlyPmids.length > 0
      ? buildApiUrl("/api/papers", { pmids: chatOnlyPmids.join(","), limit: 100 })
      : null;
  const { data: chatPapers = [] } = useSWR<PaperWithJournal[]>(
    chatPapersUrl,
    papersFetcher,
    { revalidateOnFocus: false }
  );

  const chatPmidSet = new Set(chatPmids);
  const bookmarkPmidSet = new Set(pmids);
  const allPapers = [...bookmarkedPapers, ...chatPapers];
  const uniquePapers = allPapers.filter(
    (p, i, arr) => arr.findIndex((x) => x.pmid === p.pmid) === i
  );

  const filteredPapers =
    filter === "bookmarks"
      ? uniquePapers.filter((p) => bookmarkPmidSet.has(p.pmid))
      : filter === "chat"
        ? uniquePapers.filter((p) => chatPmidSet.has(p.pmid))
        : uniquePapers;

  const showSkeleton = bookmarksLoading || bkLoading || chatLoading;

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
