"use client";

import { useRouter } from "next/navigation";
import { Microscope } from "lucide-react";
import { ClinicalTrialMonitorPanel } from "@/components/layout/clinical-trial-monitor-panel";

export function ClinicalTrialsFeed() {
  const router = useRouter();

  const handleSelectStudy = (relatedQuery: string, title: string) => {
    router.push(
      `/?q=${encodeURIComponent(relatedQuery)}&trial=${encodeURIComponent(title)}`,
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1280px] px-0 sm:px-4 sm:py-4">
      <div className="mx-auto max-w-2xl border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="sticky top-14 z-20 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
          <div className="flex items-center gap-2">
            <Microscope className="h-5 w-5 text-emerald-500" />
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Clinical Trials
            </h1>
          </div>
        </div>

        <ClinicalTrialMonitorPanel onSelectStudy={handleSelectStudy} />
      </div>
    </div>
  );
}
