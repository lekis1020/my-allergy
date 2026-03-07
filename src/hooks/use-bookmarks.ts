"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import useSWR from "swr";
import { useAuth } from "./use-auth";

const STORAGE_KEY = "my-allergy:bookmarks";

// --- localStorage helpers ---

function readLocalBookmarks(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalBookmarks(pmids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pmids));
  } catch {
    // localStorage full or unavailable
  }
}

function clearLocalBookmarks() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

// --- SWR fetcher ---

const fetcher = (url: string) =>
  fetch(url)
    .then((r) => r.json())
    .then((d) => (d.pmids as string[]) ?? []);

// --- Hook ---

export function useBookmarks() {
  const { user, loading: authLoading } = useAuth();
  const migrationDone = useRef(false);

  // SWR for server bookmarks (only when logged in)
  const {
    data: serverPmids,
    mutate,
    isLoading: swrLoading,
  } = useSWR<string[]>(user ? "/api/bookmarks" : null, fetcher, {
    revalidateOnFocus: false,
  });

  // Local bookmarks state (for unauthenticated users)
  const [localPmids, setLocalPmids] = useState<string[]>([]);
  const [localHydrated, setLocalHydrated] = useState(false);

  // Hydrate local bookmarks on mount
  useEffect(() => {
    setLocalPmids(readLocalBookmarks());
    setLocalHydrated(true);
  }, []);

  // Persist local bookmarks when they change (only for unauthenticated users)
  const skipInitialWrite = useRef(true);
  useEffect(() => {
    if (skipInitialWrite.current) {
      skipInitialWrite.current = false;
      return;
    }
    if (!user && localHydrated) {
      writeLocalBookmarks(localPmids);
    }
  }, [localPmids, user, localHydrated]);

  // Migrate localStorage → server on first login
  useEffect(() => {
    if (!user || !serverPmids || migrationDone.current) return;
    migrationDone.current = true;

    const localSet = readLocalBookmarks();
    if (localSet.length === 0) return;

    const serverSet = new Set(serverPmids);
    const toMigrate = localSet.filter((p) => !serverSet.has(p));

    if (toMigrate.length > 0) {
      Promise.all(
        toMigrate.map((pmid) =>
          fetch("/api/bookmarks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pmid }),
          })
        )
      ).then(() => {
        mutate([...serverPmids, ...toMigrate], { revalidate: false });
        clearLocalBookmarks();
        setLocalPmids([]);
      });
    } else {
      clearLocalBookmarks();
      setLocalPmids([]);
    }
  }, [user, serverPmids, mutate]);

  // Determine active bookmarks
  const pmids = useMemo(() => {
    if (user) return serverPmids ?? [];
    return localPmids;
  }, [user, serverPmids, localPmids]);

  const bookmarks = useMemo(() => new Set(pmids), [pmids]);

  const loading = authLoading || (user ? swrLoading : !localHydrated);

  const addBookmark = useCallback(
    (pmid: string) => {
      if (user) {
        mutate((prev) => (prev ? [...prev, pmid] : [pmid]), {
          revalidate: false,
        });
        fetch("/api/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pmid }),
        }).catch(() => mutate());
      } else {
        setLocalPmids((prev) =>
          prev.includes(pmid) ? prev : [...prev, pmid]
        );
      }
    },
    [user, mutate]
  );

  const removeBookmark = useCallback(
    (pmid: string) => {
      if (user) {
        mutate((prev) => prev?.filter((p) => p !== pmid) ?? [], {
          revalidate: false,
        });
        fetch("/api/bookmarks", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pmid }),
        }).catch(() => mutate());
      } else {
        setLocalPmids((prev) => prev.filter((p) => p !== pmid));
      }
    },
    [user, mutate]
  );

  const toggleBookmark = useCallback(
    (pmid: string) => {
      if (bookmarks.has(pmid)) {
        removeBookmark(pmid);
      } else {
        addBookmark(pmid);
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
    addBookmark,
    removeBookmark,
    toggleBookmark,
    isBookmarked,
  };
}
