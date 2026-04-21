import { NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Clean up sessions older than 2 months (fire-and-forget)
  const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  supabase
    .from("chat_sessions")
    .delete()
    .eq("user_id", user.id)
    .lt("updated_at", twoMonthsAgo)
    .then(() => {});

  const { data, error } = await supabase
    .from("chat_sessions")
    .select("paper_pmid, messages, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sessions = (data ?? []).map((s) => ({
    paper_pmid: s.paper_pmid,
    message_count: Array.isArray(s.messages) ? (s.messages as unknown[]).length : 0,
    updated_at: s.updated_at,
  }));

  return NextResponse.json({ sessions });
}
