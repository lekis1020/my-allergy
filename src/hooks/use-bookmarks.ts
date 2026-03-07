"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

const STORAGE_KEY = "my-allergy:bookmarks";

function readBookmarks(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed);
    return new Set();
  } catch {
    return new Set();
  }
}

function writeBookmarks(pmids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...pmids]));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());

  // Hydrate from localStorage on mount
  useEffect(() => {
    setBookmarks(readBookmarks());
  }, []);

  // Persist on change (skip initial empty set)
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (!hydrated) {
      setHydrated(true);
      return;
    }
    writeBookmarks(bookmarks);
  }, [bookmarks, hydrated]);

  const addBookmark = useCallback((pmid: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      next.add(pmid);
      return next;
    });
  }, []);

  const removeBookmark = useCallback((pmid: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      next.delete(pmid);
      return next;
    });
  }, []);

  const toggleBookmark = useCallback((pmid: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(pmid)) {
        next.delete(pmid);
      } else {
        next.add(pmid);
      }
      return next;
    });
  }, []);

  const isBookmarked = useCallback(
    (pmid: string) => bookmarks.has(pmid),
    [bookmarks]
  );

  const pmids = useMemo(() => [...bookmarks], [bookmarks]);

  return { bookmarks, pmids, addBookmark, removeBookmark, toggleBookmark, isBookmarked };
}
