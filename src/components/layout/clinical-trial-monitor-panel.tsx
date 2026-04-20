"use client";

import { useMemo, useState } from "react";
import { Activity, ArrowUpRight, Microscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useClinicalTrials } from "@/hooks/use-clinical-trials";
import { formatDate, formatRelativeDate } from "@/lib/utils/date";
import { AREA_COLORS } from "@/lib/clinical-trials/monitor";

const STATUS_STYLES: Record<string, string> = {
  RECRUITING: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
  ACTIVE_NOT_RECRUITING: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900",
  NOT_YET_RECRUITING: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
  ENROLLING_BY_INVITATION: "bg-fuchsia-50 text-fuchsia-700 ring-1 ring-inset ring-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-300 dark:ring-fuchsia-900",
  COMPLETED: "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700",
  UNKNOWN: "bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700",
};

const PHASE_TABS = [
  { id: "phase1", label: "Phase 1", match: (p: string) => /early phase 1|phase 1(?!\s*\/\s*phase 2)/i.test(p) || p === "Early Phase 1" },
  { id: "phase2", label: "Phase 2", match: (p: string) => /phase 2|phase 1\s*\/\s*phase 2|phase 2\s*\/\s*phase 3/i.test(p) },
  { id: "phase3", label: "Phase 3", match: (p: string) => /phase 3(?!\s*\/)|phase 2\s*\/\s*phase 3/i.test(p) },
  { id: "phase4", label: "Phase 4", match: (p: string) => /phase 4/i.test(p) },
  { id: "other", label: "Other", match: () => true },
] as const;

const PHASE_TAB_STYLES: Record<string, { active: string; border: string }> = {
  phase1: { active: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300", border: "border-sky-200 dark:border-sky-900" },
  phase2: { active: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-900" },
  phase3: { active: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300", border: "border-violet-200 dark:border-violet-900" },
  phase4: { active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-900" },
  other: { active: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", border: "border-gray-200 dark:border-gray-700" },
};

interface ClinicalTrialMonitorPanelProps {
  onSelectStudy?: (relatedQuery: string, title: string) => void;
}

function classifyPhase(phaseLabel: string): string {
  // Check in reverse priority — phase3 before phase2 to handle "Phase 2 / Phase 3" correctly
  if (/phase 4/i.test(phaseLabel)) return "phase4";
  if (/phase 3/i.test(phaseLabel)) return "phase3";
  if (/phase 2/i.test(phaseLabel)) return "phase2";
  if (/phase 1|early phase/i.test(phaseLabel)) return "phase1";
  return "other";
}

export function ClinicalTrialMonitorPanel({ onSelectStudy }: ClinicalTrialMonitorPanelProps) {
  const {
    studies,
    isLoading,
    error,
    partial,
    missingAreas,
    trackedAt,
  } = useClinicalTrials();

  const [activeTab, setActiveTab] = useState("phase3");

  const phaseGroups = useMemo(() => {
    const groups: Record<string, typeof studies> = {
      phase1: [],
      phase2: [],
      phase3: [],
      phase4: [],
      other: [],
    };

    for (const study of studies) {
      const phase = classifyPhase(study.phaseLabel);
      groups[phase].push(study);
    }

    return groups;
  }, [studies]);

  const currentStudies = phaseGroups[activeTab] ?? [];
  const tabStyle = PHASE_TAB_STYLES[activeTab] ?? PHASE_TAB_STYLES.other;

  return (
    <section className="border-b border-gray-200 px-4 py-4 dark:border-gray-800">
      <div className="mb-3 flex items-center gap-2">
        <Microscope className="h-4 w-4 text-emerald-500" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Clinical Trial Monitor
        </h2>
        {trackedAt && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Updated {formatRelativeDate(trackedAt)}
          </span>
        )}
      </div>

      <div className="relative">
        {/* Phase Tabs */}
        <div
          className="-mb-px flex gap-0.5 overflow-x-auto border-b border-gray-200 dark:border-gray-800"
          style={{ scrollbarWidth: "none" }}
        >
          {PHASE_TABS.map((tab) => {
            const count = phaseGroups[tab.id]?.length ?? 0;
            const isActive = activeTab === tab.id;
            const style = PHASE_TAB_STYLES[tab.id];

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-lg border border-b-0 px-3 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? `${style.active} ${style.border} z-10`
                    : "border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-300"
                }`}
              >
                {tab.label}
                <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[11px] tabular-nums dark:bg-white/10">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className={`rounded-b-xl border border-t-0 ${tabStyle.border} p-4`}>
          {isLoading ? (
            <TrialListSkeleton />
          ) : currentStudies.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
              No trials in this phase.
            </p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <Activity className="h-3.5 w-3.5 text-emerald-500" />
                  {currentStudies.length} studies
                </span>
                <span>종료 후 30일까지 노출</span>
              </div>

              <ul className="space-y-1">
                {currentStudies.map((study, index) => (
                  <li key={study.nctId}>
                    <TrialListItem
                      index={index}
                      study={study}
                      onSelectStudy={onSelectStudy}
                    />
                  </li>
                ))}
              </ul>

              {partial && (
                <p className="mt-3 text-xs text-amber-600 dark:text-amber-300">
                  Partial data: {missingAreas.join(", ")}
                </p>
              )}
              {error && !partial && (
                <p className="mt-3 text-xs text-rose-600 dark:text-rose-300">
                  Trial monitor temporarily unavailable
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

interface TrialStudy {
  nctId: string;
  title: string;
  status: string;
  statusLabel: string;
  phaseLabel: string;
  focusAreaIds: string[];
  focusAreaLabels: string[];
  interventions: string[];
  sponsor: string | null;
  lastUpdated: string | null;
  relatedQuery: string;
  url: string;
  progressLabel: string;
  progressPercent: number | null;
  startDate: string | null;
  targetDate: string | null;
  targetDateLabel: string;
}

function TrialListItem({
  index,
  study,
  onSelectStudy,
}: {
  index: number;
  study: TrialStudy;
  onSelectStudy?: (relatedQuery: string, title: string) => void;
}) {
  return (
    <div className="group rounded-lg px-2 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-900">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          {index + 1}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[study.status] ?? STATUS_STYLES.UNKNOWN}`}>
              {study.statusLabel}
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              {study.phaseLabel}
            </span>
            {/* Disease area tags with distinct colors */}
            {study.focusAreaIds.map((areaId, i) => {
              const color = AREA_COLORS[areaId];
              const label = study.focusAreaLabels[i] ?? areaId;
              if (!color) {
                return (
                  <span
                    key={areaId}
                    className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                  >
                    {label}
                  </span>
                );
              }
              return (
                <span
                  key={areaId}
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${color.bg} ${color.text} ${color.border} ${color.dark}`}
                >
                  {label}
                </span>
              );
            })}
          </div>

          <p className="mt-2 line-clamp-2 text-sm font-medium text-gray-900 dark:text-gray-100">
            {study.title}
          </p>

          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
            <span>{study.nctId}</span>
            {study.sponsor && <span>{study.sponsor}</span>}
            {study.lastUpdated && <span>Updated {formatDate(study.lastUpdated)}</span>}
          </div>

          {study.interventions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {study.interventions.slice(0, 3).map((intervention) => (
                <Badge
                  key={intervention}
                  className="border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  {intervention}
                </Badge>
              ))}
            </div>
          )}

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400 dark:text-gray-500">
            <span>{study.progressLabel}</span>
            {study.startDate && <span>Start {formatDate(study.startDate)}</span>}
            {study.targetDate && <span>{study.targetDateLabel} {formatDate(study.targetDate)}</span>}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelectStudy?.(study.relatedQuery, study.title)}
            className="h-auto px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            Filter
          </Button>
          <a
            href={study.url}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-gray-300 transition-colors group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-400"
            aria-label={`Open trial ${study.nctId}`}
          >
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

function TrialListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2.5">
          <div className="h-5 w-5 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          </div>
          <div className="h-4 w-4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      ))}
    </div>
  );
}
