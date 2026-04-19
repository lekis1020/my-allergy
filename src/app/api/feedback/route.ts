import { NextResponse } from "next/server";
import { createServerAuthClient, createAnonClient } from "@/lib/supabase/server";
import { extractPaperFeatures, applyFeedbackToProfile, emptyProfile } from "@/lib/recommend/profile";
import { saveProfile } from "@/lib/recommend/affinity";

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

  // Update affinity profile (best-effort — don't fail the request)
  try {
    const anonClient = createAnonClient();
    const { data: paperData } = await anonClient
      .from("papers")
      .select(`
        pmid, title, abstract, keywords, mesh_terms, publication_types,
        journals!inner(slug),
        paper_authors(last_name, initials)
      `)
      .eq("pmid", pmid)
      .maybeSingle();

    if (paperData) {
      const features = extractPaperFeatures({
        ...paperData,
        paper_authors: paperData.paper_authors ?? [],
      });
      const target = feedback === "interested" ? 1 : -1;

      const { data: profileRow } = await supabase
        .from("user_affinity_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      const currentProfile = profileRow
        ? {
            topics: (profileRow.topics ?? {}) as Record<string, number>,
            authors: (profileRow.authors ?? {}) as Record<string, number>,
            keywords: (profileRow.keywords ?? {}) as Record<string, number>,
            mesh_terms: (profileRow.mesh_terms ?? {}) as Record<string, number>,
            journals: (profileRow.journals ?? {}) as Record<string, number>,
            article_types: (profileRow.article_types ?? {}) as Record<string, number>,
            feedback_count: profileRow.feedback_count ?? 0,
            updated_at: profileRow.updated_at ?? new Date().toISOString(),
          }
        : emptyProfile();

      const updatedProfile = applyFeedbackToProfile(currentProfile, features, target);
      await saveProfile(supabase, user.id, updatedProfile);
    }
  } catch (err) {
    console.warn("[Feedback] profile update failed (non-blocking):", err);
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
