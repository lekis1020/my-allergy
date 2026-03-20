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

  try {
    const body = await request.json().catch(() => ({}));
    const fullSync = (body as Record<string, unknown>).fullSync === true;
    const rawDays = (body as Record<string, unknown>).days;
    const days = parseSyncDays(
      typeof rawDays === "number" || typeof rawDays === "string" ? rawDays : undefined,
      { max: 365 },
    );

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
