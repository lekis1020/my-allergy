import { NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createAnonClient();

  const [papersResult, abstractResult, syncResult, newestResult] =
    await Promise.all([
      supabase
        .from("papers")
        .select("*", { count: "exact", head: true }),
      supabase
        .from("papers")
        .select("*", { count: "exact", head: true })
        .not("abstract", "is", null)
        .neq("abstract", ""),
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

  const totalPapers = papersResult.count ?? 0;
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
