"use client";

import { useMemo } from "react";
import { FileText } from "lucide-react";
import type { BookmarkPaper } from "@/hooks/use-bookmarks-with-titles";

interface MentionDropdownProps {
  query: string;
  papers: BookmarkPaper[];
  onSelect: (paper: BookmarkPaper) => void;
  visible: boolean;
}

export function MentionDropdown({ query, papers, onSelect, visible }: MentionDropdownProps) {
  const filtered = useMemo(() => {
    if (!query) return papers.slice(0, 8);
    const lower = query.toLowerCase();
    return papers
      .filter((p) => p.title.toLowerCase().includes(lower) || p.pmid.includes(query))
      .slice(0, 8);
  }, [query, papers]);

  if (!visible || filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 z-50 mb-1 max-h-48 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
      {filtered.map((paper) => (
        <button
          key={paper.pmid}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(paper);
          }}
          className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-xs text-gray-800 dark:text-gray-200">
              {paper.title}
            </p>
            <p className="text-[10px] text-gray-400">PMID: {paper.pmid}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
