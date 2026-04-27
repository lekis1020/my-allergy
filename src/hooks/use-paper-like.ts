"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";

export function usePaperLike(pmid: string, initialCount: number) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(async () => {
    if (!user || loading) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/papers/${pmid}/like`, { method: "POST" });
      if (!res.ok) return;

      const data = await res.json();
      setLiked(data.liked);
      setCount((prev) => (data.liked ? prev + 1 : Math.max(0, prev - 1)));
    } finally {
      setLoading(false);
    }
  }, [pmid, user, loading]);

  return { liked, count, toggle, loading };
}
