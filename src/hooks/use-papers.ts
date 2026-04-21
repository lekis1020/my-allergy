"use client";

import { useState } from "react";
import useSWRInfinite from "swr/infinite";
import type { PaperFilters, PapersResponse } from "@/types/filters";
import { buildApiUrl } from "@/lib/utils/url";

export type DataSource = "db" | "db+live" | "db (timeout)" | null;

async function fetcher(url: string): Promise<PapersResponse & { __source: DataSource }> {
  const res = await fetch(url);
  const source = (res.headers.get("X-Data-Source") as DataSource) ?? null;
  const json = (await res.json()) as PapersResponse;
  return { ...json, __source: source };
}

export function usePapers(filters: PaperFilters) {
  const [isLive, setIsLive] = useState(false);

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
      personalized: filters.personalized ? "true" : undefined,
      articleType: filters.articleType || undefined,
    });
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PapersResponse & { __source: DataSource }>(getKey, fetcher, {
      revalidateFirstPage: false,
      revalidateOnFocus: false,
      onSuccess: (pages) => {
        const latest = pages?.[0]?.__source ?? null;
        setIsLive(latest === "db+live");
      },
    });

  const papers = data ? data.flatMap((page) => page?.papers ?? []) : [];
  const total = data?.[0]?.total || 0;
  const hasMore = data ? data[data.length - 1]?.hasMore : false;
  const isLoadingMore = isLoading || (size > 0 && data && typeof data[size - 1] === "undefined");
  const dataSource: DataSource = data?.[0]?.__source ?? null;

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
    dataSource,
    isLive,
  };
}
