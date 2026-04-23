"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Microscope, X } from "lucide-react";
import { MobileDrawer } from "@/components/layout/mobile-drawer";

const RightRail = dynamic(() => import("@/components/layout/right-rail").then((m) => ({ default: m.RightRail })), { ssr: false });
const TopicMonitorPanel = dynamic(() => import("@/components/layout/topic-monitor-panel").then((m) => ({ default: m.TopicMonitorPanel })), { ssr: false });
import { useMobileDrawer } from "@/components/layout/mobile-drawer-context";
import { PaperFeed } from "@/components/papers/paper-feed";
import { FilterBar } from "@/components/papers/filter-bar";
import { SearchInput } from "@/components/papers/search-input";
import { usePaperFilters } from "@/hooks/use-paper-filters";
import { usePapers } from "@/hooks/use-papers";
import { useAuth } from "@/hooks/use-auth";
import type { ArticleType, PapersResponse } from "@/types/filters";
import { JOURNALS } from "@/lib/constants/journals";
import { JournalCloud } from "@/components/papers/journal-cloud";

type MainTab = "timeline" | "for_you";

interface HomePageProps {
  initialData?: PapersResponse;
}

export function HomePage({ initialData }: HomePageProps) {
  const searchParams = useSearchParams();
  const { filters, setFilters, clearFilters, hasActiveFilters } = usePaperFilters();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<MainTab>(user ? "for_you" : "timeline");
  const [articleType, setArticleType] = useState<ArticleType | undefined>();
  const [cloudOpen, setCloudOpen] = useState(false);
  const effectiveFilters = {
    ...filters,
    personalized: Boolean(user) && activeTab === "for_you",
    articleType,
  };
  const {
    papers,
    total,
    hasMore,
    isLoading,
    isLoadingMore,
    isValidating,
    loadMore,
    dataSource,
  } = usePapers(effectiveFilters, initialData);
  const { open: drawerOpen, close: closeDrawer } = useMobileDrawer();

  useEffect(() => {
    const q = searchParams.get("q");
    const trial = searchParams.get("trial");
    if (q || trial) {
      setActiveTab("for_you");
      setFilters({
        q: q || undefined,
        trial: trial || undefined,
        sort: "date_desc",
      });
    }
    // Only run on mount to read initial URL params
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRemoveFilter = (key: string, value?: string) => {
    if (key === "journals" && value) {
      const updated = (filters.journals || []).filter((s) => s !== value);
      setFilters({ journals: updated.length > 0 ? updated : undefined });
    } else if (key === "q" && filters.trial) {
      setFilters({ q: undefined, trial: undefined });
    } else {
      setFilters({ [key]: undefined });
    }
  };

  const handleTabChange = (tab: MainTab) => {
    setActiveTab(tab);
    setFilters({ sort: "date_desc", trial: undefined });
  };

  const toggleJournal = (slug: string) => {
    const current = filters.journals || [];
    const updated = current.includes(slug)
      ? current.filter((s) => s !== slug)
      : [...current, slug];

    setFilters({ journals: updated.length > 0 ? updated : undefined });
  };

  const handleDrawerActivate = (topic: string) => {
    setActiveTab("for_you");
    setFilters({ q: topic, sort: "date_desc", trial: undefined });
    closeDrawer();
  };

  const tabClass = (isActive: boolean) =>
    `border-b-2 px-3 py-3 font-semibold transition-colors ${
      isActive
        ? "border-blue-500 text-gray-900 dark:text-gray-100"
        : "border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-200"
    }`;

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
              onActivate={(topic) => {
                setActiveTab("for_you");
                setFilters({ q: topic, sort: "date_desc", trial: undefined });
              }}
              onClearActive={() => setFilters({ q: undefined, trial: undefined })}
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
                onClick={() => handleTabChange("timeline")}
                className={tabClass(activeTab === "timeline")}
              >
                Timeline
              </button>
              <button
                onClick={() => handleTabChange("for_you")}
                className={tabClass(activeTab === "for_you")}
              >
                For you
              </button>
            </div>

            {(
              <>
                <div className="px-4 pb-3 pt-2">
                  <SearchInput
                    value={filters.q || ""}
                    onChange={(q) => setFilters({ q: q || undefined, trial: undefined })}
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
              </>
            )}

            {filters.trial && (
              <div className="border-t border-gray-200 px-4 py-3 dark:border-gray-800">
                <div className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-3 py-3 dark:border-emerald-900/70 dark:bg-emerald-950/30">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800 dark:text-emerald-300">
                      <Microscope className="h-3.5 w-3.5" />
                      Active trial filter
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {filters.trial}
                    </p>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                      Timeline is showing papers matched from this trial&apos;s intervention and condition keywords.
                    </p>
                  </div>
                  <button
                    onClick={() => setFilters({ q: undefined, trial: undefined })}
                    className="rounded-full p-1 text-emerald-700 transition-colors hover:bg-emerald-100 hover:text-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-900/50 dark:hover:text-emerald-100"
                    aria-label="Clear active trial filter"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <>
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
                personalized={activeTab === "for_you" && Boolean(user)}
                articleType={articleType}
                onArticleTypeChange={setArticleType}
                dataSource={dataSource}
                isLiveLoading={isValidating && Boolean(filters.q)}
              />
            </div>
          </>
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
