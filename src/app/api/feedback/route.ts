import { NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";

const ALLOWED = ["interested", "not_interested"] as const;
type FeedbackKind = (typeof ALLOWED)[number];

function isFeedbackKind(v: unknown): v is FeedbackKind {
  return typeof v === "string" && (ALLOWED as readonly string[]).includes(v);
}

// GET /api/feedback — return caller's feedback map
export async function GET() {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("paper_feedback")
    .select("paper_pmid, feedback")
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ feedback: data });
}

// POST /api/feedback — upsert { pmid, feedback }
export async function POST(request: Request) {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const pmid = (body as { pmid?: unknown })?.pmid;
  const feedback = (body as { feedback?: unknown })?.feedback;

  if (typeof pmid !== "string" || !pmid) {
    return NextResponse.json({ error: "pmid is required" }, { status: 400 });
  }
  if (!isFeedbackKind(feedback)) {
    return NextResponse.json(
      { error: "feedback must be 'interested' or 'not_interested'" },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("paper_feedback").upsert(
    {
      user_id: user.id,
      paper_pmid: pmid,
      feedback,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,paper_pmid" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

// DELETE /api/feedback — remove { pmid }
export async function DELETE(request: Request) {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const pmid = (body as { pmid?: unknown })?.pmid;
  if (typeof pmid !== "string" || !pmid) {
    return NextResponse.json({ error: "pmid is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("paper_feedback")
    .delete()
    .eq("user_id", user.id)
    .eq("paper_pmid", pmid);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
