"use client";

import Link from "next/link";
import { ArrowRight, Microscope, Pill, Stethoscope } from "lucide-react";
import { useClinicalTrials } from "@/hooks/use-clinical-trials";

interface ClinicalTrialSummaryProps {
  onItemClick: (name: string) => void;
}

interface AggregatedItem {
  name: string;
  count: number;
  type: "intervention" | "condition";
}

export function ClinicalTrialSummary({ onItemClick }: ClinicalTrialSummaryProps) {
  const { studies, isLoading } = useClinicalTrials();

  if (isLoading) {
    return <ClinicalTrialSummarySkeleton />;
  }

  if (studies.length === 0) return null;

  const interventionCounts = new Map<string, number>();
  const conditionCounts = new Map<string, number>();

  for (const study of studies) {
    for (const intervention of study.interventions) {
      const key = intervention.toLowerCase().trim();
      if (key.length < 3) continue;
      interventionCounts.set(key, (interventionCounts.get(key) || 0) + 1);
    }
    for (const condition of study.conditions) {
      const key = condition.toLowerCase().trim();
      if (key.length < 3) continue;
      conditionCounts.set(key, (conditionCounts.get(key) || 0) + 1);
    }
  }

  const items: AggregatedItem[] = [];

  for (const [name, count] of interventionCounts) {
    items.push({ name, count, type: "intervention" });
  }
  for (const [name, count] of conditionCounts) {
    if (!interventionCounts.has(name)) {
      items.push({ name, count, type: "condition" });
    }
  }

  const topItems = items
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  if (topItems.length === 0) return null;

  return (
    <div className="border-t border-gray-200 px-4 py-4 dark:border-gray-800">
      <div className="mb-3 flex items-center gap-2">
        <Microscope className="h-4 w-4 text-emerald-500" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Trial Highlights
        </h2>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {studies.length} ongoing studies
        </span>
      </div>

      <ul className="space-y-1">
        {topItems.map((item, i) => {
          const Icon = item.type === "intervention" ? Pill : Stethoscope;
          return (
            <li key={`${item.type}-${item.name}`}>
              <button
                onClick={() => onItemClick(item.name)}
                className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  {i + 1}
                </span>
                <Icon className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-500" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium capitalize text-gray-900 dark:text-gray-100">
                  {item.name}
                </span>
                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs tabular-nums text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  {item.count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <Link
        href="/clinical-trials"
        className="mt-3 flex items-center gap-1 text-xs font-medium text-emerald-600 transition-colors hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
      >
        View all trials
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function ClinicalTrialSummarySkeleton() {
  return (
    <div className="border-t border-gray-200 px-4 py-4 dark:border-gray-800">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-4 w-4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-2 py-2">
            <div className="h-5 w-5 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 flex-1 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-8 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
          </div>
        ))}
      </div>
    </div>
  );
}
