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

        {/* Top widgets: 2-column on md+, stacked on mobile.
            The [&>section]:border-t-0 selectors suppress inherited top borders
            inside child components (ClinicalTrialSummary wraps itself with
            border-t for its original context). */}
        <div className="grid grid-cols-1 border-b border-gray-200 lg:grid-cols-2 lg:divide-x lg:divide-gray-200 [&>*>div]:border-t-0 dark:border-gray-800 dark:lg:divide-gray-800">
          <div className="min-w-0 border-b border-gray-200 lg:border-b-0 dark:border-gray-800">
            <ClinicalTrialSummary
              onItemClick={handleHighlightClick}
              showViewAll={false}
            />
          </div>
          <div className="min-w-0">
            <TrendingTopicsPanel onTopicClick={handleTopicClick} />
          </div>
        </div>

        {/* Full-width main feed */}
        <ClinicalTrialMonitorPanel onSelectStudy={handleSelectStudy} />
      </div>
    </div>
  );
}
