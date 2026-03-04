"use client";

import { X } from "lucide-react";
import { JOURNALS } from "@/lib/constants/journals";
import type { PaperFilters } from "@/types/filters";

interface FilterBarProps {
  filters: PaperFilters;
  onRemoveFilter: (key: string, value?: string) => void;
  onClear: () => void;
}

export function FilterBar({ filters, onRemoveFilter, onClear }: FilterBarProps) {
  const chips: { key: string; label: string; value?: string }[] = [];

  if (filters.q) {
    chips.push({ key: "q", label: `Search: "${filters.q}"` });
  }

  if (filters.journals?.length) {
    filters.journals.forEach((slug) => {
      const journal = JOURNALS.find((j) => j.slug === slug);
      chips.push({
        key: "journals",
        label: journal?.abbreviation || slug,
        value: slug,
      });
    });
  }

  if (filters.from) {
    chips.push({ key: "from", label: `From: ${filters.from}` });
  }

  if (filters.to) {
    chips.push({ key: "to", label: `To: ${filters.to}` });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip, i) => (
        <span
          key={`${chip.key}-${i}`}
          className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
        >
          {chip.label}
          <button
            onClick={() => onRemoveFilter(chip.key, chip.value)}
            className="ml-0.5 hover:text-blue-900 dark:hover:text-blue-100"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button
        onClick={onClear}
        className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        Clear all
      </button>
    </div>
  );
}
