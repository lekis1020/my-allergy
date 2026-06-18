import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { inngest } from "@/lib/inngest/client";

/**
 * Manual trigger for the one-time `papers.topic_tags` backfill (migration
 * 00045). Run once after deploying the migration to classify the historical
 * corpus; new papers are classified at sync time. The backfill dispatches a
 * graph recompute on completion.
 */
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await inngest.send({ name: "admin/topics.backfill", data: {} });

  return NextResponse.json({ ok: true, dispatched: true }, { status: 202 });
}
