import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";

const EDIT_WINDOW_MS = 5 * 60 * 1000;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { content?: string };
  const content = (body.content ?? "").trim();
  if (!content || content.length < 1 || content.length > 2000) {
    return NextResponse.json(
      { error: "Content must be 1–2000 characters" },
      { status: 400 }
    );
  }

  const { data: existing, error: loadErr } = await supabase
    .from("paper_comments")
    .select("id, user_id, created_at, deleted_at")
    .eq("id", id)
    .single();
  if (loadErr || !existing) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }
  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (existing.deleted_at) {
    return NextResponse.json(
      { error: "Cannot edit a deleted comment" },
      { status: 400 }
    );
  }
  const ageMs = Date.now() - new Date(existing.created_at).getTime();
  if (ageMs > EDIT_WINDOW_MS) {
    return NextResponse.json(
      { error: "Edit window (5 minutes) has expired" },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from("paper_comments")
    .update({ content })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// Soft delete: set deleted_at = now().
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: existing, error: loadErr } = await supabase
    .from("paper_comments")
    .select("id, user_id, deleted_at")
    .eq("id", id)
    .single();
  if (loadErr || !existing) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }
  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (existing.deleted_at) {
    return NextResponse.json({ success: true });
  }

  const { error } = await supabase
    .from("paper_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
