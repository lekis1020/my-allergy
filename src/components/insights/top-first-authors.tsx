"use client";

import { useEffect, useState } from "react";
import { MapPin, TrendingUp } from "lucide-react";

interface AuthorLeader {
  name: string;
  count: number;
  location: string;
}

interface AuthorLeadersResponse {
  days: number;
  totalPapers: number;
  firstAuthors: AuthorLeader[];
}

/**
 * Top first authors over the trailing 180 days, sourced from the
 * /api/insights/author-leaders endpoint. Rendered in the Trending page's
 * left sidebar.
 */
export function TopFirstAuthors() {
  const [insights, setInsights] = useState<AuthorLeadersResponse | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    fetch("/api/insights/author-leaders?days=180", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!active) return;
        if (data) setInsights(data as AuthorLeadersResponse);
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const leaders = insights?.firstAuthors ?? [];

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
        <TrendingUp className="h-4 w-4 text-emerald-500" />
        Top First Authors
      </h3>
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        {insights
          ? `Source: database (${insights.days} days, ${insights.totalPapers} papers)`
          : "Most-published first authors over the last 180 days"}
      </p>
      <div className="space-y-2">
        {leaders.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {loaded ? "No author data yet." : "Loading..."}
          </p>
        )}
        {leaders.map((author) => (
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
  );
}
