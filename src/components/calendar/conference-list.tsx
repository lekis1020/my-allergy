"use client";

import { useState, useMemo } from "react";
import { type Conference } from "@/lib/constants/conferences";
import { MapPin, CalendarDays, ExternalLink } from "lucide-react";

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startStr = s.toLocaleDateString("en-US", opts);
  if (s.getMonth() === e.getMonth()) {
    return `${startStr}–${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${startStr} – ${e.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
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

// ── Single timeline card ──────────────────────────────────────────────────────

function TimelineCard({
  conference,
  side,
}: {
  conference: Conference;
  side: "left" | "right";
}) {
  const past = isPast(conference.endDate);

  return (
    <div className={`relative flex items-start gap-3 ${side === "right" ? "flex-row-reverse" : ""}`}>
      {/* Dot on the spine */}
      <div
        className={`mt-1.5 flex-shrink-0 h-2.5 w-2.5 rounded-full border-2 ${
          past
            ? "border-gray-300 bg-gray-200 dark:border-gray-600 dark:bg-gray-700"
            : "border-blue-500 bg-white dark:border-blue-400 dark:bg-gray-900"
        }`}
      />

      {/* Card */}
      <div
        className={`flex-1 mb-5 rounded-xl border p-3.5 transition-colors ${
          past
            ? "border-gray-200 bg-gray-50 opacity-60 dark:border-gray-800 dark:bg-gray-900/50"
            : "border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
        }`}
      >
        <div className="flex items-start justify-between gap-1">
          <h3
            className={`text-sm font-semibold leading-snug ${
              past ? "text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-gray-100"
            }`}
          >
            {conference.name}
          </h3>
          {conference.website && (
            <a
              href={conference.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        <div className="mt-1.5 space-y-0.5 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3 flex-shrink-0" />
            <span>{formatDateRange(conference.startDate, conference.endDate)}</span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span>{conference.location}</span>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          {conference.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Single column timeline ────────────────────────────────────────────────────

function TimelineColumn({
  title,
  flag,
  conferences,
  side,
}: {
  title: string;
  flag: string;
  conferences: Conference[];
  side: "left" | "right";
}) {
  // Group by month
  const grouped = useMemo(() => {
    const map = new Map<string, Conference[]>();
    for (const c of conferences) {
      const key = getMonthKey(c.startDate);
      map.set(key, [...(map.get(key) ?? []), c]);
    }
    return map;
  }, [conferences]);

  if (conferences.length === 0) {
    return (
      <div className="flex flex-col">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-lg">{flag}</span>
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{title}</h2>
        </div>
        <p className="text-sm text-gray-400 dark:text-gray-500">일정이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Column header */}
      <div className="mb-5 flex items-center gap-2">
        <span className="text-xl">{flag}</span>
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{title}</h2>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          {conferences.length}
        </span>
      </div>

      {/* Timeline */}
      <div
        className={`relative pl-4 ${
          side === "right" ? "border-l border-gray-200 dark:border-gray-700" : "border-l border-gray-200 dark:border-gray-700"
        }`}
      >
        {Array.from(grouped.entries()).map(([month, confs]) => (
          <div key={month}>
            {/* Month label */}
            <div className="relative mb-3">
              <div className="absolute -left-[21px] flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                <div className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
              </div>
              <span className="ml-1 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {month}
              </span>
            </div>

            {/* Conferences */}
            <div className="ml-1 space-y-0">
              {confs.map((conf) => (
                <TimelineCard
                  key={conf.name + conf.startDate}
                  conference={conf}
                  side="left"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface ConferenceListProps {
  conferences: Conference[];
}

export function ConferenceList({ conferences }: ConferenceListProps) {
  const [mobileTab, setMobileTab] = useState<"international" | "korean">("international");

  const international = useMemo(
    () => conferences.filter((c) => !c.isKorean),
    [conferences]
  );
  const korean = useMemo(
    () => conferences.filter((c) => c.isKorean),
    [conferences]
  );

  return (
    <div>
      {/* Mobile: tabs */}
      <div className="mb-6 flex gap-2 md:hidden">
        <button
          onClick={() => setMobileTab("international")}
          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            mobileTab === "international"
              ? "bg-blue-600 text-white dark:bg-blue-500"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
          }`}
        >
          🌍 International
        </button>
        <button
          onClick={() => setMobileTab("korean")}
          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            mobileTab === "korean"
              ? "bg-blue-600 text-white dark:bg-blue-500"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
          }`}
        >
          🇰🇷 Korean
        </button>
      </div>

      {/* Mobile: single column */}
      <div className="md:hidden">
        {mobileTab === "international" ? (
          <TimelineColumn title="International" flag="🌍" conferences={international} side="left" />
        ) : (
          <TimelineColumn title="Korean" flag="🇰🇷" conferences={korean} side="left" />
        )}
      </div>

      {/* Desktop: two-column split timeline */}
      <div className="hidden md:grid md:grid-cols-2 md:gap-10">
        <TimelineColumn title="International" flag="🌍" conferences={international} side="left" />
        <TimelineColumn title="Korean" flag="🇰🇷" conferences={korean} side="left" />
      </div>
    </div>
  );
}
