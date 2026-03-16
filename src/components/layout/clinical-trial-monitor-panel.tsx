"use client";

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

interface ClinicalTrialMonitorPanelProps {
  onSelectStudy?: (relatedQuery: string, title: string) => void;
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
  const diseaseLinkedStudies = studies.filter((study) => study.pipelineScore < 6);

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

            {drugPipelineStudies.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                    Drug pipeline
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Interventional trials with candidate drugs, biologics, or targeted therapies first.
                  </p>
                </div>
                <div className="space-y-3">
                  {drugPipelineStudies.map((study) => (
                    <TrialCard key={study.nctId} study={study} onSelectStudy={onSelectStudy} />
                  ))}
                </div>
              </div>
            )}

            {diseaseLinkedStudies.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-800 dark:bg-sky-950/50 dark:text-sky-300">
                    Disease-linked trials
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Topic-focused studies grouped by allergy and clinical immunology conditions.
                  </p>
                </div>
                <div className="space-y-3">
                  {diseaseLinkedStudies.map((study) => (
                    <TrialCard key={study.nctId} study={study} onSelectStudy={onSelectStudy} />
                  ))}
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

function TrialCard({
  study,
  onSelectStudy,
}: {
  study: {
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
  };
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
