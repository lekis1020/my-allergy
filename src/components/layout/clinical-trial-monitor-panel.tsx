"use client";

import { useMemo, useState } from "react";
import { Activity, ArrowUpRight, ChevronRight, Microscope, TimerReset } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useClinicalTrials } from "@/hooks/use-clinical-trials";
import { formatDate, formatRelativeDate } from "@/lib/utils/date";

const STATUS_STYLES: Record<string, string> = {
  RECRUITING: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
  ACTIVE_NOT_RECRUITING: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900",
  NOT_YET_RECRUITING: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
  ENROLLING_BY_INVITATION: "bg-fuchsia-50 text-fuchsia-700 ring-1 ring-inset ring-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-300 dark:ring-fuchsia-900",
  UNKNOWN: "bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700",
};

const SECTION_STYLES: Record<
  string,
  { dot: string; active: string; activeBorder: string }
> = {
  pipeline: {
    dot: "bg-emerald-500",
    active:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    activeBorder: "border-emerald-200 dark:border-emerald-900",
  },
  asthma: {
    dot: "bg-red-500",
    active: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
    activeBorder: "border-red-200 dark:border-red-900",
  },
  food_allergy: {
    dot: "bg-emerald-500",
    active:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    activeBorder: "border-emerald-200 dark:border-emerald-900",
  },
  atopic_dermatitis: {
    dot: "bg-violet-500",
    active:
      "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    activeBorder: "border-violet-200 dark:border-violet-900",
  },
  rhinitis: {
    dot: "bg-amber-500",
    active:
      "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    activeBorder: "border-amber-200 dark:border-amber-900",
  },
  urticaria: {
    dot: "bg-pink-500",
    active: "bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
    activeBorder: "border-pink-200 dark:border-pink-900",
  },
  immunodeficiency: {
    dot: "bg-blue-500",
    active: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    activeBorder: "border-blue-200 dark:border-blue-900",
  },
  hypereosinophilia: {
    dot: "bg-cyan-500",
    active: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
    activeBorder: "border-cyan-200 dark:border-cyan-900",
  },
  chronic_rhinosinusitis: {
    dot: "bg-orange-500",
    active: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    activeBorder: "border-orange-200 dark:border-orange-900",
  },
  chronic_urticaria: {
    dot: "bg-fuchsia-500",
    active: "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300",
    activeBorder: "border-fuchsia-200 dark:border-fuchsia-900",
  },
  anaphylaxis: {
    dot: "bg-rose-500",
    active: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    activeBorder: "border-rose-200 dark:border-rose-900",
  },
};

const DEFAULT_SECTION_STYLE = {
  dot: "bg-gray-400",
  active:
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  activeBorder: "border-gray-200 dark:border-gray-700",
};

interface ClinicalTrialMonitorPanelProps {
  onSelectStudy?: (relatedQuery: string, title: string) => void;
}

interface TrialSection {
  id: string;
  label: string;
  description: string;
  studies: TrialCardStudy[];
  badgeLabel: string;
}

export function ClinicalTrialMonitorPanel({ onSelectStudy }: ClinicalTrialMonitorPanelProps) {
  const {
    areas,
    studies,
    isLoading,
    error,
    partial,
    missingAreas,
    trackedAt,
    statuses,
  } = useClinicalTrials();
  const drugPipelineStudies = studies.filter((study) => study.pipelineScore >= 6);
  const [activeSection, setActiveSection] = useState("pipeline");
  const sections = useMemo(() => {
    const base: TrialSection[] = [];

    if (drugPipelineStudies.length > 0) {
      base.push({
        id: "pipeline",
        label: "Pipeline",
        description: "Candidate drugs, biologics, and targeted therapies prioritized first.",
        studies: drugPipelineStudies,
        badgeLabel: "Drug pipeline",
      });
    }

    for (const area of areas) {
      const areaStudies = studies.filter((study) => study.focusAreaIds.includes(area.id));
      if (areaStudies.length === 0) continue;
      base.push({
        id: area.id,
        label: area.label,
        description: `${area.label} trials grouped by disease-linked conditions and recent updates.`,
        studies: areaStudies,
        badgeLabel: area.label,
      });
    }

    return base;
  }, [areas, studies, drugPipelineStudies]);

  const resolvedActiveSection = sections.some((section) => section.id === activeSection)
    ? activeSection
    : sections[0]?.id ?? "pipeline";
  const currentSection =
    sections.find((section) => section.id === resolvedActiveSection) ?? sections[0];
  const currentStyle =
    SECTION_STYLES[currentSection?.id ?? ""] ?? DEFAULT_SECTION_STYLE;

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
        <div
          className="-mb-px flex gap-0.5 overflow-x-auto border-b border-gray-200 dark:border-gray-800"
          style={{ scrollbarWidth: "none" }}
        >
          {sections.map((section) => {
            const style = SECTION_STYLES[section.id] ?? DEFAULT_SECTION_STYLE;
            const isActive = resolvedActiveSection === section.id;

            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-lg border border-b-0 px-3 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? `${style.active} ${style.activeBorder} z-10`
                    : "border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-300"
                }`}
              >
                <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                {section.label}
                <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[11px] tabular-nums dark:bg-white/10">
                  {section.studies.length}
                </span>
              </button>
            );
          })}
        </div>

        <div className={`rounded-b-xl border border-t-0 ${currentStyle.activeBorder} p-4`}>
          {isLoading ? (
            <TrialListSkeleton />
          ) : sections.length === 0 || !currentSection ? (
            <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
              No ongoing trials found for this period.
            </p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <Activity className="h-3.5 w-3.5 text-emerald-500" />
                  {statuses.length > 0 ? statuses.join(" · ") : "Ongoing only"}
                </span>
                <span>{currentSection.description}</span>
                <span>{currentSection.studies.length} visible studies</span>
              </div>

              <ul className="space-y-1">
                {currentSection.studies.map((study, index) => (
                  <li key={study.nctId}>
                    <TrialListItem
                      index={index}
                      study={study}
                      onSelectStudy={onSelectStudy}
                    />
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                {currentSection.id !== "pipeline" &&
                  areas.find((area) => area.id === currentSection.id) && (
                    <span>
                      Based on{" "}
                      {areas
                        .find((area) => area.id === currentSection.id)
                        ?.totalCount.toLocaleString()}{" "}
                      ongoing studies
                    </span>
                  )}
                {currentSection.id === "pipeline" && (
                  <span>
                    Prioritized from {studies.length.toLocaleString()} tracked ongoing studies
                  </span>
                )}
                {partial && (
                  <span className="text-amber-600 dark:text-amber-300">
                    Partial data: {missingAreas.join(", ")}
                  </span>
                )}
                {error && !partial && (
                  <span className="text-rose-600 dark:text-rose-300">
                    Trial monitor temporarily unavailable
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

interface TrialCardStudy {
  nctId: string;
  title: string;
  status: string;
  statusLabel: string;
  phaseLabel: string;
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
  study: TrialCardStudy;
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
            {study.focusAreaLabels.slice(0, 2).map((label) => (
              <span
                key={label}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400"
              >
                {label}
              </span>
            ))}
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
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 transition-colors group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-400" />
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
