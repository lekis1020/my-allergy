"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { AuthorWorldMap } from "@/components/maps/author-world-map";
import type { AuthorLocationPoint } from "@/lib/utils/author-location";

interface GeographyInsightsResponse {
  days: number;
  asOf: string;
  fromDate: string;
  locations: Array<{
    location: string;
    count: number;
    latestPublicationDate: string;
    lat: number | null;
    lon: number | null;
  }>;
}

/**
 * First author affiliation geography over the trailing 180 days, sourced from
 * the /api/insights/author-geography endpoint. Rendered in the Trending page's
 * right sidebar.
 */
export function FirstAuthorGeography() {
  const [insights, setInsights] = useState<GeographyInsightsResponse | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    fetch("/api/insights/author-geography?days=180")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!active) return;
        if (data) setInsights(data as GeographyInsightsResponse);
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const locationPoints: AuthorLocationPoint[] = useMemo(() => {
    if (!insights?.locations?.length) return [];
    return insights.locations
      .filter((entry) => entry.lat !== null && entry.lon !== null)
      .map((entry) => ({
        location: entry.location,
        count: entry.count,
        lat: entry.lat as number,
        lon: entry.lon as number,
        latestPublicationDate: entry.latestPublicationDate,
      }));
  }, [insights]);

  const asOfLabel = insights?.asOf ? new Date(insights.asOf).toLocaleString() : null;
  const periodLabel =
    insights?.fromDate && insights?.asOf
      ? `${insights.fromDate} to ${insights.asOf.slice(0, 10)}`
      : null;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
        <MapPin className="h-4 w-4 text-indigo-500" />
        First Author Geography
      </h3>
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        {insights
          ? `Source: database (${insights.days} days) · as of ${asOfLabel}`
          : "First author affiliations over the last 180 days"}
      </p>
      {periodLabel && (
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          Publication period: {periodLabel}
        </p>
      )}
      {locationPoints.length > 0 ? (
        <>
          <AuthorWorldMap points={locationPoints} />
          <div className="mt-3 space-y-1.5">
            {locationPoints.slice(0, 6).map((point) => (
              <div
                key={point.location}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <p className="truncate text-sm text-gray-800 dark:text-gray-200">
                  {point.location}
                </p>
                <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                  {point.count}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {loaded ? "No mappable author affiliation data yet." : "Loading map..."}
        </p>
      )}
    </section>
  );
}
