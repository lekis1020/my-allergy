"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./use-auth";
import { useCommentToast } from "@/components/comments/toast-context";

interface ReplyPayload {
  id: string;
  paper_pmid: string;
  parent_id: string | null;
  user_id: string | null;
  content: string;
  created_at: string;
  deleted_at: string | null;
}

/**
 * Subscribe to realtime INSERTs on paper_comments and surface a toast
 * whenever someone replies to one of the logged-in user's own comments.
 *
 * Strategy:
 *   1. Fetch the current user's comment IDs once on mount.
 *   2. Subscribe to postgres_changes (event: INSERT) on paper_comments.
 *   3. When a new row arrives with parent_id ∈ myIds and user_id != me,
 *      push a toast.
 *   4. When a new row is authored by me, append to myIds so replies to
 *      fresh comments are picked up without reconnecting.
 */
export function useCommentNotifications() {
  const { user } = useAuth();
  const toast = useCommentToast();
  const myIdsRef = useRef<Set<string>>(new Set());
  const titleCache = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!user) {
      myIdsRef.current = new Set();
      return;
    }

    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("paper_comments")
        .select("id")
        .eq("user_id", user.id)
        .is("deleted_at", null);
      if (cancelled) return;
      myIdsRef.current = new Set((data ?? []).map((r) => r.id));
    })();

    const channel = supabase
      .channel(`comment-notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "paper_comments" },
        async (payload: { new: ReplyPayload }) => {
          const row = payload.new;
          if (!row || row.deleted_at) return;

          // Track own comments locally.
          if (row.user_id === user.id) {
            myIdsRef.current.add(row.id);
            return;
          }

          if (!row.parent_id || !myIdsRef.current.has(row.parent_id)) return;

          // Lazy-fetch the paper title for the toast.
          let title = titleCache.current.get(row.paper_pmid);
          if (!title) {
            const { data: paper } = await supabase
              .from("papers")
              .select("title")
              .eq("pmid", row.paper_pmid)
              .single();
            title = paper?.title ?? "해당 논문";
            titleCache.current.set(row.paper_pmid, title);
          }

          toast.push({
            title: "내 댓글에 답글이 달렸어요",
            description: title,
            href: `/paper/${row.paper_pmid}#comments`,
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user, toast]);
}
