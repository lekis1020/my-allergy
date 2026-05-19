"use client";

import useSWR from "swr";
import type { PaperWithJournal } from "@/types/filters";

interface TrendingResponse {
  papers: PaperWithJournal[];
  generatedAt: string;
}

const fetcher = async (url: string): Promise<TrendingResponse> => {
  const res = await fetch(url);
  // Without this check a 500 (e.g. trending query timeout) returns its JSON
  // error body as data, silently wiping the papers. Throw so SWR surfaces it
  // as an error and keeps the last good data instead.
  if (!res.ok) throw new Error(`Trending API error: ${res.status}`);
  return res.json();
};

export function useTrending(initialPapers?: PaperWithJournal[]) {
  const fallback = initialPapers
    ? { papers: initialPapers, generatedAt: new Date().toISOString() }
    : undefined;

  const { data, error, isLoading } = useSWR<TrendingResponse>(
    "/api/trending",
    fetcher,
    {
      revalidateOnFocus: false,
      fallbackData: fallback,
    }
  );

  return {
    papers: data?.papers ?? [],
    isLoading,
    error,
  };
}
