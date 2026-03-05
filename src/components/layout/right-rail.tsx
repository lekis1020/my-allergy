"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, MapPin, Sparkles, TrendingUp } from "lucide-react";
import { AuthorWorldMap } from "@/components/maps/author-world-map";
import {
  type AuthorLocationPoint,
  aggregateFirstAuthorLocations,
  inferLocationFromAffiliation,
} from "@/lib/utils/author-location";
import { decodeHtmlEntities } from "@/lib/utils/html-entities";
import type { PaperWithJournal } from "@/types/filters";

interface RightRailProps {
  total: number;
  papers: PaperWithJournal[];
}

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

interface AuthorLeadersResponse {
  source: "database";
  days: number;
  asOf: string;
  fromDate: string;
  totalPapers: number;
  firstAuthors: AuthorLeader[];
  correspondingAuthors: AuthorLeader[];
}

export function RightRail({ total, papers }: RightRailProps) {
  const latest = papers.slice(0, 5);
  const [geoInsights, setGeoInsights] = useState<GeographyInsightsResponse | null>(null);
  const [authorInsights, setAuthorInsights] = useState<AuthorLeadersResponse | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/insights/author-geography?days=180", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setGeoInsights(data as GeographyInsightsResponse);
      })
      .catch(() => {
        if (active) setGeoInsights(null);
      });

    fetch("/api/insights/author-leaders?days=180", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setAuthorInsights(data as AuthorLeadersResponse);
      })
      .catch(() => {
        if (active) setAuthorInsights(null);
      });

    return () => {
      active = false;
    };
  }, []);

  const firstAuthorLeaders = authorInsights?.firstAuthors ?? buildAuthorLeaders(papers, "first");
  const correspondingLeaders = authorInsights?.correspondingAuthors ?? buildAuthorLeaders(papers, "corresponding");

  const locationPoints: AuthorLocationPoint[] = useMemo(() => {
    if (geoInsights?.locations?.length) {
      return geoInsights.locations
        .filter((entry) => entry.lat !== null && entry.lon !== null)
        .map((entry) => ({
          location: entry.location,
          count: entry.count,
          lat: entry.lat as number,
          lon: entry.lon as number,
          latestPublicationDate: entry.latestPublicationDate,
        }));
    }
    return aggregateFirstAuthorLocations(papers);
  }, [geoInsights, papers]);

  const asOfLabel = geoInsights?.asOf
    ? new Date(geoInsights.asOf).toLocaleString()
    : null;
  const mapPeriodLabel = useMemo(() => {
    if (geoInsights?.fromDate && geoInsights?.asOf) {
      return `${geoInsights.fromDate} to ${geoInsights.asOf.slice(0, 10)}`;
    }

    if (papers.length === 0) return null;
    const dates = papers
      .map((paper) => paper.publication_date)
      .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
      .sort((a, b) => a.localeCompare(b));
    if (dates.length === 0) return null;
    return `${dates[0]} to ${dates[dates.length - 1]}`;
  }, [geoInsights, papers]);

  return (
    <aside className="space-y-4">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          <Sparkles className="h-4 w-4 text-blue-500" />
          What&apos;s happening
        </h3>
        <div className="space-y-3 text-sm">
          <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
            <p className="font-medium text-gray-900 dark:text-gray-100">Total papers in feed</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
              {total.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
            <p className="flex items-center gap-1 font-medium text-gray-900 dark:text-gray-100">
              <Clock3 className="h-4 w-4 text-amber-500" />
              Sync cadence
            </p>
            <p className="mt-1 text-gray-600 dark:text-gray-300">
              Every 6 hours, looking back 180 days.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          <MapPin className="h-4 w-4 text-indigo-500" />
          First Author Geography
        </h3>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          {geoInsights
            ? `Source: database (${geoInsights.days} days) · as of ${asOfLabel}`
            : "Source: currently loaded timeline"}
        </p>
        {mapPeriodLabel && (
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            Publication period: {mapPeriodLabel}
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
                  <p className="truncate text-sm text-gray-800 dark:text-gray-200">{point.location}</p>
                  <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                    {point.count}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No mappable author affiliation data yet.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          Top First Authors
        </h3>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          {authorInsights
            ? `Source: database (${authorInsights.days} days, ${authorInsights.totalPapers} papers)`
            : "Source: currently loaded timeline"}
        </p>
        <div className="space-y-2">
          {firstAuthorLeaders.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">No author data yet.</p>
          )}
          {firstAuthorLeaders.map((author) => (
            <div
              key={author.name}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {author.name}
                </p>
                <p className="inline-flex items-center gap-1 truncate text-xs text-gray-500 dark:text-gray-400">
                  <MapPin className="h-3 w-3" />
                  {author.location}
                </p>
              </div>
              <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                {author.count}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
          Likely Corresponding Authors
        </h3>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          {authorInsights
            ? `Source: database (${authorInsights.days} days, ${authorInsights.totalPapers} papers)`
            : "Source: currently loaded timeline"}
        </p>
        <div className="space-y-2">
          {correspondingLeaders.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">No corresponding-author signal yet.</p>
          )}
          {correspondingLeaders.map((author) => (
            <div
              key={author.name}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {author.name}
                </p>
                <p className="inline-flex items-center gap-1 truncate text-xs text-gray-500 dark:text-gray-400">
                  <MapPin className="h-3 w-3" />
                  {author.location}
                </p>
              </div>
              <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                {author.count}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Latest in timeline</h3>
        <div className="space-y-3">
          {latest.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">No items yet.</p>
          )}
          {latest.map((paper) => (
            <div key={paper.id} className="rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800">
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">{paper.journal_abbreviation}</p>
              <p className="line-clamp-2 text-sm text-gray-900 dark:text-gray-100">
                {decodeHtmlEntities(paper.title)}
              </p>
              <p className="mt-0.5 inline-flex items-center gap-1 truncate text-xs text-gray-500 dark:text-gray-400">
                <MapPin className="h-3 w-3" />
                {getFirstAuthorLocation(paper)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}

type LeaderMode = "first" | "corresponding";

interface AuthorLeader {
  name: string;
  count: number;
  location: string;
}

function buildAuthorLeaders(papers: PaperWithJournal[], mode: LeaderMode): AuthorLeader[] {
  const counter = new Map<string, { count: number; locations: Map<string, number> }>();

  for (const paper of papers) {
    const sortedAuthors = [...paper.authors].sort((a, b) => a.position - b.position);
    if (sortedAuthors.length === 0) continue;

    let target = sortedAuthors[0];
    if (mode === "corresponding") {
      const explicit = sortedAuthors.find((author) =>
        /@|correspond/i.test(author.affiliation ?? "")
      );
      target = explicit ?? sortedAuthors[sortedAuthors.length - 1];
    }

    const name = formatAuthorName(target.last_name, target.first_name, target.initials);
    const location = inferLocationFromAffiliation(target.affiliation);
    const current = counter.get(name);

    if (!current) {
      counter.set(name, {
        count: 1,
        locations: new Map([[location, 1]]),
      });
      continue;
    }

    current.count += 1;
    current.locations.set(location, (current.locations.get(location) ?? 0) + 1);
  }

  return [...counter.entries()]
    .map(([name, data]) => {
      const location = [...data.locations.entries()]
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown location";
      return { name, count: data.count, location };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 8);
}

function formatAuthorName(lastName: string, firstName: string | null, initials: string | null): string {
  if (initials) return `${lastName} ${initials}`;
  if (firstName) return `${lastName} ${firstName.charAt(0)}`;
  return lastName;
}

function getFirstAuthorLocation(paper: PaperWithJournal): string {
  const firstAuthor = [...paper.authors].sort((a, b) => a.position - b.position)[0];
  if (!firstAuthor) return "First author location unknown";
  return inferLocationFromAffiliation(firstAuthor.affiliation);
}
