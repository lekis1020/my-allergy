"use client";

import useSWR from "swr";

interface DbStatus {
  totalPapers: number;
  papersWithAbstract: number;
  lastSyncAt: string | null;
  newestPaper: string | null;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

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
