"use client";

import { useState, useMemo } from "react";
import { type Conference } from "@/lib/constants/conferences";
import { MapPin, CalendarDays, ExternalLink, HelpCircle } from "lucide-react";

// ── Date helpers ──────────────────────────────────────────────────────────────

function formatDateRange(start: string, end: string, confirmed: boolean): string {
  if (!confirmed) return "날짜 미정";
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (s.getMonth() === e.getMonth() && s.getDate() === e.getDate()) {
    return s.toLocaleDateString("en-US", { ...opts, year: "numeric" });
  }
  if (s.getMonth() === e.getMonth()) {
    return `${s.toLocaleDateString("en-US", opts)}–${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
}

function getMonthTimestamp(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00");
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

function isPast(endDate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(endDate + "T00:00:00") < today;
}

// ── Card ──────────────────────────────────────────────────────────────────────

function TimelineCard({ conference }: { conference: Conference }) {
  const past = isPast(conference.endDate);
  const confirmed = conference.dateConfirmed !== false;

  return (
    <div className="relative flex items-start gap-2.5 mb-4">
      {/* Dot */}
      <div className={`mt-2 flex-shrink-0 h-2.5 w-2.5 rounded-full border-2 z-10 ${
        past
          ? "border-gray-300 bg-gray-100 dark:border-gray-600 dark:bg-gray-800"
          : confirmed
            ? "border-blue-500 bg-white dark:border-blue-400 dark:bg-gray-900"
            : "border-amber-400 bg-white dark:border-amber-500 dark:bg-gray-900"
      }`} />

      {/* Card */}
      <div className={`flex-1 rounded-xl border p-3.5 transition-colors ${
        past
          ? "border-gray-100 bg-gray-50 opacity-55 dark:border-gray-800 dark:bg-gray-900/40"
          : confirmed
            ? "border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
            : "border-amber-200 bg-amber-50/50 shadow-sm dark:border-amber-800/50 dark:bg-amber-950/20"
      }`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-1.5">
          <h3 className={`text-sm font-semibold leading-snug ${
            past ? "text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-gray-100"
          }`}>
            {conference.name}
          </h3>
          {conference.website && (
            <a href={conference.website} target="_blank" rel="noopener noreferrer"
              className="flex-shrink-0 text-gray-300 hover:text-blue-500 dark:text-gray-600 dark:hover:text-blue-400">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        {/* Meta */}
        <div className="mt-1.5 space-y-0.5">
          <div className={`flex items-center gap-1 text-xs ${
            !confirmed ? "text-amber-600 dark:text-amber-400" : "text-gray-500 dark:text-gray-400"
          }`}>
            {!confirmed
              ? <HelpCircle className="h-3 w-3 flex-shrink-0" />
              : <CalendarDays className="h-3 w-3 flex-shrink-0" />
            }
            <span>{formatDateRange(conference.startDate, conference.endDate, confirmed)}</span>
            {!confirmed && (
              <span className="ml-0.5 rounded-full bg-amber-100 px-1.5 py-0 text-[9px] font-semibold uppercase text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                미정
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span>{conference.location}</span>
          </div>
        </div>

        {/* Tags */}
        <div className="mt-2 flex flex-wrap gap-1">
          {conference.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Timeline column with proportional month gaps ──────────────────────────────

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const PX_PER_DAY = 1.8; // 1px ≈ 0.56 days — tune for visual density
const MIN_GAP_PX = 12;
const MAX_GAP_PX = 80;

function TimelineColumn({
  title, flag, conferences,
}: {
  title: string;
  flag: string;
  conferences: Conference[];
}) {
  // Group by month
  const grouped = useMemo(() => {
    const map = new Map<string, { ts: number; conferences: Conference[] }>();
    for (const c of conferences) {
      const key = getMonthKey(c.startDate);
      const ts = getMonthTimestamp(c.startDate);
      if (!map.has(key)) map.set(key, { ts, conferences: [] });
      map.get(key)!.conferences.push(c);
    }
    return Array.from(map.entries()).map(([month, v]) => ({ month, ...v }));
  }, [conferences]);

  if (conferences.length === 0) {
    return (
      <div className="flex flex-col">
        <div className="mb-5 flex items-center gap-2">
          <span className="text-xl">{flag}</span>
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{title}</h2>
        </div>
        <p className="text-sm text-gray-400 dark:text-gray-500">일정이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="mb-5 flex items-center gap-2">
        <span className="text-xl">{flag}</span>
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{title}</h2>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          {conferences.length}
        </span>
      </div>

      {/* Timeline */}
      <div className="relative border-l border-gray-200 pl-5 dark:border-gray-700">
        {grouped.map(({ month, ts, conferences: confs }, i) => {
          // Proportional gap from previous month
          const prevTs = i > 0 ? grouped[i - 1].ts : ts;
          const diffDays = (ts - prevTs) / MS_PER_DAY;
          const gapPx = i === 0
            ? 0
            : Math.min(MAX_GAP_PX, Math.max(MIN_GAP_PX, Math.round(diffDays * PX_PER_DAY)));

          return (
            <div key={month} style={{ paddingTop: gapPx }}>
              {/* Month label */}
              <div className="relative mb-3 flex items-center">
                <div className="absolute -left-[25px] flex h-4 w-4 items-center justify-center rounded-full bg-gray-100 ring-2 ring-white dark:bg-gray-800 dark:ring-gray-900">
                  <div className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {month}
                </span>
              </div>

              {/* Cards */}
              {confs.map((conf) => (
                <TimelineCard key={conf.name + conf.startDate} conference={conf} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface ConferenceListProps {
  conferences: Conference[];
}

export function ConferenceList({ conferences }: ConferenceListProps) {
  const [mobileTab, setMobileTab] = useState<"international" | "korean">("international");

  const international = useMemo(() => conferences.filter((c) => !c.isKorean), [conferences]);
  const korean = useMemo(() => conferences.filter((c) => c.isKorean), [conferences]);

  return (
    <div>
      {/* Legend */}
      <div className="mb-5 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-blue-500 bg-white dark:border-blue-400 dark:bg-gray-900" />
          날짜 확정
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-amber-400 bg-white dark:border-amber-500 dark:bg-gray-900" />
          날짜 미정 (작년 기준 월)
        </span>
      </div>

      {/* Mobile tabs */}
      <div className="mb-6 flex gap-2 md:hidden">
        {(["international", "korean"] as const).map((tab) => (
          <button key={tab} onClick={() => setMobileTab(tab)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              mobileTab === tab
                ? "bg-blue-600 text-white dark:bg-blue-500"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
            }`}>
            {tab === "international" ? "🌍 International" : "🇰🇷 Korean"}
          </button>
        ))}
      </div>

      {/* Mobile single column */}
      <div className="md:hidden">
        {mobileTab === "international"
          ? <TimelineColumn title="International" flag="🌍" conferences={international} />
          : <TimelineColumn title="Korean" flag="🇰🇷" conferences={korean} />}
      </div>

      {/* Desktop two-column */}
      <div className="hidden md:grid md:grid-cols-2 md:gap-12">
        <TimelineColumn title="International" flag="🌍" conferences={international} />
        <TimelineColumn title="Korean" flag="🇰🇷" conferences={korean} />
      </div>
    </div>
  );
}
