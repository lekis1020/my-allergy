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

  const { data, error } = await supabase
    .from("bookmarks")
    .select("pmid, papers!inner(title)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const papers = (data ?? []).map((b) => ({
    pmid: b.pmid,
    title: String((b.papers as unknown as { title: string }).title ?? ""),
  }));

  return NextResponse.json({ papers });
}
