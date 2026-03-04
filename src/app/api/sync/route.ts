import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { syncAllJournals } from "@/lib/sync/orchestrator";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || cronSecret === "your_cron_secret") {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const fullSync = (body as Record<string, unknown>).fullSync === true;
    const days = typeof (body as Record<string, unknown>).days === "number"
      ? (body as Record<string, number>).days
      : 180;

    const supabase = createServiceClient();
    const results = await syncAllJournals(supabase, { days, fullSync });

    const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
    const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);

    return NextResponse.json({
      success: true,
      summary: {
        journals: results.length,
        totalInserted,
        totalUpdated,
      },
      details: results,
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
