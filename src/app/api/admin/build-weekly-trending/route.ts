import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { inngest } from "@/lib/inngest/client";

/**
 * Manual trigger for the weekly trending snapshot (migration 00048). Runs the
 * same Inngest function as the Monday 03:00 UTC cron. Use once after
 * deploying to populate the very first week without waiting for the cron.
 */
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await inngest.send({ name: "app/weekly-trending.recompute", data: {} });

  return NextResponse.json({ ok: true, dispatched: true }, { status: 202 });
}
