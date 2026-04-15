import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { inngest } from "@/lib/inngest/client";
import { getMissingSyncEnvVars } from "@/lib/sync/config";
import { format, subDays } from "date-fns";

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export const dynamic = "force-dynamic";

/**
 * One-shot backfill to extend storage window from 6 → 12 months.
 * Defaults: mindate = today - 365d, maxdate = today - 180d.
 * Body: { mindate?: "YYYY/MM/DD", maxdate?: "YYYY/MM/DD" }
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const missingEnvVars = getMissingSyncEnvVars(process.env);

  if (missingEnvVars.length > 0) {
    return NextResponse.json(
      { error: `Missing sync configuration: ${missingEnvVars.join(", ")}` },
      { status: 500 },
    );
  }

  if (!safeCompare(authHeader ?? "", `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const today = new Date();
  const defaultMin = format(subDays(today, 365), "yyyy/MM/dd");
  const defaultMax = format(subDays(today, 180), "yyyy/MM/dd");

  const mindate = typeof body.mindate === "string" && body.mindate ? body.mindate : defaultMin;
  const maxdate = typeof body.maxdate === "string" && body.maxdate ? body.maxdate : defaultMax;

  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(mindate) || !/^\d{4}\/\d{2}\/\d{2}$/.test(maxdate)) {
    return NextResponse.json(
      { error: "mindate/maxdate must be YYYY/MM/DD" },
      { status: 400 },
    );
  }

  try {
    await inngest.send({
      name: "sync/backfill-all.requested",
      data: { mindate, maxdate },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Backfill dispatched to Inngest queue",
        mindate,
        maxdate,
      },
      { status: 202 },
    );
  } catch (error) {
    console.error("Backfill dispatch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to dispatch backfill" },
      { status: 500 },
    );
  }
}
