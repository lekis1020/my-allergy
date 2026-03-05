"use client";

import { Suspense, useState } from "react";
import { RightRail } from "@/components/layout/right-rail";
import { TopicMonitorPanel } from "@/components/layout/topic-monitor-panel";
import { MobileDrawer } from "@/components/layout/mobile-drawer";
import { useMobileDrawer } from "@/components/layout/mobile-drawer-context";
import { PaperFeed } from "@/components/papers/paper-feed";
import { FilterBar } from "@/components/papers/filter-bar";
import { SearchInput } from "@/components/papers/search-input";
import { usePaperFilters } from "@/hooks/use-paper-filters";
import { usePapers } from "@/hooks/use-papers";
import { PaperCardSkeleton } from "@/components/ui/skeleton";
import { JOURNALS } from "@/lib/constants/journals";
import { JournalCloud } from "@/components/papers/journal-cloud";

function HomePage() {
  const { filters, setFilters, clearFilters, hasActiveFilters } = usePaperFilters();
  const { papers, total, hasMore, isLoading, isLoadingMore, loadMore } = usePapers(filters);
  const { open: drawerOpen, close: closeDrawer } = useMobileDrawer();
  const [cloudOpen, setCloudOpen] = useState(false);

  const handleRemoveFilter = (key: string, value?: string) => {
    if (key === "journals" && value) {
      const updated = (filters.journals || []).filter((s) => s !== value);
      setFilters({ journals: updated.length > 0 ? updated : undefined });
    } else {
      setFilters({ [key]: undefined });
    }
  };

  const activeSort = filters.sort || "date_desc";

  const setSortTab = (sort: "date_desc" | "citations") => {
    setFilters({ sort });
  };

  const toggleJournal = (slug: string) => {
    const current = filters.journals || [];
    const updated = current.includes(slug)
      ? current.filter((s) => s !== slug)
      : [...current, slug];

    setFilters({ journals: updated.length > 0 ? updated : undefined });
  };

  const handleDrawerActivate = (topic: string) => {
    setFilters({ q: topic, sort: "date_desc" });
    closeDrawer();
  };

  return (
    <div className="mx-auto w-full max-w-[1280px] px-0 sm:px-4 sm:py-4">
      <MobileDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        activeQuery={filters.q}
        onActivate={handleDrawerActivate}
        onClearActive={() => setFilters({ q: undefined })}
        total={total}
        papers={papers}
      />
      <div className="grid min-h-[calc(100vh-56px)] grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <div className="hidden lg:block lg:pr-4">
          <div className="sticky top-20 max-h-[calc(100vh-96px)] overflow-y-auto pr-1">
            <TopicMonitorPanel
              activeQuery={filters.q}
              onActivate={(topic) => setFilters({ q: topic, sort: "date_desc" })}
              onClearActive={() => setFilters({ q: undefined })}
            />
          </div>
        </div>

        <div className="min-w-0 border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
          <div className="sticky top-14 z-20 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
            <div className="px-4 pt-3">
              <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Home</h1>
            </div>

            <div className="mt-3 grid grid-cols-2 text-sm">
              <button
                onClick={() => setSortTab("date_desc")}
                className={`border-b-2 px-3 py-3 font-semibold transition-colors ${
                  activeSort === "date_desc"
                    ? "border-blue-500 text-gray-900 dark:text-gray-100"
                    : "border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-200"
                }`}
              >
                For you
              </button>
              <button
                onClick={() => setSortTab("citations")}
                className={`border-b-2 px-3 py-3 font-semibold transition-colors ${
                  activeSort === "citations"
                    ? "border-blue-500 text-gray-900 dark:text-gray-100"
                    : "border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-200"
                }`}
              >
                Most cited
              </button>
            </div>

            <div className="px-4 pb-3 pt-2">
              <SearchInput
                value={filters.q || ""}
                onChange={(q) => setFilters({ q: q || undefined })}
                placeholder="Search topic, PMID, DOI"
              />
            </div>

            <div className="border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={() => setCloudOpen((v) => !v)}
                className="flex w-full items-center justify-center gap-1 px-4 py-1.5 text-xs text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                <span>Journals{filters.journals?.length ? ` (${filters.journals.length})` : ""}</span>
                <svg
                  className={`h-3 w-3 transition-transform ${cloudOpen ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {cloudOpen && (
                <div className="px-4 pb-2">
                  <JournalCloud
                    journals={JOURNALS}
                    activeJournals={filters.journals || []}
                    onToggle={toggleJournal}
                    onClearAll={() => setFilters({ journals: undefined })}
                  />
                </div>
              )}
            </div>
          </div>

          {hasActiveFilters && (
            <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
              <FilterBar
                filters={filters}
                onRemoveFilter={handleRemoveFilter}
                onClear={clearFilters}
              />
            </div>
          )}

          <div>
            <PaperFeed
              papers={papers}
              total={total}
              hasMore={hasMore ?? false}
              isLoading={isLoading}
              isLoadingMore={isLoadingMore ?? false}
              onLoadMore={loadMore}
            />
          </div>
        </div>

        <div className="hidden xl:block xl:pl-4">
          <div className="sticky top-20 max-h-[calc(100vh-96px)] overflow-y-auto pr-1">
            <RightRail total={total} papers={papers} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-[1280px] px-0 sm:px-4 sm:py-4">
          <div className="border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
            {Array.from({ length: 5 }).map((_, i) => (
              <PaperCardSkeleton key={i} />
            ))}
          </div>
        </div>
      }
    >
      <HomePage />
    </Suspense>
  );
}
