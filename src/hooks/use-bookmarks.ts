"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import { useAuth } from "./use-auth";

// --- SWR fetcher ---

const fetcher = (url: string) =>
  fetch(url)
    .then((r) => r.json())
    .then((d) => (d.pmids as string[]) ?? []);

// --- Hook ---

export function useBookmarks() {
  const { user, loading: authLoading } = useAuth();

  const {
    data: serverPmids,
    mutate,
    isLoading: swrLoading,
  } = useSWR<string[]>(user ? "/api/bookmarks" : null, fetcher, {
    revalidateOnFocus: false,
  });

  const pmids = useMemo(() => {
    if (!user) return [];
    return serverPmids ?? [];
  }, [user, serverPmids]);

  const bookmarks = useMemo(() => new Set(pmids), [pmids]);

  const loading = authLoading || (user ? swrLoading : false);

  const addBookmark = useCallback(
    (pmid: string, aiSummary?: string) => {
      if (!user) return;
      mutate((prev) => (prev ? [...prev, pmid] : [pmid]), {
        revalidate: false,
      });
      fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pmid, ai_summary: aiSummary ?? null }),
      }).catch(() => mutate());
    },
    [user, mutate]
  );

  const removeBookmark = useCallback(
    (pmid: string) => {
      if (!user) return;
      mutate((prev) => prev?.filter((p) => p !== pmid) ?? [], {
        revalidate: false,
      });
      fetch("/api/bookmarks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pmid }),
      }).catch(() => mutate());
    },
    [user, mutate]
  );

  const toggleBookmark = useCallback(
    (pmid: string, aiSummary?: string) => {
      if (bookmarks.has(pmid)) {
        removeBookmark(pmid);
      } else {
        addBookmark(pmid, aiSummary);
      }
    },
    [bookmarks, addBookmark, removeBookmark]
  );

  const isBookmarked = useCallback(
    (pmid: string) => bookmarks.has(pmid),
    [bookmarks]
  );

  return {
    bookmarks,
    pmids,
    loading,
    isLoggedIn: !!user,
    addBookmark,
    removeBookmark,
    toggleBookmark,
    isBookmarked,
  };
}
