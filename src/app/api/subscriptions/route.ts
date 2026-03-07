import { NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";

// GET /api/subscriptions — list user's journal subscriptions
export async function GET() {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("email_subscriptions")
    .select("id, journal_slug, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ subscriptions: data });
}

// POST /api/subscriptions — add a journal subscription { journalSlug: string }
export async function POST(request: Request) {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const journalSlug = body.journalSlug as string | undefined;

  if (!journalSlug) {
    return NextResponse.json(
      { error: "journalSlug is required" },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("email_subscriptions")
    .upsert(
      { user_id: user.id, journal_slug: journalSlug },
      { onConflict: "user_id,journal_slug" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

// DELETE /api/subscriptions — remove a journal subscription { journalSlug: string }
export async function DELETE(request: Request) {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const journalSlug = body.journalSlug as string | undefined;

  if (!journalSlug) {
    return NextResponse.json(
      { error: "journalSlug is required" },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("email_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("journal_slug", journalSlug);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
