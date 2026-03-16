"use client";

import { useMemo, useState } from "react";
import { Activity, ArrowUpRight, Microscope, TimerReset } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useClinicalTrials } from "@/hooks/use-clinical-trials";
import { formatDate, formatRelativeDate } from "@/lib/utils/date";

const AREA_ACCENTS: Record<string, string> = {
  asthma: "bg-red-500",
  food_allergy: "bg-emerald-500",
  atopic_dermatitis: "bg-violet-500",
  rhinitis: "bg-amber-500",
  urticaria: "bg-pink-500",
  immunodeficiency: "bg-blue-500",
};

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
      <div className="rounded-3xl border border-emerald-200/70 bg-[linear-gradient(135deg,rgba(236,253,245,0.95),rgba(239,246,255,0.95))] p-4 shadow-sm dark:border-emerald-900/60 dark:bg-[linear-gradient(135deg,rgba(6,24,18,0.96),rgba(8,19,38,0.96))]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-semibold text-emerald-800 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-emerald-200">
              <Microscope className="h-3.5 w-3.5" />
              Clinical Trial Monitor
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                Ongoing allergy & clinical immunology trials
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-gray-600 dark:text-gray-300">
                Official ClinicalTrials.gov feed across the portal&apos;s core focus areas, surfaced as recent updates with projected study progress.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 dark:bg-white/5">
              <Activity className="h-3.5 w-3.5 text-emerald-500" />
              {statuses.length > 0 ? statuses.join(" · ") : "Ongoing only"}
            </span>
            {trackedAt && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 dark:bg-white/5">
                <TimerReset className="h-3.5 w-3.5 text-blue-500" />
                Updated {formatRelativeDate(trackedAt)}
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
            {isLoading && areas.length === 0 && (
              Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-20 animate-pulse rounded-2xl bg-white/70 dark:bg-white/5"
                />
              ))
            )}

            {!isLoading && areas.map((area) => (
              <div
                key={area.id}
                className="rounded-2xl border border-white/70 bg-white/80 p-3 shadow-sm dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${AREA_ACCENTS[area.id] ?? "bg-gray-400"}`} />
                  <p className="truncate text-xs font-medium uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                    {area.label}
                  </p>
                </div>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                  {area.totalCount.toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  ongoing studies
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            {isLoading && studies.length === 0 && (
              Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-36 animate-pulse rounded-2xl bg-white/70 dark:bg-white/5"
                />
              ))
            )}

            {!isLoading && studies.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/80 bg-white/60 px-4 py-6 text-sm text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
                Unable to load the trial monitor right now.
              </div>
            )}

            {sections.length > 0 && currentSection && (
              <div className="relative">
                <div
                  className="-mb-px flex gap-0.5 overflow-x-auto border-b border-white/60 dark:border-white/10"
                  style={{ scrollbarWidth: "none" }}
                >
                  {sections.map((section) => {
                    const style = SECTION_STYLES[section.id] ?? DEFAULT_SECTION_STYLE;
                    const isActive = resolvedActiveSection === section.id;

                    return (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-xl border border-b-0 px-3 py-2 text-xs font-medium transition-colors ${
                          isActive
                            ? `${style.active} ${style.activeBorder} z-10`
                            : "border-transparent text-gray-500 hover:bg-white/60 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
                        }`}
                      >
                        <span className={`inline-block h-2 w-2 rounded-full ${style.dot}`} />
                        {section.label}
                        <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[11px] tabular-nums dark:bg-white/10">
                          {section.studies.length}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className={`rounded-b-2xl border border-t-0 ${currentStyle.activeBorder} p-4`}>
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${currentStyle.active}`}>
                        {currentSection.badgeLabel}
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {currentSection.description}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {currentSection.studies.length} visible studies
                    </p>
                  </div>
                  <div className="space-y-3">
                    {currentSection.studies.map((study) => (
                      <TrialCard key={study.nctId} study={study} onSelectStudy={onSelectStudy} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {partial && (
          <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
            Partial data: {missingAreas.join(", ")} could not be refreshed from ClinicalTrials.gov.
          </p>
        )}

        {error && !partial && (
          <p className="mt-3 text-xs text-rose-700 dark:text-rose-300">
            Trial monitor temporarily unavailable.
          </p>
        )}
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

function TrialCard({
  study,
  onSelectStudy,
}: {
  study: TrialCardStudy;
  onSelectStudy?: (relatedQuery: string, title: string) => void;
}) {
  const progress = study.progressPercent ?? 0;
  const statusStyle = STATUS_STYLES[study.status] ?? STATUS_STYLES.UNKNOWN;

  return (
    <article className="rounded-2xl border border-white/70 bg-white/88 p-4 shadow-sm transition-colors hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/[0.07]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle}`}>
              {study.statusLabel}
            </span>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {study.phaseLabel}
            </span>
            {study.focusAreaLabels.slice(0, 2).map((label) => (
              <Badge key={label} className="border border-white/60 bg-white/80 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                {label}
              </Badge>
            ))}
          </div>

          <h3 className="mt-3 line-clamp-2 text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100">
            {study.title}
          </h3>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
            <span>{study.nctId}</span>
            {study.sponsor && <span>{study.sponsor}</span>}
            {study.lastUpdated && <span>Updated {formatDate(study.lastUpdated)}</span>}
          </div>

          {study.interventions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {study.interventions.slice(0, 3).map((intervention) => (
                <Badge
                  key={intervention}
                  className="border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  {intervention}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-row gap-2 sm:flex-col sm:items-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onSelectStudy?.(study.relatedQuery, study.title)}
            className="border border-white/70 bg-white/80 text-gray-700 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
          >
            Show related papers
          </Button>
          <a
            href={study.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-200"
          >
            View trial
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{study.progressLabel}</span>
          <span>{study.progressPercent !== null ? `${progress}%` : "TBD"}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-emerald-100/80 dark:bg-emerald-950/40">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          {study.startDate && <span>Start {formatDate(study.startDate)}</span>}
          {study.targetDate && (
            <span>
              {study.targetDateLabel} {formatDate(study.targetDate)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
