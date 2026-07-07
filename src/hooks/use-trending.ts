"use client";

import useSWR from "swr";
import type { PaperWithJournal } from "@/types/filters";
import type { WeeklyRankedPaper } from "@/lib/trending/weekly";

export type TrendingWindow = "default" | "week";

export interface WeeklyPaperWithDelta extends WeeklyRankedPaper {
  prev_rank: number | null;
  rank_delta: number | null;
  is_new: boolean;
}

interface DefaultResponse {
  papers: PaperWithJournal[];
  window: "default";
  generatedAt: string;
}

interface WeekResponse {
  papers: WeeklyPaperWithDelta[];
  window: "week";
  weekStartsOn: string;
  hasPreviousWeek: boolean;
  generatedAt: string;
}

type TrendingResponse = DefaultResponse | WeekResponse;

const fetcher = async (url: string): Promise<TrendingResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Trending API error: ${res.status}`);
  return res.json();
};

export function useTrending(
  window: TrendingWindow,
  initialPapers?: PaperWithJournal[],
) {
  const key = window === "week" ? "/api/trending?window=week" : "/api/trending";

  const fallback =
    window === "default" && initialPapers
      ? ({
          papers: initialPapers,
          window: "default",
          generatedAt: new Date().toISOString(),
        } satisfies DefaultResponse)
      : undefined;

  const { data, error, isLoading } = useSWR<TrendingResponse>(key, fetcher, {
    revalidateOnFocus: false,
    fallbackData: fallback,
  });

  if (!data) {
    return { window, papers: [] as PaperWithJournal[], weekPapers: [] as WeeklyPaperWithDelta[], isLoading, error, weekStartsOn: null as string | null, hasPreviousWeek: false };
  }

  if (data.window === "week") {
    return {
      window: "week" as const,
      papers: [] as PaperWithJournal[],
      weekPapers: data.papers,
      weekStartsOn: data.weekStartsOn,
      hasPreviousWeek: data.hasPreviousWeek,
      isLoading,
      error,
    };
  }

  return {
    window: "default" as const,
    papers: data.papers,
    weekPapers: [] as WeeklyPaperWithDelta[],
    weekStartsOn: null,
    hasPreviousWeek: false,
    isLoading,
    error,
  };
}
