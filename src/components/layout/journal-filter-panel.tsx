"use client";

import type { JournalConfig } from "@/lib/constants/journals";

interface JournalFilterPanelProps {
  journals: JournalConfig[];
  activeJournals: string[]; // slugs
  onToggle: (slug: string) => void;
  onClearAll: () => void;
}

export function JournalFilterPanel({
  journals,
  activeJournals,
  onToggle,
  onClearAll,
}: JournalFilterPanelProps) {
  const hasFilter = activeJournals.length > 0;

  return (
    <div className="space-y-1">
      <button
        onClick={onClearAll}
        className={`flex w-full items-center rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
          !hasFilter
            ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
            : "text-gray-500 hover:bg-gray-50 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        }`}
      >
        All journals
      </button>
      {journals.map((journal) => {
        const isActive = activeJournals.includes(journal.slug);
        return (
          <button
            key={journal.slug}
            onClick={() => onToggle(journal.slug)}
            title={`${journal.name} (IF: ${journal.impactFactor ?? "N/A"})`}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
              isActive
                ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                : "text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            }`}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: journal.color }}
            />
            <span className="min-w-0 flex-1 truncate">{journal.abbreviation}</span>
          </button>
        );
      })}
    </div>
  );
}
