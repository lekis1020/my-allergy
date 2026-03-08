import { NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/server";
import { CONFERENCES } from "@/lib/constants/conferences";

export const revalidate = 3600; // 1시간 캐시

export async function GET() {
  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("conferences")
    .select("*")
    .order("start_date", { ascending: true });

  if (error || !data || data.length === 0) {
    // DB가 비어있거나 에러 시 static fallback
    return NextResponse.json({ source: "static", conferences: CONFERENCES });
  }

  return NextResponse.json({ source: "db", conferences: data });
}
