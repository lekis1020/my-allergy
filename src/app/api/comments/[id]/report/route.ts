import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";

export async function POST(
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
  if (!user.email_confirmed_at) {
    return NextResponse.json(
      { error: "Email verification required" },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as { reason?: string };
  const reason =
    typeof body.reason === "string" && body.reason.trim().length > 0
      ? body.reason.trim().slice(0, 500)
      : null;

  const { data: target, error: loadErr } = await supabase
    .from("paper_comments")
    .select("id, user_id, deleted_at")
    .eq("id", id)
    .single();
  if (loadErr || !target) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }
  if (target.user_id === user.id) {
    return NextResponse.json(
      { error: "You cannot report your own comment" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("comment_reports")
    .insert({ comment_id: id, reporter_id: user.id, reason });

  if (error) {
    // Unique constraint violation => already reported.
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "You have already reported this comment" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
