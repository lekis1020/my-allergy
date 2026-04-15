"use client";

import { useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./use-auth";
import { useCommentToast } from "@/components/comments/toast-context";

interface ReplyPayload {
  id: string;
  paper_pmid: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  deleted_at: string | null;
}

// Module-level registry shared between hook instance and registerOwnComment()
// callers (e.g. CommentForm after POST). Scoped per-user via currentUserId.
const ownIds = new Set<string>();
let currentUserId: string | null = null;

/**
 * Called by CommentForm / edit handlers when the logged-in user authors a new
 * comment. Keeps the notification filter in sync without re-fetching.
 */
export function registerOwnComment(id: string) {
  if (currentUserId) ownIds.add(id);
}

/**
 * Subscribe to realtime INSERTs on paper_comments and surface a toast
 * whenever someone replies to one of the logged-in user's own comments.
 *
 * Privacy note: the Realtime publication excludes `user_id` (see migration
 * 00019_harden.sql) so payloads do not leak authorship. Instead we maintain
 * `ownIds` locally — seeded on mount, kept current via registerOwnComment().
 */
export function useCommentNotifications() {
  const { user } = useAuth();
  const toast = useCommentToast();
  const titleCache = useRef<Map<string, string>>(new Map());

  const pushReplyToast = useCallback(
    async (row: ReplyPayload) => {
      const supabase = createClient();
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
    },
    [toast]
  );

  useEffect(() => {
    if (!user) {
      currentUserId = null;
      ownIds.clear();
      return;
    }

    currentUserId = user.id;
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("paper_comments")
        .select("id")
        .eq("user_id", user.id)
        .is("deleted_at", null);
      if (cancelled) return;
      ownIds.clear();
      for (const r of data ?? []) ownIds.add(r.id);
    })();

    const channel = supabase
      .channel(`comment-notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "paper_comments" },
        async (payload: { new: ReplyPayload }) => {
          const row = payload.new;
          if (!row || row.deleted_at) return;
          if (!row.parent_id || !ownIds.has(row.parent_id)) return;
          await pushReplyToast(row);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user, pushReplyToast]);
}
