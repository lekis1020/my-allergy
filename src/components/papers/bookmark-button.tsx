"use client";

import { useState } from "react";
import { Bookmark, Loader2 } from "lucide-react";
import { useBookmarks } from "@/hooks/use-bookmarks";

interface BookmarkButtonProps {
  pmid: string;
  size?: "sm" | "md";
  aiSummary?: string | null;
  count?: number;
}

export function BookmarkButton({ pmid, size = "sm", aiSummary, count: initialCount }: BookmarkButtonProps) {
  const { isBookmarked, toggleBookmark, loading } = useBookmarks();
  const saved = isBookmarked(pmid);
  const [count, setCount] = useState(initialCount ?? 0);
  const [prevSaved, setPrevSaved] = useState<boolean | null>(null);

  // Sync count when bookmark state changes
  if (prevSaved !== null && prevSaved !== saved) {
    setCount((prev) => saved ? prev + 1 : Math.max(0, prev - 1));
  }
  if (prevSaved !== saved) {
    setPrevSaved(saved);
  }

  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  if (loading) {
    return (
      <div className="flex items-center gap-0.5 rounded-full p-1.5">
        <Loader2 className={`${iconSize} animate-spin text-gray-300 dark:text-gray-600`} />
      </div>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleBookmark(pmid, aiSummary ?? undefined);
      }}
      className={`flex items-center gap-0.5 rounded-full p-1.5 transition-colors ${
        saved
          ? "text-blue-500 dark:text-blue-400"
          : "text-gray-400 hover:bg-blue-50 hover:text-blue-500 dark:text-gray-500 dark:hover:bg-blue-900/30 dark:hover:text-blue-400"
      }`}
      aria-label={saved ? "Remove bookmark" : "Save paper"}
      title={saved ? "Remove bookmark" : "Save paper"}
    >
      <Bookmark
        className={`${iconSize} ${saved ? "fill-blue-500 dark:fill-blue-400" : ""}`}
      />
      {initialCount !== undefined && (
        <span className="text-xs">{count}</span>
      )}
    </button>
  );
}
