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
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function getMonthTimestamp(monthKey: string): number {
  const [year, month] = monthKey.split("-");
  return new Date(Number(year), Number(month) - 1, 1).getTime();
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
  const confirmed = conference.dateConfirmed !== false;
  const isRight = align === "right";

  return (
    <div className={`mb-3 rounded-xl border p-3.5 transition-colors ${
      past
        ? "border-gray-100 bg-gray-50 opacity-55 dark:border-gray-800 dark:bg-gray-900/40"
        : confirmed
          ? "border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
          : "border-amber-200 bg-amber-50/50 shadow-sm dark:border-amber-800/50 dark:bg-amber-950/20"
    }`}>
      {/* Header */}
      <div className={`flex items-start gap-1.5 ${isRight ? "" : "flex-row-reverse"}`}>
        <h3 className={`flex-1 text-sm font-semibold leading-snug ${
          past ? "text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-gray-100"
        } ${isRight ? "text-left" : "text-right"}`}>
          {conference.name}
        </h3>
        {conference.website && (
          <a
            href={conference.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 text-gray-300 hover:text-blue-500 dark:text-gray-600 dark:hover:text-blue-400"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* Meta */}
      <div className={`mt-1.5 space-y-0.5 ${isRight ? "" : "flex flex-col items-end"}`}>
        <div className={`flex items-center gap-1 text-xs ${
          !confirmed ? "text-amber-600 dark:text-amber-400" : "text-gray-500 dark:text-gray-400"
        } ${isRight ? "" : "flex-row-reverse"}`}>
          {!confirmed
            ? <HelpCircle className="h-3 w-3 flex-shrink-0" />
            : <CalendarDays className="h-3 w-3 flex-shrink-0" />
          }
          <span>{formatDateRange(conference.startDate, conference.endDate, confirmed)}</span>
          {!confirmed && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0 text-[9px] font-semibold uppercase text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
              미정
            </span>
          )}
        </div>
        <div className={`flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 ${isRight ? "" : "flex-row-reverse"}`}>
          <MapPin className="h-3 w-3 flex-shrink-0" />
          <span>{conference.location}</span>
        </div>
      </div>

      {/* Tags */}
      <div className={`mt-2 flex flex-wrap gap-1 ${isRight ? "" : "justify-end"}`}>
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

// ── Mobile timeline column ────────────────────────────────────────────────────

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const PX_PER_DAY = 1.8;
const MIN_GAP_PX = 12;
const MAX_GAP_PX = 80;

function MobileTimelineColumn({ conferences }: { conferences: Conference[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, { ts: number; confs: Conference[] }>();
    for (const c of conferences) {
      const key = getMonthKey(c.startDate);
      const ts = getMonthTimestamp(key);
      if (!map.has(key)) map.set(key, { ts, confs: [] });
      map.get(key)!.confs.push(c);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({ key, ...v }));
  }, [conferences]);

  if (conferences.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-500">일정이 없습니다.</p>;
  }

  return (
    <div className="relative border-l border-gray-200 pl-5 dark:border-gray-700">
      {grouped.map(({ key, ts, confs }, i) => {
        const prevTs = i > 0 ? grouped[i - 1].ts : ts;
        const diffDays = (ts - prevTs) / MS_PER_DAY;
        const gapPx = i === 0 ? 0 : Math.min(MAX_GAP_PX, Math.max(MIN_GAP_PX, Math.round(diffDays * PX_PER_DAY)));
        return (
          <div key={key} style={{ paddingTop: gapPx }}>
            <div className="relative mb-3 flex items-center">
              <div className="absolute -left-[25px] flex h-4 w-4 items-center justify-center rounded-full bg-gray-100 ring-2 ring-white dark:bg-gray-800 dark:ring-gray-900">
                <div className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {formatMonthLabel(key)}
              </span>
            </div>
            {confs.map((conf) => (
              <ConferenceCard key={conf.name + conf.startDate} conference={conf} align="right" />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── Desktop center-axis split timeline ───────────────────────────────────────

function CenterAxisTimeline({
  international,
  korean,
}: {
  international: Conference[];
  korean: Conference[];
}) {
  // Merge all months from both sides, sorted
  const allMonths = useMemo(() => {
    const monthSet = new Set<string>();
    for (const c of international) if (c.startDate) monthSet.add(getMonthKey(c.startDate));
    for (const c of korean) if (c.startDate) monthSet.add(getMonthKey(c.startDate));
    return Array.from(monthSet).sort();
  }, [international, korean]);

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
      <div className="mb-6 grid grid-cols-[1fr_128px_1fr] items-center">
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

      {/* Timeline rows with proportional gaps */}
      {allMonths.map((monthKey, i) => {
        const intlConfs = intlByMonth.get(monthKey) ?? [];
        const koreanConfs = koreanByMonth.get(monthKey) ?? [];
        const ts = getMonthTimestamp(monthKey);
        const prevTs = i > 0 ? getMonthTimestamp(allMonths[i - 1]) : ts;
        const diffDays = (ts - prevTs) / MS_PER_DAY;
        const gapPx = i === 0 ? 0 : Math.min(MAX_GAP_PX, Math.max(MIN_GAP_PX, Math.round(diffDays * PX_PER_DAY)));

        return (
          <div
            key={monthKey}
            className="grid grid-cols-[1fr_128px_1fr] items-start"
            style={{ paddingTop: gapPx }}
          >
            {/* Left: international */}
            <div className="pr-4">
              {intlConfs.map((conf) => (
                <ConferenceCard key={conf.name + conf.startDate} conference={conf} align="left" />
              ))}
            </div>

            {/* Center axis */}
            <div className="relative flex flex-col items-center">
              <div className="absolute inset-0 flex justify-center">
                <div className="w-px bg-gray-200 dark:bg-gray-700" />
              </div>
              <div className="relative z-10 mt-1 rounded-full border border-gray-200 bg-white px-3 py-1 dark:border-gray-700 dark:bg-gray-900">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  {formatMonthLabel(monthKey)}
                </span>
              </div>
            </div>

            {/* Right: korean */}
            <div className="pl-4">
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
          <button
            key={tab}
            onClick={() => setMobileTab(tab)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              mobileTab === tab
                ? "bg-blue-600 text-white dark:bg-blue-500"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
            }`}
          >
            {tab === "international" ? "🌍 International" : "🇰🇷 Korean"}
          </button>
        ))}
      </div>

      {/* Mobile single column */}
      <div className="md:hidden">
        {mobileTab === "international"
          ? <MobileTimelineColumn conferences={international} />
          : <MobileTimelineColumn conferences={korean} />}
      </div>

      {/* Desktop: center axis split timeline */}
      <div className="hidden md:block">
        <CenterAxisTimeline international={international} korean={korean} />
      </div>
    </div>
  );
}
