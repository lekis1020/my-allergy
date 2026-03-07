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

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || cronSecret === "your_cron_secret") {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  if (!safeCompare(authHeader ?? "", `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const fullSync = (body as Record<string, unknown>).fullSync === true;
    const rawDays = typeof (body as Record<string, unknown>).days === "number"
      ? (body as Record<string, number>).days
      : 180;
    const days = Number.isFinite(rawDays) && rawDays >= 1
      ? Math.min(Math.floor(rawDays), 365)
      : 180;

    await inngest.send({ name: "sync/all.requested", data: { fullSync, days } });

    return NextResponse.json(
      {
        success: true,
        message: "Sync dispatched to Inngest queue",
        fullSync,
        days,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("Sync dispatch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to dispatch sync" },
      { status: 500 }
    );
  }
}
