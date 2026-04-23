"use client";

import useSWR from "swr";
import type { PaperWithJournal } from "@/types/filters";

interface TrendingResponse {
  papers: PaperWithJournal[];
  generatedAt: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

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
