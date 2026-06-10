import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

interface ProposalRow {
  id: string;
  conference_id: string;
  proposed_start_date: string | null;
  proposed_end_date: string | null;
  status: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  const action = body.action;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: proposal, error: fetchError } = await service.from("conference_proposals")
    .select("id, conference_id, proposed_start_date, proposed_end_date, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  const row = proposal as ProposalRow;
  if (row.status !== "pending") {
    return NextResponse.json({ error: `Already ${row.status}` }, { status: 409 });
  }

  if (action === "approve") {
    if (!row.proposed_start_date || !row.proposed_end_date) {
      return NextResponse.json({ error: "Proposal missing dates" }, { status: 400 });
    }
    const { error: updateError } = await service.from("conferences")
      .update({
        start_date: row.proposed_start_date,
        end_date: row.proposed_end_date,
        date_confirmed: true,
      })
      .eq("id", row.conference_id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { error: markError } = await service.from("conference_proposals")
    .update({
      status: action === "approve" ? "approved" : "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", id);
  if (markError) return NextResponse.json({ error: markError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
