"use client";

import { useState, useLayoutEffect, useRef } from "react";
import useSWRInfinite, { unstable_serialize } from "swr/infinite";
import { useSWRConfig } from "swr";
import type { PaperFilters, PapersResponse } from "@/types/filters";
import { buildApiUrl } from "@/lib/utils/url";

export type DataSource = "db" | "db+live" | "db (timeout)" | null;

async function fetcher(url: string): Promise<PapersResponse & { __source: DataSource }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Papers API error: ${res.status}`);
  const source = (res.headers.get("X-Data-Source") as DataSource) ?? null;
  const json = (await res.json()) as PapersResponse;
  return { ...json, __source: source };
}

interface UsePapersOptions {
  // When true, skip the on-mount revalidation of the first page. Safe only when
  // the SSR `initialData` fully matches what the API would return — i.e. for
  // anonymous users, where no per-user bookmark/like state needs layering in.
  skipMountRevalidation?: boolean;
}

export function buildPapersKey(filters: PaperFilters, pageIndex: number, previousPageData: PapersResponse | null) {
  if (previousPageData && !previousPageData.hasMore) return null;

  // Keyset pagination: the first page has no cursor; each later page uses the
  // opaque nextCursor returned by the page before it.
  const cursor = pageIndex === 0 ? undefined : previousPageData?.nextCursor ?? undefined;
  if (pageIndex > 0 && !cursor) return null;

  return buildApiUrl("/api/papers", {
    q: filters.q,
    journals: filters.journals?.join(","),
    from: filters.from,
    to: filters.to,
    sort: filters.sort,
    cursor,
    limit: filters.limit || 10,
    personalized: filters.personalized ? "true" : undefined,
    articleType: filters.articleType || undefined,
  });
}

export function isDefaultTimelineFilters(filters: PaperFilters): boolean {
  return (
    !filters.q &&
    !filters.journals?.length &&
    !filters.from &&
    !filters.to &&
    !filters.personalized &&
    !filters.articleType &&
    (filters.sort === undefined || filters.sort === "date_desc")
  );
}

export function usePapers(
  filters: PaperFilters,
  initialData?: PapersResponse,
  options?: UsePapersOptions,
) {
  const [isLive, setIsLive] = useState(false);
  const { mutate: globalMutate } = useSWRConfig();
  const seededKeyRef = useRef<string | null>(null);

  const getKey = (pageIndex: number, previousPageData: PapersResponse | null) =>
    buildPapersKey(filters, pageIndex, previousPageData);

  // Use server-fetched data as fallback for the first page (default timeline)
  const fallback = initialData
    ? [{ ...initialData, __source: "db" as DataSource }]
    : undefined;

  // SWR Infinite's fallbackData paints page 1 but does not write the per-page
  // cache entry. setSize then treats page 1 as missing and refetches it before
  // page 2. Seed the page-0 key when SSR data is authoritative for anon.
  const page0Key = getKey(0, null);
  const shouldSeed =
    Boolean(options?.skipMountRevalidation && fallback && page0Key) &&
    isDefaultTimelineFilters(filters);
  useLayoutEffect(() => {
    if (!shouldSeed || !page0Key || !initialData) return;
    if (seededKeyRef.current === page0Key) return;
    seededKeyRef.current = page0Key;
    const pageData = { ...initialData, __source: "db" as DataSource };
    void globalMutate(page0Key, pageData, { revalidate: false });
    // Infinite key: setSize calls mutate(infiniteCache.data). If that is
    // undefined, SWR sets forceRevalidateAll and refetches page 1 anyway.
    void globalMutate(unstable_serialize(() => page0Key), [pageData], {
      revalidate: false,
    });
  }, [shouldSeed, page0Key, initialData, globalMutate]);

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PapersResponse & { __source: DataSource }>(getKey, fetcher, {
      revalidateFirstPage: false,
      revalidateOnFocus: false,
      // Skip the redundant first-page fetch when SSR data already matches
      // (anonymous users). Authenticated users still revalidate so their
      // per-user bookmark/like state is fetched.
      revalidateOnMount: !(options?.skipMountRevalidation && fallback),
      keepPreviousData: true,
      fallbackData: fallback,
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
