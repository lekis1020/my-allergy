"use client";

import { JOURNALS } from "@/lib/constants/journals";
import { Select } from "@/components/ui/select";
import { SearchInput } from "@/components/papers/search-input";
import type { PaperFilters } from "@/types/filters";

interface SidebarProps {
  filters: PaperFilters;
  onFilterChange: (filters: Partial<PaperFilters>) => void;
  showSearch?: boolean;
  showSort?: boolean;
  showDateRange?: boolean;
}

export function Sidebar({
  filters,
  onFilterChange,
  showSearch = true,
  showSort = true,
  showDateRange = true,
}: SidebarProps) {
  const toggleJournal = (slug: string) => {
    const current = filters.journals || [];
    const updated = current.includes(slug)
      ? current.filter((s) => s !== slug)
      : [...current, slug];
    onFilterChange({ journals: updated });
  };

  return (
    <aside className="space-y-4">
      {showSearch && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Search
          </h3>
          <SearchInput
            value={filters.q || ""}
            onChange={(q) => onFilterChange({ q: q || undefined })}
            placeholder="Search papers..."
          />
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Journals</h3>
        <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
          {JOURNALS.map((journal) => {
            const isActive = filters.journals?.includes(journal.slug);
            return (
              <button
                key={journal.slug}
                onClick={() => toggleJournal(journal.slug)}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: journal.color }}
                />
                <span className="truncate">{journal.abbreviation}</span>
                {journal.impactFactor && (
                  <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
                    IF {journal.impactFactor}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {showSort && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Sort by
          </h3>
          <Select
            value={filters.sort || "date_desc"}
            onChange={(e) =>
              onFilterChange({ sort: e.target.value as PaperFilters["sort"] })
            }
          >
            <option value="date_desc">Newest first</option>
            <option value="date_asc">Oldest first</option>
            <option value="citations">Most cited</option>
          </Select>
        </div>
      )}

      {showDateRange && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Date Range
          </h3>
          <div className="space-y-2">
            <input
              type="date"
              value={filters.from || ""}
              onChange={(e) => onFilterChange({ from: e.target.value || undefined })}
              className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
            <input
              type="date"
              value={filters.to || ""}
              onChange={(e) => onFilterChange({ to: e.target.value || undefined })}
              className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
        </div>
      )}
    </aside>
  );
}
