"use client";

import { useState } from "react";
import { ChevronRight, Flame } from "lucide-react";
import { TRENDING_CATEGORIES } from "@/lib/constants/trending-categories";
import { useTrendingTopics } from "@/hooks/use-trending-topics";

interface TrendingTopicsPanelProps {
  onTopicClick: (keyword: string) => void;
}

const CATEGORY_STYLES: Record<
  string,
  { dot: string; active: string; activeBorder: string }
> = {
  asthma: {
    dot: "bg-blue-500",
    active:
      "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    activeBorder: "border-blue-200 dark:border-blue-800",
  },
  rhinitis: {
    dot: "bg-cyan-500",
    active:
      "bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
    activeBorder: "border-cyan-200 dark:border-cyan-800",
  },
  urticaria: {
    dot: "bg-pink-500",
    active:
      "bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
    activeBorder: "border-pink-200 dark:border-pink-800",
  },
  anaphylaxis: {
    dot: "bg-rose-500",
    active:
      "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    activeBorder: "border-rose-200 dark:border-rose-800",
  },
  food_allergy: {
    dot: "bg-emerald-500",
    active:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    activeBorder: "border-emerald-200 dark:border-emerald-800",
  },
  atopic_dermatitis: {
    dot: "bg-amber-500",
    active:
      "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    activeBorder: "border-amber-200 dark:border-amber-800",
  },
  drug_allergy: {
    dot: "bg-orange-500",
    active:
      "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    activeBorder: "border-orange-200 dark:border-orange-800",
  },
  eosinophilic: {
    dot: "bg-violet-500",
    active:
      "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    activeBorder: "border-violet-200 dark:border-violet-800",
  },
  others: {
    dot: "bg-gray-400",
    active:
      "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    activeBorder: "border-gray-200 dark:border-gray-700",
  },
};

const DEFAULT_STYLE = CATEGORY_STYLES.others;

export function TrendingTopicsPanel({ onTopicClick }: TrendingTopicsPanelProps) {
  const [activeCategory, setActiveCategory] = useState(
    TRENDING_CATEGORIES[0].id,
  );
  const { topics, totalStudies, isLoading } =
    useTrendingTopics(activeCategory);

  const contentStyle =
    CATEGORY_STYLES[activeCategory] || DEFAULT_STYLE;

  return (
    <div className="px-4 py-4">
      <div className="mb-3 flex items-center gap-2">
        <Flame className="h-4 w-4 text-orange-500" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Trending Trial Outcomes
        </h2>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          Primary outcomes only
        </span>
      </div>

      {/* Bookmark-style category tabs */}
      <div className="relative">
        <div
          className="-mb-px flex gap-0.5 overflow-x-auto border-b border-gray-200 dark:border-gray-800"
          style={{ scrollbarWidth: "none" }}
        >
          {TRENDING_CATEGORIES.map((cat) => {
            const style = CATEGORY_STYLES[cat.id] || DEFAULT_STYLE;
            const isActive = activeCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-lg border border-b-0 px-3 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? `${style.active} ${style.activeBorder} z-10`
                    : "border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-2 w-2 shrink-0 rounded-full ${style.dot}`}
                />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Content area */}
        <div
          className={`rounded-b-xl border border-t-0 ${contentStyle.activeBorder} p-4`}
        >
          {isLoading ? (
            <TrendingTopicsSkeleton />
          ) : topics.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
              No ranked outcomes found for this category.
            </p>
          ) : (
            <>
              <ul className="space-y-1">
                {topics.map((topic, i) => (
                  <li key={topic.keyword}>
                    <button
                      onClick={() => onTopicClick(topic.keyword)}
                      className="group flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-900"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                        {topic.keyword}
                      </span>
                      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs tabular-nums text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        {topic.count}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 transition-colors group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-400" />
                    </button>
                  </li>
                ))}
              </ul>
              {totalStudies > 0 && (
                <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                  Based on {totalStudies} ongoing trials
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TrendingTopicsSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2.5">
          <div className="h-5 w-5 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 flex-1 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-12 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
      ))}
    </div>
  );
}
