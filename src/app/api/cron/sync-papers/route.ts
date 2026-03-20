import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { inngest } from "@/lib/inngest/client";
import { getMissingSyncEnvVars, parseSyncDays } from "@/lib/sync/config";

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

export async function GET(request: NextRequest) {
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

  try {
    const cronSyncDays = parseSyncDays(process.env.CRON_SYNC_DAYS, { max: 180 });

    await inngest.send({ name: "sync/all.requested", data: { days: cronSyncDays } });

    return NextResponse.json({
      success: true,
      message: "Cron sync dispatched to Inngest queue",
      days: cronSyncDays,
    });
  } catch (error) {
    console.error("Cron sync dispatch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to dispatch cron sync" },
      { status: 500 }
    );
  }
}
