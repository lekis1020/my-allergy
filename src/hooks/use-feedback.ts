"use client";

import { useCallback } from "react";
import useSWR from "swr";
import { useAuth } from "./use-auth";

export type FeedbackKind = "interested" | "not_interested";

interface FeedbackRow {
  paper_pmid: string;
  feedback: FeedbackKind;
}

interface FeedbackResponse {
  feedback: FeedbackRow[];
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) return { feedback: [] } as FeedbackResponse;
    return r.json() as Promise<FeedbackResponse>;
  });

export function useFeedback() {
  const { user } = useAuth();
  const { data, mutate } = useSWR<FeedbackResponse>(
    user ? "/api/feedback" : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const rows = data?.feedback ?? [];
  const map = new Map<string, FeedbackKind>(
    rows.map((r) => [r.paper_pmid, r.feedback])
  );

  const setFeedback = useCallback(
    async (pmid: string, feedback: FeedbackKind) => {
      // Optimistic
      await mutate(
        (prev) => {
          const next = (prev?.feedback ?? []).filter((r) => r.paper_pmid !== pmid);
          next.push({ paper_pmid: pmid, feedback });
          return { feedback: next };
        },
        { revalidate: false }
      );
      try {
        await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pmid, feedback }),
        });
      } catch {
        await mutate();
      }
    },
    [mutate]
  );

  const clearFeedback = useCallback(
    async (pmid: string) => {
      await mutate(
        (prev) => ({
          feedback: (prev?.feedback ?? []).filter((r) => r.paper_pmid !== pmid),
        }),
        { revalidate: false }
      );
      try {
        await fetch("/api/feedback", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pmid }),
        });
      } catch {
        await mutate();
      }
    },
    [mutate]
  );

  const resetAll = useCallback(async () => {
    await fetch("/api/recommendations/reset", { method: "POST" });
    await mutate({ feedback: [] }, { revalidate: true });
  }, [mutate]);

  return {
    feedbackMap: map,
    getFeedback: (pmid: string) => map.get(pmid) ?? null,
    setFeedback,
    clearFeedback,
    resetAll,
    isLoggedIn: Boolean(user),
  };
}
