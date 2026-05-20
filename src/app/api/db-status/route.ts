import { NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createAnonClient();

  const [papersResult, abstractResult, syncResult, newestResult] =
    await Promise.all([
      supabase
        .from("papers")
        .select("id", { count: "exact" })
        .limit(0),
      supabase
        .from("papers")
        .select("id", { count: "exact" })
        .not("abstract", "is", null)
        .neq("abstract", "")
        .limit(0),
      supabase
        .from("sync_logs")
        .select("completed_at")
        .eq("status", "success")
        .order("completed_at", { ascending: false })
        .limit(1),
      supabase
        .from("papers")
        .select("publication_date")
        .order("publication_date", { ascending: false })
        .limit(1),
    ]);

  if (papersResult.error) console.error("[db-status] papers count error:", papersResult.error);
  if (abstractResult.error) console.error("[db-status] abstract count error:", abstractResult.error);

  // If the core count query failed (or returned null), do NOT serve a falsy
  // payload with a long-lived CDN cache — a `{ totalPapers: 0 }` response with
  // `s-maxage=300` would freeze "0" in front of users for up to 15 minutes
  // (including stale-while-revalidate). Surface a non-cacheable 503 instead so
  // SWR throws and keeps the previous value.
  if (papersResult.error || papersResult.count === null) {
    return NextResponse.json(
      { error: "db-status query failed" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const totalPapers = papersResult.count;
  const papersWithAbstract = abstractResult.count ?? 0;
  const lastSyncAt = syncResult.data?.[0]?.completed_at ?? null;
  const newestPaper = newestResult.data?.[0]?.publication_date ?? null;

  const response = NextResponse.json({
    totalPapers,
    papersWithAbstract,
    lastSyncAt,
    newestPaper,
  });

  response.headers.set(
    "Cache-Control",
    "public, s-maxage=300, stale-while-revalidate=600",
  );

  return response;
}
