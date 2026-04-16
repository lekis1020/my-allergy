"use client";

import { MessagesSquare } from "lucide-react";
import { PaperFeed } from "@/components/papers/paper-feed";
import { useAgora } from "@/hooks/use-agora";

export default function AgoraPage() {
  const { papers, total, hasMore, isLoading, isLoadingMore, loadMore } = useAgora();

  return (
    <div className="mx-auto w-full max-w-[1280px] px-0 sm:px-4 sm:py-4">
      <div className="grid min-h-[calc(100vh-56px)] grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <div className="hidden lg:block" />

        <div className="min-w-0 border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
          <div className="sticky top-14 z-20 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
            <div className="px-4 pb-3 pt-3">
              <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                <MessagesSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Agora
              </h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                동료들이 토론 중인 논문 — 댓글이 달린 논문만 최근 댓글 순으로 모았습니다.
              </p>
            </div>
          </div>

          {!isLoading && papers.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
              <MessagesSquare className="h-10 w-10 text-gray-300 dark:text-gray-600" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                아직 댓글이 달린 논문이 없습니다
              </p>
              <p className="max-w-sm text-xs text-gray-500 dark:text-gray-500">
                관심 있는 논문 상세 페이지에서 첫 댓글을 남겨 토론을 시작해보세요.
              </p>
            </div>
          ) : (
            <PaperFeed
              papers={papers}
              total={total}
              hasMore={hasMore ?? false}
              isLoading={isLoading}
              isLoadingMore={isLoadingMore ?? false}
              onLoadMore={loadMore}
            />
          )}
        </div>

        <div className="hidden xl:block" />
      </div>
    </div>
  );
}
