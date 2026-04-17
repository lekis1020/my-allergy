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

  return (
    <div className="mx-auto w-full max-w-[1280px] px-0 sm:px-4 sm:py-4">
      <div className="border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="sticky top-14 z-20 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
          <div className="flex items-center gap-2">
            <Microscope className="h-5 w-5 text-emerald-500" />
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Trials & Topics
            </h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
          {/* Left — Trending Highlights */}
          <div className="border-b border-gray-200 p-4 lg:border-b-0 lg:border-r dark:border-gray-800">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Trending Highlights
            </h2>
            <TrendingTopicsPanel onTopicClick={handleTopicClick} />
          </div>

          {/* Center — Clinical Trial Monitor */}
          <div className="min-w-0 border-b border-gray-200 lg:border-b-0 dark:border-gray-800">
            <ClinicalTrialMonitorPanel onSelectStudy={handleSelectStudy} />
          </div>

          {/* Right — Trending Trial Outcomes */}
          <div className="p-4 lg:border-l lg:border-gray-200 dark:lg:border-gray-800">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Trending Trial Outcomes
            </h2>
            <ClinicalTrialSummary
              onItemClick={(name) => {
                router.push(
                  `/?q=${encodeURIComponent(name)}&trial=${encodeURIComponent(name)}`
                );
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
