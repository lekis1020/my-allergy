import { NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/server";

export async function GET() {
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

  // Last sync: most recent completed sync_logs entry
  let lastSyncCheck: { status: "ok" | "stale" | "error"; lastSyncAt: string | null; minutesAgo: number | null };
  try {
    const { data, error } = await supabase
      .from("sync_logs")
      .select("completed_at")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      lastSyncCheck = { status: "error", lastSyncAt: null, minutesAgo: null };
    } else if (!data) {
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
  } catch (err) {
    lastSyncCheck = { status: "error", lastSyncAt: null, minutesAgo: null };
  }

  const allOk = databaseCheck.status === "ok" && lastSyncCheck.status !== "error";

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
