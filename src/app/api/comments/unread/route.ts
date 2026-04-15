import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";

// GET /api/comments/unread?since=<ISO>
// Returns the number of replies to the current user's comments posted after `since`.
export async function GET(request: NextRequest) {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ count: 0, unauthenticated: true });
  }

  const since = request.nextUrl.searchParams.get("since");
  const sinceIso = since && !Number.isNaN(Date.parse(since)) ? since : null;

  // 1. Find IDs of my non-deleted comments.
  const { data: mine, error: mineErr } = await supabase
    .from("paper_comments")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null);

  if (mineErr) {
    return NextResponse.json({ error: mineErr.message }, { status: 500 });
  }

  const myIds = (mine ?? []).map((r) => r.id);
  if (myIds.length === 0) {
    return NextResponse.json({ count: 0 });
  }

  // 2. Count replies (parent_id IN myIds) from other users after `since`.
  let query = supabase
    .from("paper_comments")
    .select("id", { count: "exact", head: true })
    .in("parent_id", myIds)
    .neq("user_id", user.id)
    .is("deleted_at", null);

  if (sinceIso) {
    query = query.gt("created_at", sinceIso);
  }

  const { count, error: countErr } = await query;
  if (countErr) {
    return NextResponse.json({ error: countErr.message }, { status: 500 });
  }

  return NextResponse.json({ count: count ?? 0 });
}
