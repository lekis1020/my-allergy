"use client";

import { useEffect, useState } from "react";
import { Clock3, Database, MapPin } from "lucide-react";
import { AdBanner } from "@/components/ads/ad-banner";
import { inferLocationFromAffiliation } from "@/lib/utils/author-location";
import { useDbStatus } from "@/hooks/use-db-status";
import type { PaperWithJournal } from "@/types/filters";

interface RightRailProps {
  total: number;
  papers: PaperWithJournal[];
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
  const { totalPapers: dbTotal, lastSyncAt, newestPaper, isLoading: dbLoading } = useDbStatus();
  const [authorInsights, setAuthorInsights] = useState<AuthorLeadersResponse | null>(null);

  useEffect(() => {
    let active = true;

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

  const correspondingLeaders =
    authorInsights?.correspondingAuthors ?? buildAuthorLeaders(papers, "corresponding");

  return (
    <aside className="space-y-4">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          <Database className="h-4 w-4 text-blue-500" />
          Database
        </h3>
        <div className="space-y-3 text-sm">
          <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
            <p className="font-medium text-gray-900 dark:text-gray-100">Total papers</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
              {dbLoading ? "..." : dbTotal.toLocaleString()}
            </p>
            {total !== dbTotal && total > 0 && !dbLoading && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {total.toLocaleString()} matching current filters
              </p>
            )}
          </div>
          <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
            <p className="flex items-center gap-1 font-medium text-gray-900 dark:text-gray-100">
              <Clock3 className="h-4 w-4 text-amber-500" />
              Last sync
            </p>
            <p className="mt-1 text-gray-600 dark:text-gray-300">
              {lastSyncAt ? formatRelativeSyncTime(lastSyncAt) : "No sync data"}
            </p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Daily at midnight
            </p>
          </div>
          {newestPaper && (
            <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
              <p className="font-medium text-gray-900 dark:text-gray-100">Newest paper</p>
              <p className="mt-1 text-gray-600 dark:text-gray-300">{newestPaper}</p>
            </div>
          )}
        </div>
      </section>

      <AdBanner variant="right-rail" />

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

function formatRelativeSyncTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
