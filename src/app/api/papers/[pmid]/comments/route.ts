import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient, createServiceClient } from "@/lib/supabase/server";
import { generateAnonId } from "@/lib/comments/anon-id";
import { commentWriteLimiter } from "@/lib/comments/rate-limit";
import type {
  CommentDTO,
  CommentThreadNode,
} from "@/lib/comments/types";

import { isAdmin } from "@/lib/auth/admin";
import { buildNotificationRows } from "@/lib/notifications/generate";

const EDIT_WINDOW_MS = 5 * 60 * 1000;

function toDto(
  row: {
    id: string;
    paper_pmid: string;
    parent_id: string | null;
    anon_id: string;
    content: string;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    user_id: string | null;
  },
  currentUserId: string | null,
  isAdmin: boolean = false
): CommentDTO {
  const isOwn = currentUserId !== null && row.user_id === currentUserId;
  const ageMs = Date.now() - new Date(row.created_at).getTime();
  return {
    id: row.id,
    paper_pmid: row.paper_pmid,
    parent_id: row.parent_id,
    anon_id: row.anon_id,
    content: row.deleted_at ? "" : row.content,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    is_own: isOwn,
    can_edit: isOwn && row.deleted_at === null && ageMs < EDIT_WINDOW_MS,
    can_delete: (isOwn || isAdmin) && row.deleted_at === null,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pmid: string }> }
) {
  const { pmid } = await params;
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("paper_comments")
    .select(
      "id, paper_pmid, user_id, parent_id, anon_id, content, deleted_at, created_at, updated_at"
    )
    .eq("paper_pmid", pmid)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const currentUserId = user?.id ?? null;
  const adminFlag = isAdmin(user?.email);
  const rows = (data ?? []).map((r) => toDto(r, currentUserId, adminFlag));
  const roots = rows.filter((r) => r.parent_id === null);
  const childrenByParent = new Map<string, CommentDTO[]>();
  for (const r of rows) {
    if (r.parent_id) {
      const arr = childrenByParent.get(r.parent_id) ?? [];
      arr.push(r);
      childrenByParent.set(r.parent_id, arr);
    }
  }

  const thread: CommentThreadNode[] = roots.map((r) => ({
    ...r,
    children: childrenByParent.get(r.id) ?? [],
  }));

  return NextResponse.json({ thread });
}

interface PostBody {
  content?: string;
  parent_id?: string | null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pmid: string }> }
) {
  const { pmid } = await params;
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.email_confirmed_at) {
    return NextResponse.json(
      { error: "Email verification required" },
      { status: 403 }
    );
  }

  const limit = commentWriteLimiter.check(`comments:${user.id}`);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many comments. Try again in a moment." },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as PostBody;
  const content = (body.content ?? "").trim();
  const parentId = body.parent_id ?? null;

  if (!content || content.length < 1 || content.length > 2000) {
    return NextResponse.json(
      { error: "Content must be 1–2000 characters" },
      { status: 400 }
    );
  }

  // Verify paper exists.
  const { data: paper, error: paperErr } = await supabase
    .from("papers")
    .select("pmid")
    .eq("pmid", pmid)
    .single();
  if (paperErr || !paper) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  // Enforce 1-level nesting (also enforced by DB trigger).
  if (parentId) {
    const { data: parent, error: parentErr } = await supabase
      .from("paper_comments")
      .select("id, parent_id, paper_pmid, deleted_at")
      .eq("id", parentId)
      .single();
    if (parentErr || !parent) {
      return NextResponse.json(
        { error: "Parent comment not found" },
        { status: 404 }
      );
    }
    if (parent.parent_id !== null) {
      return NextResponse.json(
        { error: "Replies to replies are not allowed" },
        { status: 400 }
      );
    }
    if (parent.paper_pmid !== pmid) {
      return NextResponse.json(
        { error: "Parent comment belongs to a different paper" },
        { status: 400 }
      );
    }
    if (parent.deleted_at) {
      return NextResponse.json(
        { error: "Parent comment is deleted" },
        { status: 400 }
      );
    }
  }

  const anonId = generateAnonId(pmid, user.id);

  const { data: inserted, error: insertErr } = await supabase
    .from("paper_comments")
    .insert({
      paper_pmid: pmid,
      user_id: user.id,
      parent_id: parentId,
      anon_id: anonId,
      content,
    })
    .select(
      "id, paper_pmid, user_id, parent_id, anon_id, content, deleted_at, created_at, updated_at"
    )
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Failed to create comment" },
      { status: 500 }
    );
  }

  // Generate notifications (fire-and-forget, don't block response)
  try {
    const serviceClient = createServiceClient();

    // 1. Users who bookmarked this paper
    const { data: bookmarks } = await serviceClient
      .from("bookmarks")
      .select("user_id")
      .eq("pmid", pmid);
    const bookmarkUserIds = (bookmarks ?? []).map((b) => b.user_id);

    // 2. Users who previously commented on this paper
    const { data: commenters } = await serviceClient
      .from("paper_comments")
      .select("user_id")
      .eq("paper_pmid", pmid)
      .not("user_id", "is", null)
      .neq("id", inserted.id);
    const commentUserIds = [
      ...new Set(
        (commenters ?? [])
          .map((c) => c.user_id)
          .filter((id): id is string => id !== null)
      ),
    ];

    const rows = buildNotificationRows({
      commentAuthorId: user.id,
      commentId: inserted.id,
      pmid,
      bookmarkUserIds,
      commentUserIds,
    });

    if (rows.length > 0) {
      await serviceClient.from("notifications").upsert(rows, {
        onConflict: "user_id,comment_id,type",
        ignoreDuplicates: true,
      });
    }
  } catch (err) {
    console.error("[Notifications] Failed to generate notifications:", err);
  }

  return NextResponse.json({ comment: toDto(inserted, user.id, isAdmin(user.email)) }, { status: 201 });
}
