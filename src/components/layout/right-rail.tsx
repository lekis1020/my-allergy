"use client";

import { Clock3, Database } from "lucide-react";
import { AdBanner } from "@/components/ads/ad-banner";
import { useDbStatus } from "@/hooks/use-db-status";

interface RightRailProps {
  total: number;
}

export function RightRail({ total }: RightRailProps) {
  const { totalPapers: dbTotal, lastSyncAt, newestPaper, isLoading: dbLoading } = useDbStatus();

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
    </aside>
  );
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
