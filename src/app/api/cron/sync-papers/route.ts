import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { syncAllJournals } from "@/lib/sync/orchestrator";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || cronSecret === "your_cron_secret") {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cronSyncDaysRaw = Number(process.env.CRON_SYNC_DAYS ?? "180");
    const cronSyncDays =
      Number.isFinite(cronSyncDaysRaw) && cronSyncDaysRaw >= 1
        ? Math.min(Math.floor(cronSyncDaysRaw), 180)
        : 180;

    const supabase = createServiceClient();
    const results = await syncAllJournals(supabase, { days: cronSyncDays });

    return NextResponse.json({
      success: true,
      days: cronSyncDays,
      results,
    });
  } catch (error) {
    console.error("Cron sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron sync failed" },
      { status: 500 }
    );
  }
}
