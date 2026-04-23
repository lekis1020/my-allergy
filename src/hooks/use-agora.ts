"use client";

import useSWRInfinite from "swr/infinite";
import type { PapersResponse } from "@/types/filters";
import { buildApiUrl } from "@/lib/utils/url";

async function fetcher(url: string): Promise<PapersResponse> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Agora fetch failed: ${res.status}`);
  return (await res.json()) as PapersResponse;
}

export function useAgora(
  { limit = 20 }: { limit?: number } = {},
  initialData?: PapersResponse,
) {
  const getKey = (pageIndex: number, previousPageData: PapersResponse | null) => {
    if (previousPageData && !previousPageData.hasMore) return null;
    return buildApiUrl("/api/agora", {
      page: pageIndex + 1,
      limit,
    });
  };

  const fallback = initialData ? [initialData] : undefined;

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PapersResponse>(getKey, fetcher, {
      revalidateFirstPage: true,
      revalidateOnFocus: true,
      fallbackData: fallback,
    });

  const papers = data ? data.flatMap((page) => page?.papers ?? []) : [];
  const total = data?.[0]?.total || 0;
  const hasMore = data ? data[data.length - 1]?.hasMore : false;
  const isLoadingMore =
    isLoading || (size > 0 && data && typeof data[size - 1] === "undefined");

  const loadMore = () => {
    if (hasMore && !isValidating) {
      setSize(size + 1);
    }
  };

  return {
    papers,
    total,
    hasMore,
    isLoading,
    isLoadingMore,
    isValidating,
    error,
    loadMore,
    mutate,
  };
}
