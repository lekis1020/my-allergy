"use client";

import { useRouter } from "next/navigation";
import { Microscope } from "lucide-react";
import { ClinicalTrialMonitorPanel } from "@/components/layout/clinical-trial-monitor-panel";
import { TrendingTopicsPanel } from "@/components/papers/trending-topics-panel";
import { ClinicalTrialSummary } from "@/components/papers/clinical-trial-summary";

export function ClinicalTrialsFeed() {
  const router = useRouter();

  const handleSelectStudy = (relatedQuery: string, title: string) => {
    router.push(
      `/?q=${encodeURIComponent(relatedQuery)}&trial=${encodeURIComponent(title)}`,
    );
  };

  const handleTopicClick = (keyword: string) => {
    router.push(`/?q=${encodeURIComponent(keyword)}`);
  };

  const handleHighlightClick = (name: string) => {
    router.push(
      `/?q=${encodeURIComponent(name)}&trial=${encodeURIComponent(name)}`,
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1280px] px-0 sm:px-4 sm:py-4">
      <div className="border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        {/* Page header */}
        <div className="sticky top-14 z-20 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
          <div className="flex items-center gap-2">
            <Microscope className="h-5 w-5 text-emerald-500" />
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Trials &amp; Topics
            </h1>
            <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
              Ongoing studies + trending outcomes
            </span>
          </div>
        </div>

        {/* Two-column layout: leaderboard sidebar on the left, the Clinical
            Trial Monitor as the central main page. Stacks on mobile.
            The [&>div]:border-t-0 selector suppresses the border-t that
            ClinicalTrialSummary wraps itself with for its original context. */}
        <div className="lg:flex lg:divide-x lg:divide-gray-200 dark:lg:divide-gray-800">
          {/* Left sidebar: Trial Highlights + Trending Trial Outcomes leaderboards */}
          <aside className="shrink-0 border-b border-gray-200 lg:w-80 lg:border-b-0 dark:border-gray-800">
            <div className="[&>div]:border-t-0">
              <ClinicalTrialSummary
                onItemClick={handleHighlightClick}
                showViewAll={false}
              />
            </div>
            <div className="border-t border-gray-200 dark:border-gray-800">
              <TrendingTopicsPanel onTopicClick={handleTopicClick} />
            </div>
          </aside>

          {/* Center main page: Clinical Trial Monitor */}
          <main className="min-w-0 flex-1 [&>section]:border-b-0">
            <ClinicalTrialMonitorPanel onSelectStudy={handleSelectStudy} />
          </main>
        </div>
      </div>
    </div>
  );
}
