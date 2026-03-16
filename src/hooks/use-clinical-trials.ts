"use client";

import useSWR from "swr";
import type { ClinicalTrialMonitorResponse } from "@/lib/clinical-trials/monitor";

const fetcher = async (url: string): Promise<ClinicalTrialMonitorResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch clinical trials");
  }
  return response.json() as Promise<ClinicalTrialMonitorResponse>;
};

export function useClinicalTrials() {
  const { data, error, isLoading } = useSWR<ClinicalTrialMonitorResponse>(
    "/api/clinical-trials",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30 * 60 * 1000,
    },
  );

  return {
    data,
    areas: data?.areas ?? [],
    studies: data?.studies ?? [],
    isLoading,
    error,
    partial: data?.partial ?? false,
    missingAreas: data?.missingAreas ?? [],
    trackedAt: data?.trackedAt ?? null,
    statuses: data?.monitoredStatuses ?? [],
  };
}
