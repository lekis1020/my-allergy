"use client";

import { useState, useMemo } from "react";
import { type Conference } from "@/lib/constants/conferences";
import { MapPin, CalendarDays, ExternalLink } from "lucide-react";

function formatDateRange(start: string, end: string): string {
  if (!start || !end) return "날짜 미정";
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
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function isPast(endDate: string): boolean {
  if (!endDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(endDate + "T00:00:00") < today;
}

// ── Conference card ───────────────────────────────────────────────────────────

function ConferenceCard({
  conference,
  align,
}: {
  conference: Conference;
  align: "left" | "right";
}) {
  const past = isPast(conference.endDate);
  const unconfirmed = !conference.startDate;

  return (
    <div
      className={`mb-3 rounded-xl border p-3 transition-colors ${
        past
          ? "border-gray-200 bg-gray-50 opacity-60 dark:border-gray-800 dark:bg-gray-900/50"
          : unconfirmed
          ? "border-orange-200 bg-orange-50 shadow-sm dark:border-orange-900/40 dark:bg-orange-900/10"
          : "border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
      } ${align === "right" ? "text-left" : "text-right"}`}
    >
      <div className={`flex items-start gap-1 ${align === "right" ? "" : "flex-row-reverse"}`}>
        <h3
          className={`flex-1 text-sm font-semibold leading-snug ${
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

      <div
        className={`mt-1.5 space-y-0.5 text-xs text-gray-500 dark:text-gray-400 ${
          align === "right" ? "" : "flex flex-col items-end"
        }`}
      >
        <div className={`flex items-center gap-1 ${align === "right" ? "" : "flex-row-reverse"}`}>
          <CalendarDays className="h-3 w-3 flex-shrink-0" />
          <span>{formatDateRange(conference.startDate, conference.endDate)}</span>
        </div>
        <div className={`flex items-center gap-1 ${align === "right" ? "" : "flex-row-reverse"}`}>
          <MapPin className="h-3 w-3 flex-shrink-0" />
          <span>{conference.location || "장소 미정"}</span>
        </div>
      </div>

      <div className={`mt-2 flex flex-wrap gap-1 ${align === "right" ? "" : "justify-end"}`}>
        {unconfirmed && (
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-600 dark:bg-orange-900/40 dark:text-orange-400">
            미정
          </span>
        )}
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
  );
}

// ── Single column timeline (mobile) ──────────────────────────────────────────

function MobileTimelineColumn({
  conferences,
}: {
  conferences: Conference[];
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, Conference[]>();
    for (const c of conferences) {
      const key = getMonthKey(c.startDate);
      map.set(key, [...(map.get(key) ?? []), c]);
    }
    return new Map([...map.entries()].sort());
  }, [conferences]);

  if (conferences.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-500">일정이 없습니다.</p>;
  }

  return (
    <div className="relative border-l border-gray-200 pl-4 dark:border-gray-700">
      {Array.from(grouped.entries()).map(([monthKey, confs]) => (
        <div key={monthKey}>
          <div className="relative mb-3">
            <div className="absolute -left-[21px] flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
              <div className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
            </div>
            <span className="ml-1 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {formatMonthLabel(monthKey)}
            </span>
          </div>
          <div className="ml-1 space-y-2">
            {confs.map((conf) => (
              <ConferenceCard key={conf.name + conf.startDate} conference={conf} align="right" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Center axis split timeline (desktop) ─────────────────────────────────────

function CenterAxisTimeline({
  international,
  korean,
}: {
  international: Conference[];
  korean: Conference[];
}) {
  // Merge all months from both sides
  const allMonths = useMemo(() => {
    const monthSet = new Set<string>();
    for (const c of international) if (c.startDate) monthSet.add(getMonthKey(c.startDate));
    for (const c of korean) if (c.startDate) monthSet.add(getMonthKey(c.startDate));
    return Array.from(monthSet).sort();
  }, [international, korean]);

  // Group by month
  const intlByMonth = useMemo(() => {
    const map = new Map<string, Conference[]>();
    for (const c of international) {
      const key = getMonthKey(c.startDate);
      map.set(key, [...(map.get(key) ?? []), c]);
    }
    return map;
  }, [international]);

  const koreanByMonth = useMemo(() => {
    const map = new Map<string, Conference[]>();
    for (const c of korean) {
      const key = getMonthKey(c.startDate);
      map.set(key, [...(map.get(key) ?? []), c]);
    }
    return map;
  }, [korean]);

  return (
    <div className="relative">
      {/* Column headers */}
      <div className="mb-6 grid grid-cols-[1fr_120px_1fr] items-center gap-0">
        <div className="flex items-center justify-end gap-2 pr-4">
          <span className="text-xl">🌍</span>
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">International</h2>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            {international.length}
          </span>
        </div>
        <div className="flex justify-center">
          <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="flex items-center gap-2 pl-4">
          <span className="text-xl">🇰🇷</span>
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Korean</h2>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            {korean.length}
          </span>
        </div>
      </div>

      {/* Timeline rows */}
      {allMonths.map((monthKey) => {
        const intlConfs = intlByMonth.get(monthKey) ?? [];
        const koreanConfs = koreanByMonth.get(monthKey) ?? [];
        return (
          <div key={monthKey} className="grid grid-cols-[1fr_120px_1fr] items-start gap-0">
            {/* Left: international cards */}
            <div className="pr-4 pb-6">
              {intlConfs.map((conf) => (
                <ConferenceCard key={conf.name + conf.startDate} conference={conf} align="left" />
              ))}
            </div>

            {/* Center: axis */}
            <div className="relative flex flex-col items-center">
              {/* Continuous vertical line */}
              <div className="absolute inset-0 flex justify-center">
                <div className="w-px bg-gray-200 dark:bg-gray-700" />
              </div>
              {/* Month badge */}
              <div className="relative z-10 mt-1 rounded-full border border-gray-200 bg-white px-3 py-1 dark:border-gray-700 dark:bg-gray-900">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {formatMonthLabel(monthKey)}
                </span>
              </div>
            </div>

            {/* Right: korean cards */}
            <div className="pl-4 pb-6">
              {koreanConfs.map((conf) => (
                <ConferenceCard key={conf.name + conf.startDate} conference={conf} align="right" />
              ))}
            </div>
          </div>
        );
      })}
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
      {/* Legend */}
      <div className="mb-6 flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full border-2 border-blue-500 bg-white dark:border-blue-400 dark:bg-gray-900" />
          <span>날짜 확정</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full border-2 border-orange-400 bg-orange-50 dark:border-orange-500 dark:bg-orange-900/20" />
          <span>날짜 미정 (작년 기준 배치)</span>
        </div>
      </div>

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
          <MobileTimelineColumn conferences={international} />
        ) : (
          <MobileTimelineColumn conferences={korean} />
        )}
      </div>

      {/* Desktop: center axis split timeline */}
      <div className="hidden md:block">
        <CenterAxisTimeline international={international} korean={korean} />
      </div>
    </div>
  );
}
