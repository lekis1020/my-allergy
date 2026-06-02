import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/admin";
import { inngest } from "@/lib/inngest/client";

/**
 * Admin trigger for the citation backfill Inngest function.
 *
 * Sync only collects citations for newly inserted PMIDs, so previously
 * stored papers never get internal edges populated. This route lets the
 * operator dispatch a one-shot backfill over the last N days (default 90).
 *
 * Body: { days?: number }
 */
export async function POST(request: NextRequest) {
  const authClient = await createServerAuthClient();
  const {
    data: { session },
  } = await authClient.auth.getSession();
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { days?: unknown };
  const days =
    typeof body.days === "number" && body.days > 0 ? Math.floor(body.days) : undefined;

  await inngest.send({
    name: "admin/citations.backfill",
    data: days !== undefined ? { days } : {},
  });

  return NextResponse.json(
    { ok: true, dispatched: true, days: days ?? "default(90)" },
    { status: 202 }
  );
}
