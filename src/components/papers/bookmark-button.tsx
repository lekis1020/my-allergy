"use client";

import { Bookmark } from "lucide-react";
import { useBookmarks } from "@/hooks/use-bookmarks";

interface BookmarkButtonProps {
  pmid: string;
  size?: "sm" | "md";
}

export function BookmarkButton({ pmid, size = "sm" }: BookmarkButtonProps) {
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const saved = isBookmarked(pmid);

  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleBookmark(pmid);
      }}
      className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-500 dark:text-gray-500 dark:hover:bg-blue-900/30 dark:hover:text-blue-400"
      aria-label={saved ? "Remove bookmark" : "Save paper"}
      title={saved ? "Remove bookmark" : "Save paper"}
    >
      <Bookmark
        className={`${iconSize} ${saved ? "fill-blue-500 text-blue-500 dark:fill-blue-400 dark:text-blue-400" : ""}`}
      />
    </button>
  );
}
