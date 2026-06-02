// src/app/api/graph/galaxy/route.ts
import { NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/server";
import type { GalaxySnapshot } from "@/lib/graph/types";

const STALE_AFTER_HOURS = 24;

export async function GET() {
  // paper_graph_snapshots is not yet in the generated Supabase types.
  // Cast to an untyped client to access the table directly.
  const sb = createAnonClient() as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{
            data: { payload: unknown; computed_at: unknown } | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
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

  const computedAt = new Date(data.computed_at as string);
  const ageMs = Date.now() - computedAt.getTime();
  const stale = ageMs > STALE_AFTER_HOURS * 60 * 60 * 1000;

  const res = NextResponse.json({
    ...(data.payload as GalaxySnapshot),
    stale,
  });
  res.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  res.headers.set("X-Graph-Computed-At", computedAt.toISOString());
  return res;
}
