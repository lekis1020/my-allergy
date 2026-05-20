"use client";

import useSWR from "swr";

interface DbStatus {
  totalPapers: number;
  papersWithAbstract: number;
  lastSyncAt: string | null;
  newestPaper: string | null;
}

const fetcher = async (url: string): Promise<DbStatus> => {
  const res = await fetch(url);
  // Throwing on non-2xx keeps SWR from caching an error payload (e.g. a 503
  // from the route on a transient Supabase count failure) as if it were data —
  // which previously caused `data.totalPapers` to fall through `?? 0` and
  // render "0" in the right rail.
  if (!res.ok) throw new Error(`db-status fetch failed: ${res.status}`);
  return res.json();
};

export function useDbStatus() {
  const { data, error, isLoading } = useSWR<DbStatus>(
    "/api/db-status",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300_000,
      keepPreviousData: true,
    },
  );

  return {
    totalPapers: data?.totalPapers ?? 0,
    papersWithAbstract: data?.papersWithAbstract ?? 0,
    lastSyncAt: data?.lastSyncAt ?? null,
    newestPaper: data?.newestPaper ?? null,
    isLoading,
    error,
  };
}
