"use client";

import { PaperFeed } from "@/components/papers/paper-feed";
import type { PapersResponse } from "@/types/filters";

interface HomePageFallbackProps {
  initialData?: PapersResponse;
}

export function HomePageFallback({ initialData }: HomePageFallbackProps) {
  const papers = initialData?.papers ?? [];

  return (
    <div className="mx-auto w-full max-w-[1280px] px-0 sm:px-4 sm:py-4">
      <div className="grid min-h-[calc(100vh-56px)] grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <div className="hidden lg:block lg:pr-4" />

        <div className="min-w-0 border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
          <div className="sticky top-14 z-20 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
            <div className="grid grid-cols-1 text-sm">
              <div className="border-b-2 border-blue-500 px-3 py-3 font-semibold text-gray-900 dark:text-gray-100">
                Timeline
              </div>
            </div>
          </div>

          <PaperFeed
            papers={papers}
            total={initialData?.total ?? 0}
            hasMore={initialData?.hasMore ?? false}
            isLoading={!initialData}
            isLoadingMore={false}
            onLoadMore={() => {}}
          />
        </div>

        <div className="hidden xl:block xl:pl-4" />
      </div>
    </div>
  );
}
