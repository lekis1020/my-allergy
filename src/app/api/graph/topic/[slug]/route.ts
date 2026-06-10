// src/app/api/graph/topic/[slug]/route.ts
import { NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/server";
import type { TopicSnapshot } from "@/lib/graph/types";

const STALE_AFTER_HOURS = 24;

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_req: Request, ctx: RouteContext) {
  const { slug } = await ctx.params;
  const sb = createAnonClient();
  const { data, error } = await sb
    .from("paper_graph_snapshots")
    .select("payload, computed_at")
    .eq("scope", `topic:${slug}`)
    .maybeSingle();

  if (error) {
    console.error(`[graph/topic/${slug}] read error:`, error);
    return NextResponse.json({ error: "snapshot read failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const computedAt = new Date(data.computed_at);
  const ageMs = Date.now() - computedAt.getTime();
  const stale = ageMs > STALE_AFTER_HOURS * 60 * 60 * 1000;

  const res = NextResponse.json({
    ...(data.payload as unknown as TopicSnapshot),
    stale,
    computed_at: computedAt.toISOString(),
  });
  res.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  res.headers.set("X-Graph-Computed-At", computedAt.toISOString());
  return res;
}
