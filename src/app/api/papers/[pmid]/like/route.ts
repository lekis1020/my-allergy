import { createServerAuthClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

async function getTotalLikes(pmid: string): Promise<number> {
  const supabase = createAnonClient();
  const { count } = await supabase
    .from("paper_likes")
    .select("*", { count: "exact", head: true })
    .eq("paper_pmid", pmid);
  return count ?? 0;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pmid: string }> }
) {
  const { pmid } = await params;
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const totalCount = await getTotalLikes(pmid);

  if (!user) {
    return NextResponse.json({ liked: false, count: totalCount });
  }

  const { data: existing } = await supabase
    .from("paper_likes")
    .select("id")
    .eq("user_id", user.id)
    .eq("paper_pmid", pmid)
    .maybeSingle();

  return NextResponse.json({ liked: !!existing, count: totalCount });
}

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

  const { data: existing } = await supabase
    .from("paper_likes")
    .select("id")
    .eq("user_id", user.id)
    .eq("paper_pmid", pmid)
    .maybeSingle();

  if (existing) {
    await supabase.from("paper_likes").delete().eq("id", existing.id);
  } else {
    await supabase.from("paper_likes").insert({
      user_id: user.id,
      paper_pmid: pmid,
    });
  }

  const totalCount = await getTotalLikes(pmid);
  return NextResponse.json({ liked: !existing, count: totalCount });
}
