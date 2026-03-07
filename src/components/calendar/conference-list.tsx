"use client";

import { useState, useMemo } from "react";
import { CONFERENCES, type Conference } from "@/lib/constants/conferences";
import { MapPin, CalendarDays, ExternalLink } from "lucide-react";

type Filter = "all" | "international" | "korean";

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startStr = s.toLocaleDateString("en-US", opts);
  const endStr = e.toLocaleDateString("en-US", {
    ...opts,
    year: "numeric",
  });
  if (s.getMonth() === e.getMonth()) {
    return `${startStr}–${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${startStr} – ${endStr}`;
}

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
}

function isPast(endDate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(endDate + "T00:00:00") < today;
}

function ConferenceCard({ conference }: { conference: Conference }) {
  const past = isPast(conference.endDate);

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        past
          ? "border-gray-200 bg-gray-50 opacity-60 dark:border-gray-800 dark:bg-gray-900/50"
          : "border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3
          className={`font-semibold ${
            past
              ? "text-gray-500 dark:text-gray-500"
              : "text-gray-900 dark:text-gray-100"
          }`}
        >
          {conference.name}
        </h3>
        {conference.website && (
          <a
            href={conference.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
            aria-label={`Visit ${conference.name} website`}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>

      <div className="mt-2 flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{formatDateRange(conference.startDate, conference.endDate)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{conference.location}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {conference.tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
          >
            {tag}
          </span>
        ))}
        {conference.isKorean && (
          <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
            Korean
          </span>
        )}
      </div>
    </div>
  );
}

export function ConferenceList() {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return CONFERENCES;
    if (filter === "korean") return CONFERENCES.filter((c) => c.isKorean);
    return CONFERENCES.filter((c) => !c.isKorean);
  }, [filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, Conference[]>();
    for (const conf of filtered) {
      const key = getMonthKey(conf.startDate);
      const list = map.get(key) ?? [];
      list.push(conf);
      map.set(key, list);
    }
    return map;
  }, [filtered]);

  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "international", label: "International" },
    { value: "korean", label: "Korean" },
  ];

  return (
    <div>
      <div className="mb-6 flex gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === f.value
                ? "bg-blue-600 text-white dark:bg-blue-500"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-8">
        {Array.from(grouped.entries()).map(([month, conferences]) => (
          <section key={month}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {month}
            </h2>
            <div className="space-y-3">
              {conferences.map((conf) => (
                <ConferenceCard key={conf.name + conf.startDate} conference={conf} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="py-12 text-center text-gray-500 dark:text-gray-400">
          No conferences found for the selected filter.
        </p>
      )}
    </div>
  );
}
