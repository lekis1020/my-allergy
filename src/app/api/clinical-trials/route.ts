import { NextResponse } from "next/server";
import {
  buildClinicalTrialsGovUrl,
  mergeAreaStudies,
  parseClinicalTrialsGovResponse,
  TRIAL_MONITOR_AREAS,
  type ClinicalTrialMonitorResponse,
} from "@/lib/clinical-trials/monitor";

export async function GET() {
  const results = await Promise.allSettled(
    TRIAL_MONITOR_AREAS.map(async (area) => {
      const response = await fetch(buildClinicalTrialsGovUrl(area.query), {
        headers: { accept: "application/json" },
        next: { revalidate: 21_600 },
      });

      if (!response.ok) {
        throw new Error(`${area.id}:${response.status}`);
      }

      const payload = (await response.json()) as Parameters<
        typeof parseClinicalTrialsGovResponse
      >[1];

      return parseClinicalTrialsGovResponse(area, payload);
    }),
  );

  const successful = results
    .filter((result): result is PromiseFulfilledResult<ReturnType<typeof parseClinicalTrialsGovResponse>> => result.status === "fulfilled")
    .map((result) => result.value);
  const missingAreas = results
    .flatMap((result, index) => (result.status === "rejected" ? [TRIAL_MONITOR_AREAS[index].label] : []));

  if (successful.length === 0) {
    return NextResponse.json(
      { error: "Failed to fetch clinical trial monitor" },
      { status: 502 },
    );
  }

  const response: ClinicalTrialMonitorResponse = {
    source: "clinicaltrials.gov",
    trackedAt: new Date().toISOString(),
    monitoredStatuses: [
      "Recruiting",
      "Active not recruiting",
      "Enrolling by invitation",
      "Not yet recruiting",
    ],
    areas: successful.map((result) => result.area),
    studies: mergeAreaStudies(successful),
    partial: missingAreas.length > 0,
    missingAreas,
  };

  const nextResponse = NextResponse.json(response);
  nextResponse.headers.set(
    "Cache-Control",
    "public, s-maxage=21600, stale-while-revalidate=43200",
  );
  return nextResponse;
}
