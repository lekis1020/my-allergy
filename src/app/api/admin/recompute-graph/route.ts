import { NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/admin";
import { inngest } from "@/lib/inngest/client";

/**
 * Manual trigger for the relationship-graph recompute Inngest function.
 *
 * Used:
 *  - After adding a new topic to `topics.ts` so the galaxy reflects it
 *    without waiting for the next scheduled run.
 *  - For incident recovery if the cron is paused or fails.
 */
export async function POST() {
  const authClient = await createServerAuthClient();
  const { data: { session } } = await authClient.auth.getSession();
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await inngest.send({ name: "admin/graph.recompute", data: {} });

  return NextResponse.json({ ok: true, dispatched: true }, { status: 202 });
}
