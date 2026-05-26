"use client";

import { useEffect, useMemo, useState } from "react";
import type { JournalConfig } from "@/lib/constants/journals";

interface JournalFilterPanelProps {
  journals: JournalConfig[];
  activeJournals: string[]; // slugs
  onToggle: (slug: string) => void;
  onClearAll: () => void;
}

export type JournalSortOrder = "alpha" | "if";

const SORT_STORAGE_KEY = "my-allergy:journal-sort";
const DEFAULT_SORT: JournalSortOrder = "alpha";

/**
 * Pure sort helper exported for unit testing.
 * - "alpha": ascending by abbreviation (the label users see).
 * - "if":    impactFactor descending, nulls last, alphabetical tie-break.
 * Never mutates the input.
 */
export function sortJournals(
  journals: JournalConfig[],
  order: JournalSortOrder,
): JournalConfig[] {
  const copy = [...journals];
  if (order === "alpha") {
    return copy.sort((a, b) => a.abbreviation.localeCompare(b.abbreviation));
  }
  return copy.sort((a, b) => {
    const ai = a.impactFactor;
    const bi = b.impactFactor;
    if (ai == null && bi == null) return a.abbreviation.localeCompare(b.abbreviation);
    if (ai == null) return 1;
    if (bi == null) return -1;
    if (ai !== bi) return bi - ai;
    return a.abbreviation.localeCompare(b.abbreviation);
  });
}

function readStoredSort(): JournalSortOrder {
  if (typeof window === "undefined") return DEFAULT_SORT;
  try {
    const raw = window.localStorage.getItem(SORT_STORAGE_KEY);
    return raw === "alpha" || raw === "if" ? raw : DEFAULT_SORT;
  } catch {
    return DEFAULT_SORT;
  }
}

export function JournalFilterPanel({
  journals,
  activeJournals,
  onToggle,
  onClearAll,
}: JournalFilterPanelProps) {
  // First render (SSR + client hydration) uses the default to avoid
  // hydration mismatch; persisted preference is applied after mount.
  const [sortOrder, setSortOrder] = useState<JournalSortOrder>(DEFAULT_SORT);

  useEffect(() => {
    const stored = readStoredSort();
    if (stored !== DEFAULT_SORT) setSortOrder(stored);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SORT_STORAGE_KEY, sortOrder);
    } catch {
      /* ignore quota / privacy mode errors */
    }
  }, [sortOrder]);

  const sortedJournals = useMemo(
    () => sortJournals(journals, sortOrder),
    [journals, sortOrder],
  );

  const hasFilter = activeJournals.length > 0;

  const sortBtn = (order: JournalSortOrder, label: string) => {
    const isActive = sortOrder === order;
    return (
      <button
        type="button"
        onClick={() => setSortOrder(order)}
        aria-pressed={isActive}
        className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
          isActive
            ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
            : "text-gray-500 hover:bg-gray-50 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        }`}
      >
        {label}
      </button>
    );
  };

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

      <div className="flex items-center gap-1 px-1 pt-1">
        <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          Sort
        </span>
        {sortBtn("alpha", "A→Z")}
        {sortBtn("if", "IF ↓")}
      </div>

      {sortedJournals.map((journal) => {
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
