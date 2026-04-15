"use client";

import useSWR from "swr";
import { useAuth } from "@/hooks/use-auth";

const STORAGE_KEY = "my-allergy:comments:lastReadAt";

function getLastReadAt(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

async function fetcher(url: string): Promise<{ count: number }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export function UnreadRepliesBadge() {
  const { user } = useAuth();
  const since = typeof window !== "undefined" ? getLastReadAt() : null;
  const key = user
    ? `/api/comments/unread${since ? `?since=${encodeURIComponent(since)}` : ""}`
    : null;
  const { data } = useSWR(key, fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });

  if (!user || !data || data.count === 0) return null;

  return (
    <span className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">
      {data.count > 99 ? "99+" : data.count}
    </span>
  );
}

/** Call after the user visits their replies — e.g. on the bookmarks page. */
export function markRepliesRead() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
  } catch {
    // ignore
  }
}
