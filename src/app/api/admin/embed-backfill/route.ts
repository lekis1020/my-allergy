import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { inngest } from "@/lib/inngest/client";

/**
 * Admin trigger for the paper-embedding backfill Inngest function.
 *
 * Body: { limit?: number }
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { limit?: unknown };
  const limit =
    typeof body.limit === "number" && body.limit > 0 ? Math.floor(body.limit) : undefined;

  await inngest.send({
    name: "admin/embed.backfill",
    data: limit !== undefined ? { limit } : {},
  });

  return NextResponse.json(
    { ok: true, dispatched: true, limit: limit ?? "all" },
    { status: 202 }
  );
}
