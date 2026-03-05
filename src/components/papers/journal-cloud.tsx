"use client";

import type { JournalConfig } from "@/lib/constants/journals";

interface JournalCloudProps {
  journals: JournalConfig[];
  activeJournals: string[];
  onToggle: (slug: string) => void;
  onClearAll: () => void;
}

const MIN_SIZE = 12;
const MAX_SIZE = 28;

export function JournalCloud({ journals, activeJournals, onToggle, onClearAll }: JournalCloudProps) {
  const weights = journals.map((j) => j.impactFactor ?? 0);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const normalize = (v: number) => (max === min ? 0.5 : (v - min) / (max - min));

  const hasFilter = activeJournals.length > 0;

  return (
    <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1">
      <button
        onClick={onClearAll}
        style={{ fontSize: 13 }}
        className={`cursor-pointer transition-opacity ${
          !hasFilter ? "font-bold text-blue-600 dark:text-blue-400" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        }`}
      >
        All
      </button>
      {journals.map((journal) => {
        const score = normalize(journal.impactFactor ?? 0);
        const fontSize = MIN_SIZE + score * (MAX_SIZE - MIN_SIZE);
        const isActive = activeJournals.includes(journal.slug);

        return (
          <button
            key={journal.slug}
            onClick={() => onToggle(journal.slug)}
            title={`${journal.name} (IF: ${journal.impactFactor ?? "N/A"})`}
            className="cursor-pointer whitespace-nowrap transition-opacity"
            style={{
              fontSize,
              color: journal.color,
              fontWeight: isActive ? 700 : 400,
              opacity: hasFilter && !isActive ? 0.3 : 1,
            }}
          >
            {journal.abbreviation}
          </button>
        );
      })}
    </div>
  );
}
