"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin, TrendingUp } from "lucide-react";
import { AuthorWorldMap } from "@/components/maps/author-world-map";
import {
  type AuthorLocationPoint,
} from "@/lib/utils/author-location";

interface GeographyInsightsResponse {
  source: "database";
  days: number;
  asOf: string;
  fromDate: string;
  totalFirstAuthors: number;
  locations: Array<{
    location: string;
    count: number;
    latestPublicationDate: string;
    lat: number | null;
    lon: number | null;
  }>;
}

interface AuthorLeader {
  name: string;
  count: number;
  location: string;
}

interface AuthorLeadersResponse {
  source: "database";
  days: number;
  asOf: string;
  fromDate: string;
  totalPapers: number;
  firstAuthors: AuthorLeader[];
  correspondingAuthors: AuthorLeader[];
}

export function InsightsView() {
  const [geoInsights, setGeoInsights] = useState<GeographyInsightsResponse | null>(null);
  const [authorInsights, setAuthorInsights] = useState<AuthorLeadersResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/insights/author-geography?days=180").then((r) => r.ok ? r.json() : null),
      fetch("/api/insights/author-leaders?days=180").then((r) => r.ok ? r.json() : null),
    ]).then(([geo, authors]) => {
      if (!active) return;
      if (geo) setGeoInsights(geo as GeographyInsightsResponse);
      if (authors) setAuthorInsights(authors as AuthorLeadersResponse);
      setLoading(false);
    }).catch(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const locationPoints: AuthorLocationPoint[] = useMemo(() => {
    if (!geoInsights?.locations?.length) return [];
    return geoInsights.locations
      .filter((e) => e.lat !== null && e.lon !== null)
      .map((e) => ({
        location: e.location,
        count: e.count,
        lat: e.lat as number,
        lon: e.lon as number,
        latestPublicationDate: e.latestPublicationDate,
      }));
  }, [geoInsights]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Geography */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-gray-100">
          <MapPin className="h-4 w-4 text-indigo-500" />
          First Author Geography
        </h2>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          {geoInsights
            ? `Last ${geoInsights.days} days · ${geoInsights.totalFirstAuthors} authors`
            : "No data available"}
        </p>
        {locationPoints.length > 0 ? (
          <>
            <AuthorWorldMap points={locationPoints} />
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {locationPoints.slice(0, 9).map((point) => (
                <div
                  key={point.location}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800"
                >
                  <p className="truncate text-sm text-gray-800 dark:text-gray-200">{point.location}</p>
                  <span className="ml-2 shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                    {point.count}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">No mappable affiliation data yet.</p>
        )}
      </section>

      {/* Top First Authors */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-gray-100">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          Top First Authors
        </h2>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          {authorInsights
            ? `Last ${authorInsights.days} days · ${authorInsights.totalPapers} papers`
            : "No data"}
        </p>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {(authorInsights?.firstAuthors ?? []).map((author, i) => (
            <div key={author.name} className="flex items-center gap-3 py-2.5">
              <span className="w-5 shrink-0 text-center text-xs font-bold text-gray-400">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{author.name}</p>
                <p className="flex items-center gap-1 truncate text-xs text-gray-500 dark:text-gray-400">
                  <MapPin className="h-3 w-3" />
                  {author.location}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                {author.count}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Corresponding Authors */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-1 text-base font-semibold text-gray-900 dark:text-gray-100">
          Likely Corresponding Authors
        </h2>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          {authorInsights
            ? `Last ${authorInsights.days} days · ${authorInsights.totalPapers} papers`
            : "No data"}
        </p>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {(authorInsights?.correspondingAuthors ?? []).map((author, i) => (
            <div key={author.name} className="flex items-center gap-3 py-2.5">
              <span className="w-5 shrink-0 text-center text-xs font-bold text-gray-400">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{author.name}</p>
                <p className="flex items-center gap-1 truncate text-xs text-gray-500 dark:text-gray-400">
                  <MapPin className="h-3 w-3" />
                  {author.location}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                {author.count}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
