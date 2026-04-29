"use client";

import useSWR from "swr";
import { useAuth } from "./use-auth";

export interface BookmarkPaper {
  pmid: string;
  title: string;
}

const fetcher = (url: string) =>
  fetch(url)
    .then((r) => r.json())
    .then((d) => (d.papers as BookmarkPaper[]) ?? []);

export function useBookmarksWithTitles() {
  const { user } = useAuth();

  const { data, isLoading } = useSWR<BookmarkPaper[]>(
    user ? "/api/bookmarks/with-titles" : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  return { papers: data ?? [], loading: isLoading };
}
