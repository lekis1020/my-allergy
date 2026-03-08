import { NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";

// GET /api/bookmarks — list user's bookmarked PMIDs
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
    .select("pmid")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ pmids: data.map((b) => b.pmid) });
}

// POST /api/bookmarks — add a bookmark { pmid: string }
export async function POST(request: Request) {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const pmid = body.pmid as string | undefined;
  const aiSummary = body.ai_summary as string | null | undefined;

  if (!pmid) {
    return NextResponse.json({ error: "pmid is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("bookmarks")
    .upsert(
      { user_id: user.id, pmid, ai_summary: aiSummary ?? null },
      { onConflict: "user_id,pmid" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

// DELETE /api/bookmarks — remove a bookmark { pmid: string }
export async function DELETE(request: Request) {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const pmid = body.pmid as string | undefined;

  if (!pmid) {
    return NextResponse.json({ error: "pmid is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .eq("user_id", user.id)
    .eq("pmid", pmid);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
