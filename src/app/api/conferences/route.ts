import { NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/server";
import { CONFERENCES } from "@/lib/constants/conferences";

// Force dynamic: this route reads from Supabase at runtime, so it must not
// be prerendered at build time (env vars may be absent in the build env).
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("conferences")
    .select("*")
    .order("start_date", { ascending: true });

  if (error || !data || data.length === 0) {
    // DB가 비어있거나 에러 시 static fallback
    return NextResponse.json(
      { source: "static", conferences: CONFERENCES },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" } }
    );
  }

  return NextResponse.json(
    { source: "db", conferences: data },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" } }
  );
}
