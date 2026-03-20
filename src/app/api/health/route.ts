import { NextRequest, NextResponse } from "next/server";
import { SUCCESSFUL_SYNC_STATUSES, isSyncHealthOk } from "@/lib/sync/status";
import { createAnonClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/utils/rate-limit";

const limiter = rateLimit({ windowMs: 60_000, maxRequests: 30 });

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const { success } = limiter.check(ip);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const supabase = createAnonClient();

  // Database: connectivity + latency
  const dbStart = Date.now();
  let databaseCheck: { status: "ok" | "error"; latencyMs: number; error?: string };
  try {
    const { error } = await supabase
      .from("papers")
      .select("id", { count: "exact", head: true });
    const latencyMs = Date.now() - dbStart;
    databaseCheck = error
      ? { status: "error", latencyMs, error: error.message }
      : { status: "ok", latencyMs };
  } catch (err) {
    databaseCheck = {
      status: "error",
      latencyMs: Date.now() - dbStart,
      error: err instanceof Error ? err.message : "unknown",
    };
  }

  // Paper count
  let paperCount: number | null = null;
  try {
    const { count, error } = await supabase
      .from("papers")
      .select("*", { count: "exact", head: true });
    if (!error) paperCount = count ?? 0;
  } catch {
    // paperCount stays null
  }

  // Last sync: most recent successful sync_logs entry (supports legacy "completed")
  let lastSyncCheck: { status: "ok" | "stale" | "error"; lastSyncAt: string | null; minutesAgo: number | null };
  try {
    const { data, error } = await supabase
      .from("sync_logs")
      .select("completed_at")
      .in("status", [...SUCCESSFUL_SYNC_STATUSES])
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      lastSyncCheck = { status: "error", lastSyncAt: null, minutesAgo: null };
    } else if (!data?.completed_at) {
      lastSyncCheck = { status: "stale", lastSyncAt: null, minutesAgo: null };
    } else {
      const ageMs = Date.now() - new Date(data.completed_at).getTime();
      const minutesAgo = Math.round(ageMs / 60_000);
      lastSyncCheck = {
        status: ageMs > 24 * 60 * 60 * 1000 ? "stale" : "ok",
        lastSyncAt: data.completed_at,
        minutesAgo,
      };
    }
  } catch {
    lastSyncCheck = { status: "error", lastSyncAt: null, minutesAgo: null };
  }

  const allOk = isSyncHealthOk(databaseCheck.status, lastSyncCheck.status);

  const response = NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      checks: {
        database: databaseCheck,
        lastSync: lastSyncCheck,
        paperCount,
      },
    },
    { status: allOk ? 200 : 503 }
  );

  response.headers.set("Cache-Control", "no-cache, no-store");

  return response;
}
