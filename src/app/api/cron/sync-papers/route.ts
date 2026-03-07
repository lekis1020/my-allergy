import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { inngest } from "@/lib/inngest/client";

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

  if (!cronSecret || cronSecret === "your_cron_secret") {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  if (!safeCompare(authHeader ?? "", `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cronSyncDaysRaw = Number(process.env.CRON_SYNC_DAYS ?? "180");
    const cronSyncDays =
      Number.isFinite(cronSyncDaysRaw) && cronSyncDaysRaw >= 1
        ? Math.min(Math.floor(cronSyncDaysRaw), 180)
        : 180;

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
