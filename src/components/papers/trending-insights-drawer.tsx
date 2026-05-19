"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, X } from "lucide-react";
import { TopFirstAuthors } from "@/components/insights/top-first-authors";
import { FirstAuthorGeography } from "@/components/insights/first-author-geography";

/**
 * Below the xl breakpoint the Trending page sidebars are hidden, so their
 * insight widgets (Top First Authors, First Author Geography) are surfaced
 * here through a slide-in drawer triggered by a floating button.
 */
export function TrendingInsightsDrawer() {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <div className="xl:hidden">
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-50 flex items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-blue-700"
        aria-label="Open insights panel"
      >
        <BarChart3 className="h-5 w-5" />
        Insights
      </button>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={close}
        aria-hidden="true"
      />

      {/* Slide-in panel */}
      <div
        className={`fixed inset-y-0 right-0 z-[70] flex w-80 max-w-[85vw] flex-col bg-gray-50 transition-transform duration-200 ease-out dark:bg-gray-950 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Trending insights"
      >
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Insights
          </span>
          <button
            onClick={close}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label="Close insights panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <TopFirstAuthors />
          <FirstAuthorGeography />
        </div>
      </div>
    </div>
  );
}
