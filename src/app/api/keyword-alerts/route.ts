import { NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";

// GET /api/keyword-alerts — list user's keyword alerts
export async function GET() {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("keyword_alerts")
    .select("id, keyword, active, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ alerts: data });
}

// POST /api/keyword-alerts — add a keyword alert { keyword: string }
export async function POST(request: Request) {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const keyword = (body.keyword as string | undefined)?.trim();

  if (!keyword) {
    return NextResponse.json(
      { error: "keyword is required" },
      { status: 400 },
    );
  }

  if (keyword.length > 200) {
    return NextResponse.json(
      { error: "keyword must be 200 characters or less" },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("keyword_alerts")
    .upsert(
      { user_id: user.id, keyword, active: true },
      { onConflict: "user_id,keyword" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

// DELETE /api/keyword-alerts — remove a keyword alert { keyword: string }
export async function DELETE(request: Request) {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const keyword = body.keyword as string | undefined;

  if (!keyword) {
    return NextResponse.json(
      { error: "keyword is required" },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("keyword_alerts")
    .delete()
    .eq("user_id", user.id)
    .eq("keyword", keyword);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// PATCH /api/keyword-alerts — toggle active state { keyword: string, active: boolean }
export async function PATCH(request: Request) {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const keyword = body.keyword as string | undefined;
  const active = body.active as boolean | undefined;

  if (!keyword || active === undefined) {
    return NextResponse.json(
      { error: "keyword and active are required" },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("keyword_alerts")
    .update({ active })
    .eq("user_id", user.id)
    .eq("keyword", keyword);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
