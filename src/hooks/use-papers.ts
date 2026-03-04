"use client";

import useSWRInfinite from "swr/infinite";
import type { PaperFilters, PapersResponse } from "@/types/filters";
import { buildApiUrl } from "@/lib/utils/url";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function usePapers(filters: PaperFilters) {
  const getKey = (pageIndex: number, previousPageData: PapersResponse | null) => {
    if (previousPageData && !previousPageData.hasMore) return null;

    return buildApiUrl("/api/papers", {
      q: filters.q,
      journals: filters.journals?.join(","),
      from: filters.from,
      to: filters.to,
      sort: filters.sort,
      page: pageIndex + 1,
      limit: filters.limit || 20,
    });
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PapersResponse>(getKey, fetcher, {
      revalidateFirstPage: false,
      revalidateOnFocus: false,
    });

  const papers = data ? data.flatMap((page) => page.papers) : [];
  const total = data?.[0]?.total || 0;
  const hasMore = data ? data[data.length - 1]?.hasMore : false;
  const isLoadingMore = isLoading || (size > 0 && data && typeof data[size - 1] === "undefined");

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
