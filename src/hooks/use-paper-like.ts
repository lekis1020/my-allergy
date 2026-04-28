"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

export function usePaperLike(pmid: string, initialCount: number) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  // Check if current user has liked this paper + get total count
  useEffect(() => {
    fetch(`/api/papers/${pmid}/like`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setLiked(data.liked);
          setCount(data.count);
        }
      })
      .catch(() => {});
  }, [pmid]);

  const toggle = useCallback(async () => {
    if (!user || loading) return;

    // Optimistic update
    const prevLiked = liked;
    const prevCount = count;
    setLiked(!prevLiked);
    setCount(prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1);

    setLoading(true);
    try {
      const res = await fetch(`/api/papers/${pmid}/like`, { method: "POST" });
      if (!res.ok) {
        setLiked(prevLiked);
        setCount(prevCount);
        return;
      }

      const data = await res.json();
      setLiked(data.liked);
      setCount(data.count);
    } finally {
      setLoading(false);
    }
  }, [pmid, user, loading, liked, count]);

  return { liked, count, toggle, loading };
}
