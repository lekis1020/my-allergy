import { NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";

// POST /api/recommendations/reset — wipe all paper_feedback for the caller.
export async function POST() {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error, count } = await supabase
    .from("paper_feedback")
    .delete({ count: "exact" })
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, removed: count ?? 0 });
}
