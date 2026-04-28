import { createServerAuthClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
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

  // Check if already liked
  const { data: existing } = await supabase
    .from("paper_likes")
    .select("id")
    .eq("user_id", user.id)
    .eq("paper_pmid", pmid)
    .maybeSingle();

  if (existing) {
    await supabase.from("paper_likes").delete().eq("id", existing.id);
    return NextResponse.json({ liked: false });
  }

  await supabase.from("paper_likes").insert({
    user_id: user.id,
    paper_pmid: pmid,
  });

  return NextResponse.json({ liked: true });
}
