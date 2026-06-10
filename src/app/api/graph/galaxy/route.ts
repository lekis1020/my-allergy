// src/app/api/graph/galaxy/route.ts
import { NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/server";
import type { GalaxySnapshot } from "@/lib/graph/types";

const STALE_AFTER_HOURS = 24;

export async function GET() {
  const sb = createAnonClient();
  const { data, error } = await sb
    .from("paper_graph_snapshots")
    .select("payload, computed_at")
    .eq("scope", "galaxy")
    .maybeSingle();

  if (error) {
    console.error("[graph/galaxy] read error:", error);
    return NextResponse.json<GalaxySnapshot>({ nodes: [], edges: [] }, { status: 500 });
  }

  if (!data) {
    // Snapshot has never been computed. Return empty body so the UI shows
    // the empty state rather than an error.
    const res = NextResponse.json<GalaxySnapshot>({ nodes: [], edges: [] });
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    return res;
  }

  const computedAt = new Date(data.computed_at);
  const ageMs = Date.now() - computedAt.getTime();
  const stale = ageMs > STALE_AFTER_HOURS * 60 * 60 * 1000;

  const res = NextResponse.json({
    ...(data.payload as unknown as GalaxySnapshot),
    stale,
    computed_at: computedAt.toISOString(),
  });
  res.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  res.headers.set("X-Graph-Computed-At", computedAt.toISOString());
  return res;
}
