"use client";

import useSWR from "swr";

interface TrendingTopic {
  keyword: string;
  count: number;
}

interface TrendingTopicsResponse {
  category: string;
  label: string;
  topics: TrendingTopic[];
  totalStudies: number;
  source: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useTrendingTopics(category: string) {
  const { data, error, isLoading } = useSWR<TrendingTopicsResponse>(
    category ? `/api/topics/trending?category=${category}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    },
  );

  return {
    data,
    topics: data?.topics || [],
    totalStudies: data?.totalStudies || 0,
    source: data?.source || "",
    isLoading,
    error,
  };
}
