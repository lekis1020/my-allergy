# Home Relationship Graph & Layout Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a focal-free relationship graph to the home page that shows citation/mention links among trending papers (Timeline tab) or the logged-in user's interacted papers (For you tab), and move search + journal filtering into a new left sidebar.

**Architecture:** Two new GET route handlers return the same `{ nodes, edges }` shape, both built by a shared induced-subgraph helper. A new focal-free d3-force component renders the graph; a panel component owns data fetching and loading/empty/error states. The home page is restructured into a left sidebar (search + Topics/Journals tabs), a center column (Timeline/For you tabs → graph → feed), and the unchanged right rail.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (anon + auth clients), SWR, d3-force, Tailwind v4, Vitest.

---

## File Structure

**New files**

- `src/lib/graph/types.ts` — shared `GraphNode` / `GraphEdge` TypeScript types for the relationship graph API shape.
- `src/lib/graph/induced-subgraph.ts` — pure helper: given a pmid set + citation/mention rows, returns the induced sub-graph edges and the set of connected pmids.
- `src/lib/graph/__tests__/induced-subgraph.test.ts` — Vitest unit tests for the helper.
- `src/app/api/connections/trending/route.ts` — `GET`, no auth, CDN-cached, trending-papers graph.
- `src/app/api/me/connections/route.ts` — `GET`, auth required, per-user graph.
- `src/components/graph/relationship-graph.tsx` — focal-free d3-force graph component.
- `src/components/papers/relationship-graph-panel.tsx` — data fetching + loading/empty/error states; chooses endpoint by tab.
- `src/components/layout/journal-filter-panel.tsx` — vertical multi-select list of the journals.
- `src/components/layout/home-sidebar.tsx` — left sidebar: search box + Topics/Journals tabbed panel.

**Modified files**

- `src/components/papers/home-page.tsx` — layout restructure: sidebar, tabs to top of center column, graph panel, search/journals removed from center header.

**Responsibilities:** `induced-subgraph.ts` is the single edge-aggregation implementation used by both routes and the unit test. `relationship-graph.tsx` is pure rendering; `relationship-graph-panel.tsx` is pure data/state. `home-sidebar.tsx` composes search + `TopicMonitorPanel` + `JournalFilterPanel`.

---

## Reference: existing facts the implementer needs

- Table columns (confirmed in `supabase/migrations`):
  - `paper_citations`: `source_pmid`, `target_pmid`.
  - `paper_mentions`: `source_pmid`, `mentioned_pmid`, `comment_id`.
  - `bookmarks`: `user_id`, `pmid`, `created_at`.
  - `paper_comments`: `user_id`, `paper_pmid`, `created_at`.
  - `paper_likes`: `user_id`, `paper_pmid`, `created_at`.
- Supabase clients (`src/lib/supabase/server.ts`): `createAnonClient()` (RLS reads), `createServiceClient()` (bypasses RLS), `createServerAuthClient()` (cookie/session-aware; `await`ed).
- Trending selection basis (`src/app/api/trending/route.ts`): papers with non-empty abstract, `epub_date` within the last 180 days, `citation_count > 0`, ordered by `citation_count` desc then `epub_date` desc.
- `paper_mentions` is read with `createServiceClient()` in the existing connections route to bypass RLS on the comments join. For the relationship graph we only need the `paper_mentions` rows themselves (no comment content), so the anon client is sufficient if RLS allows; if a query returns empty unexpectedly, switch that one query to `createServiceClient()`.
- d3 is already a dependency (`src/components/graph/paper-connection-graph.tsx` imports `* as d3`).
- Journal colors/abbreviations: `JOURNALS` in `src/lib/constants/journals.ts` (`slug`, `abbreviation`, `color`, `impactFactor`).
- Vitest: `npm run test` runs `vitest run`; config has `globals: true` and `@` → `src` alias.

---

## Task 1: Shared graph types

**Files:**
- Create: `src/lib/graph/types.ts`

- [ ] **Step 1: Create the types module**

```ts
// Shared TypeScript types for the home relationship graph API shape.
// The detail-page connection graph keeps its own richer types (direction,
// mentions); these are intentionally the minimal focal-free shape.

export interface GraphNode {
  pmid: string;
  title: string;
  journal_abbreviation: string;
  journal_color: string;
  publication_date: string;
}

export type GraphEdgeType = "citation" | "mention" | "both";

export interface GraphEdge {
  source: string; // pmid
  target: string; // pmid
  type: GraphEdgeType;
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors referencing `src/lib/graph/types.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/graph/types.ts
git commit -m "feat: shared graph types for home relationship graph"
```

---

## Task 2: Induced-subgraph helper (TDD)

**Files:**
- Create: `src/lib/graph/induced-subgraph.ts`
- Test: `src/lib/graph/__tests__/induced-subgraph.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildInducedSubgraph } from "../induced-subgraph";

describe("buildInducedSubgraph", () => {
  it("keeps only edges with both endpoints in the pmid set", () => {
    const pmids = new Set(["1", "2", "3"]);
    const { edges } = buildInducedSubgraph(
      pmids,
      [
        { source_pmid: "1", target_pmid: "2" }, // both in set
        { source_pmid: "1", target_pmid: "99" }, // 99 not in set
      ],
      []
    );
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ type: "citation" });
  });

  it("labels an edge 'mention' when only a mention row connects the pair", () => {
    const { edges } = buildInducedSubgraph(
      new Set(["1", "2"]),
      [],
      [{ source_pmid: "1", mentioned_pmid: "2" }]
    );
    expect(edges).toEqual([{ source: "1", target: "2", type: "mention" }]);
  });

  it("labels an edge 'both' when citation and mention connect the same pair", () => {
    const { edges } = buildInducedSubgraph(
      new Set(["1", "2"]),
      [{ source_pmid: "1", target_pmid: "2" }],
      [{ source_pmid: "2", mentioned_pmid: "1" }] // reverse direction, same pair
    );
    expect(edges).toHaveLength(1);
    expect(edges[0].type).toBe("both");
  });

  it("collapses reciprocal citations into a single edge", () => {
    const { edges } = buildInducedSubgraph(
      new Set(["1", "2"]),
      [
        { source_pmid: "1", target_pmid: "2" },
        { source_pmid: "2", target_pmid: "1" },
      ],
      []
    );
    expect(edges).toHaveLength(1);
  });

  it("ignores self-loops", () => {
    const { edges } = buildInducedSubgraph(
      new Set(["1"]),
      [{ source_pmid: "1", target_pmid: "1" }],
      []
    );
    expect(edges).toHaveLength(0);
  });

  it("returns connectedPmids covering exactly the pmids that have an edge", () => {
    const { connectedPmids } = buildInducedSubgraph(
      new Set(["1", "2", "3"]), // 3 has no edge → dropped
      [{ source_pmid: "1", target_pmid: "2" }],
      []
    );
    expect([...connectedPmids].sort()).toEqual(["1", "2"]);
  });

  it("returns no edges and no connected pmids for an empty set", () => {
    const result = buildInducedSubgraph(new Set(), [], []);
    expect(result.edges).toEqual([]);
    expect(result.connectedPmids).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/graph/__tests__/induced-subgraph.test.ts`
Expected: FAIL — `buildInducedSubgraph` is not defined / module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { GraphEdge } from "./types";

export interface CitationRow {
  source_pmid: string;
  target_pmid: string;
}

export interface MentionRow {
  source_pmid: string;
  mentioned_pmid: string;
}

/**
 * Builds the induced sub-graph for a set of pmids: only citation/mention
 * relationships where BOTH endpoints are in `pmids` become edges. Edges are
 * undirected and deduplicated per pair; `type` is "both" when a pair has both
 * a citation and a mention. pmids with no edge are dropped from connectedPmids.
 */
export function buildInducedSubgraph(
  pmids: Set<string>,
  citations: CitationRow[],
  mentions: MentionRow[]
): { edges: GraphEdge[]; connectedPmids: string[] } {
  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  const hasCitation = new Set<string>();
  const hasMention = new Set<string>();

  for (const { source_pmid, target_pmid } of citations) {
    if (source_pmid === target_pmid) continue;
    if (pmids.has(source_pmid) && pmids.has(target_pmid)) {
      hasCitation.add(pairKey(source_pmid, target_pmid));
    }
  }

  for (const { source_pmid, mentioned_pmid } of mentions) {
    if (source_pmid === mentioned_pmid) continue;
    if (pmids.has(source_pmid) && pmids.has(mentioned_pmid)) {
      hasMention.add(pairKey(source_pmid, mentioned_pmid));
    }
  }

  const edges: GraphEdge[] = [];
  const connected = new Set<string>();

  for (const key of new Set([...hasCitation, ...hasMention])) {
    const [source, target] = key.split("|");
    const c = hasCitation.has(key);
    const m = hasMention.has(key);
    edges.push({ source, target, type: c && m ? "both" : c ? "citation" : "mention" });
    connected.add(source);
    connected.add(target);
  }

  return { edges, connectedPmids: [...connected] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/graph/__tests__/induced-subgraph.test.ts`
Expected: PASS — all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/graph/induced-subgraph.ts src/lib/graph/__tests__/induced-subgraph.test.ts
git commit -m "feat: induced-subgraph helper for relationship graph"
```

---

## Task 3: Trending connections route

**Files:**
- Create: `src/app/api/connections/trending/route.ts`

- [ ] **Step 1: Write the route handler**

```ts
import { NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/server";
import { buildInducedSubgraph } from "@/lib/graph/induced-subgraph";
import type { GraphNode, GraphResponse } from "@/lib/graph/types";

const NODE_CAP = 60;
const TRENDING_WINDOW_DAYS = 180;

export async function GET() {
  const supabase = createAnonClient();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - TRENDING_WINDOW_DAYS);
  const fromDate = cutoff.toISOString().split("T")[0];

  // 1. Top trending pmids — same selection basis as the trending feed.
  const { data: trending, error: trendingError } = await supabase
    .from("papers")
    .select("pmid, title, publication_date, journals!inner(abbreviation, color)")
    .not("abstract", "is", null)
    .neq("abstract", "")
    .gte("epub_date", fromDate)
    .gt("citation_count", 0)
    .order("citation_count", { ascending: false, nullsFirst: false })
    .order("epub_date", { ascending: false })
    .limit(NODE_CAP);

  if (trendingError) {
    console.error("trending connections query error:", trendingError);
    return NextResponse.json<GraphResponse>({ nodes: [], edges: [] }, { status: 500 });
  }

  const paperMap = new Map<string, GraphNode>();
  for (const row of trending ?? []) {
    const journal = row.journals as unknown as { abbreviation: string; color: string };
    paperMap.set(String(row.pmid), {
      pmid: String(row.pmid),
      title: String(row.title),
      journal_abbreviation: String(journal.abbreviation),
      journal_color: String(journal.color),
      publication_date: String(row.publication_date),
    });
  }

  const pmidSet = new Set(paperMap.keys());

  if (pmidSet.size === 0) {
    return jsonWithCache({ nodes: [], edges: [] });
  }

  // 2. Citation + mention rows where both endpoints are trending pmids.
  const pmidList = [...pmidSet];
  const [{ data: citations }, { data: mentions }] = await Promise.all([
    supabase
      .from("paper_citations")
      .select("source_pmid, target_pmid")
      .in("source_pmid", pmidList)
      .in("target_pmid", pmidList),
    supabase
      .from("paper_mentions")
      .select("source_pmid, mentioned_pmid")
      .in("source_pmid", pmidList)
      .in("mentioned_pmid", pmidList),
  ]);

  // 3. Induced sub-graph; drop edgeless nodes.
  const { edges, connectedPmids } = buildInducedSubgraph(
    pmidSet,
    citations ?? [],
    mentions ?? []
  );
  const nodes = connectedPmids.map((p) => paperMap.get(p)!).filter(Boolean);

  return jsonWithCache({ nodes, edges });
}

function jsonWithCache(body: GraphResponse) {
  const response = NextResponse.json(body);
  response.headers.set(
    "Cache-Control",
    "public, s-maxage=300, stale-while-revalidate=600"
  );
  return response;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors in `src/app/api/connections/trending/route.ts`.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`, then in another terminal:
`curl -s http://localhost:3000/api/connections/trending | head -c 400`
Expected: a JSON object with `nodes` and `edges` arrays (both may be empty if no trending papers cite each other — that is valid). Confirm no 500 error and the `Cache-Control` header via `curl -sI`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/connections/trending/route.ts
git commit -m "feat: GET /api/connections/trending relationship graph route"
```

---

## Task 4: Per-user connections route

**Files:**
- Create: `src/app/api/me/connections/route.ts`

- [ ] **Step 1: Write the route handler**

```ts
import { NextResponse } from "next/server";
import { createServerAuthClient, createAnonClient } from "@/lib/supabase/server";
import { buildInducedSubgraph } from "@/lib/graph/induced-subgraph";
import type { GraphNode, GraphResponse } from "@/lib/graph/types";

const PMID_CAP = 60;

export async function GET() {
  const authClient = await createServerAuthClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json<GraphResponse>({ nodes: [], edges: [] }, { status: 401 });
  }

  // 1. Collect the user's pmids from bookmarks, comments, likes — most recent
  //    interactions first. RLS lets the authed client read the user's own rows.
  const [bookmarks, comments, likes] = await Promise.all([
    authClient
      .from("bookmarks")
      .select("pmid, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(PMID_CAP),
    authClient
      .from("paper_comments")
      .select("paper_pmid, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(PMID_CAP),
    authClient
      .from("paper_likes")
      .select("paper_pmid, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(PMID_CAP),
  ]);

  // Merge by recency, dedupe, cap at PMID_CAP.
  const interactions: Array<{ pmid: string; at: string }> = [
    ...(bookmarks.data ?? []).map((r) => ({ pmid: String(r.pmid), at: String(r.created_at) })),
    ...(comments.data ?? []).map((r) => ({ pmid: String(r.paper_pmid), at: String(r.created_at) })),
    ...(likes.data ?? []).map((r) => ({ pmid: String(r.paper_pmid), at: String(r.created_at) })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const pmidSet = new Set<string>();
  for (const { pmid } of interactions) {
    if (pmidSet.size >= PMID_CAP) break;
    pmidSet.add(pmid);
  }

  if (pmidSet.size === 0) {
    return NextResponse.json<GraphResponse>({ nodes: [], edges: [] });
  }

  // 2. Paper metadata + edge rows. Reads are RLS-public, so use the anon client.
  const supabase = createAnonClient();
  const pmidList = [...pmidSet];

  const [{ data: papers }, { data: citations }, { data: mentions }] = await Promise.all([
    supabase
      .from("papers")
      .select("pmid, title, publication_date, journals!inner(abbreviation, color)")
      .in("pmid", pmidList),
    supabase
      .from("paper_citations")
      .select("source_pmid, target_pmid")
      .in("source_pmid", pmidList)
      .in("target_pmid", pmidList),
    supabase
      .from("paper_mentions")
      .select("source_pmid, mentioned_pmid")
      .in("source_pmid", pmidList)
      .in("mentioned_pmid", pmidList),
  ]);

  const paperMap = new Map<string, GraphNode>();
  for (const row of papers ?? []) {
    const journal = row.journals as unknown as { abbreviation: string; color: string };
    paperMap.set(String(row.pmid), {
      pmid: String(row.pmid),
      title: String(row.title),
      journal_abbreviation: String(journal.abbreviation),
      journal_color: String(journal.color),
      publication_date: String(row.publication_date),
    });
  }

  // 3. Induced sub-graph; drop edgeless nodes.
  const { edges, connectedPmids } = buildInducedSubgraph(
    pmidSet,
    citations ?? [],
    mentions ?? []
  );
  const nodes = connectedPmids
    .map((p) => paperMap.get(p))
    .filter((n): n is GraphNode => Boolean(n));

  return NextResponse.json<GraphResponse>({ nodes, edges });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors in `src/app/api/me/connections/route.ts`.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`, then:
`curl -s http://localhost:3000/api/me/connections`
Expected (no session cookie): HTTP 401 with `{"nodes":[],"edges":[]}`. Confirm status with `curl -sI`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/me/connections/route.ts
git commit -m "feat: GET /api/me/connections per-user relationship graph route"
```

---

## Task 5: Focal-free relationship graph component

**Files:**
- Create: `src/components/graph/relationship-graph.tsx`

This is a d3 rendering component adapted from `paper-connection-graph.tsx` with the focal-node pinning removed and using the shared `GraphNode`/`GraphEdge` types. d3 force/SVG behaviour is verified manually (Step 3), not unit-tested.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as d3 from "d3";
import type { GraphNode, GraphEdge } from "@/lib/graph/types";

interface SimNode extends d3.SimulationNodeDatum {
  pmid: string;
  title: string;
  journal_abbreviation: string;
  journal_color: string;
}

interface SimEdge extends d3.SimulationLinkDatum<SimNode> {
  type: GraphEdge["type"];
}

interface RelationshipGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
}

export function RelationshipGraph({ nodes, edges, width, height }: RelationshipGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const navigate = useCallback((pmid: string) => {
    router.push(`/paper/${pmid}`);
  }, [router]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const tooltip = d3.select(tooltipRef.current);
    svg.selectAll("*").remove();

    const graphNodes: SimNode[] = nodes.map((n) => ({
      pmid: n.pmid,
      title: n.title,
      journal_abbreviation: n.journal_abbreviation,
      journal_color: n.journal_color,
    }));
    const graphEdges: SimEdge[] = edges.map((e) => ({
      source: e.source,
      target: e.target,
      type: e.type,
    }));

    const g = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    const simulation = d3.forceSimulation<SimNode>(graphNodes)
      .force("link", d3.forceLink<SimNode, SimEdge>(graphEdges).id((d) => d.pmid).distance(120))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(34));

    const link = g.selectAll<SVGLineElement, SimEdge>(".link")
      .data(graphEdges).enter().append("line")
      .attr("class", "link")
      .attr("stroke", (d) => d.type === "citation" ? "#9CA3AF" : d.type === "mention" ? "#3B82F6" : "#8B5CF6")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", (d) => d.type === "citation" ? "6,3" : "none");

    const node = g.selectAll<SVGGElement, SimNode>(".node")
      .data(graphNodes).enter().append("g")
      .attr("class", "node")
      .style("cursor", "pointer");

    node.on("click", (_event, d) => navigate(d.pmid));
    node.call(
      d3.drag<SVGGElement, SimNode>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        })
    );

    node.append("circle")
      .attr("r", 16)
      .attr("fill", (d) => d.journal_color)
      .attr("stroke", "white")
      .attr("stroke-width", 2)
      .attr("opacity", 0.9);

    node.append("text")
      .text((d) => d.journal_abbreviation)
      .attr("text-anchor", "middle").attr("dy", "0.35em")
      .attr("fill", "white").attr("font-size", "7px")
      .attr("font-weight", "bold")
      .style("pointer-events", "none");

    node.append("text")
      .text((d) => d.title.length > 30 ? d.title.slice(0, 27) + "..." : d.title)
      .attr("text-anchor", "middle").attr("dy", 28)
      .attr("fill", "currentColor").attr("font-size", "10px")
      .style("pointer-events", "none")
      .attr("class", "text-gray-700 dark:text-gray-300");

    node.on("mouseenter", function (event, d) {
      tooltip.style("opacity", 1)
        .style("left", event.pageX + 12 + "px")
        .style("top", event.pageY - 12 + "px")
        .text(`${d.title}\n${d.journal_abbreviation}`);
    }).on("mouseleave", () => tooltip.style("opacity", 0));

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as SimNode).x!)
        .attr("y1", (d) => (d.source as SimNode).y!)
        .attr("x2", (d) => (d.target as SimNode).x!)
        .attr("y2", (d) => (d.target as SimNode).y!);
      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => { simulation.stop(); };
  }, [nodes, edges, width, height, navigate]);

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="w-full rounded-xl bg-gray-50 dark:bg-gray-900/50"
      />
      <div
        ref={tooltipRef}
        className="pointer-events-none fixed z-[100] max-w-xs whitespace-pre-wrap rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg opacity-0 transition-opacity dark:bg-gray-700"
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors in `src/components/graph/relationship-graph.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/graph/relationship-graph.tsx
git commit -m "feat: focal-free relationship graph d3 component"
```

---

## Task 6: Relationship graph panel

**Files:**
- Create: `src/components/papers/relationship-graph-panel.tsx`

Owns data fetching and the loading/empty/error states; chooses the endpoint by the active tab.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import useSWR from "swr";
import { Loader2, Network } from "lucide-react";
import { RelationshipGraph } from "@/components/graph/relationship-graph";
import type { GraphResponse } from "@/lib/graph/types";

const fetcher = async (url: string): Promise<GraphResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`graph fetch failed: ${res.status}`);
  return res.json();
};

interface RelationshipGraphPanelProps {
  // "for_you" + authenticated → per-user graph; otherwise the trending graph.
  activeTab: "timeline" | "for_you";
  isAuthenticated: boolean;
}

export function RelationshipGraphPanel({ activeTab, isAuthenticated }: RelationshipGraphPanelProps) {
  const useAccountGraph = activeTab === "for_you" && isAuthenticated;
  const endpoint = useAccountGraph ? "/api/me/connections" : "/api/connections/trending";

  const { data, error, isLoading } = useSWR<GraphResponse>(endpoint, fetcher, {
    revalidateOnFocus: false,
  });

  return (
    <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
      <h2 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        <Network className="h-3.5 w-3.5" />
        Relationship graph
      </h2>

      {isLoading ? (
        <div className="flex h-[120px] items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-900/50">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : error ? (
        <p className="rounded-xl bg-gray-50 px-3 py-4 text-xs text-gray-400 dark:bg-gray-900/50 dark:text-gray-500">
          관계도를 불러오지 못했습니다.
        </p>
      ) : !data || data.nodes.length === 0 ? (
        <p className="rounded-xl bg-gray-50 px-3 py-6 text-center text-xs text-gray-500 dark:bg-gray-900/50 dark:text-gray-400">
          {useAccountGraph
            ? "북마크·댓글·좋아요한 논문이 모이면 관계도가 그려집니다."
            : "트렌딩 논문 간 인용·멘션 관계가 아직 없습니다."}
        </p>
      ) : (
        <RelationshipGraph nodes={data.nodes} edges={data.edges} width={680} height={360} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors in `src/components/papers/relationship-graph-panel.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/papers/relationship-graph-panel.tsx
git commit -m "feat: relationship graph panel with loading/empty/error states"
```

---

## Task 7: Journal filter panel

**Files:**
- Create: `src/components/layout/journal-filter-panel.tsx`

Vertical multi-select list of journals, driving `filters.journals` (an array of journal `slug`s). Replaces the center-header `JournalCloud` on the home page.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import type { JournalConfig } from "@/lib/constants/journals";

interface JournalFilterPanelProps {
  journals: JournalConfig[];
  activeJournals: string[]; // slugs
  onToggle: (slug: string) => void;
  onClearAll: () => void;
}

export function JournalFilterPanel({
  journals,
  activeJournals,
  onToggle,
  onClearAll,
}: JournalFilterPanelProps) {
  const hasFilter = activeJournals.length > 0;

  return (
    <div className="space-y-1">
      <button
        onClick={onClearAll}
        className={`flex w-full items-center rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
          !hasFilter
            ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
            : "text-gray-500 hover:bg-gray-50 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        }`}
      >
        All journals
      </button>
      {journals.map((journal) => {
        const isActive = activeJournals.includes(journal.slug);
        return (
          <button
            key={journal.slug}
            onClick={() => onToggle(journal.slug)}
            title={`${journal.name} (IF: ${journal.impactFactor ?? "N/A"})`}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
              isActive
                ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                : "text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            }`}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: journal.color }}
            />
            <span className="min-w-0 flex-1 truncate">{journal.abbreviation}</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors in `src/components/layout/journal-filter-panel.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/journal-filter-panel.tsx
git commit -m "feat: journal filter panel for home sidebar"
```

---

## Task 8: Home sidebar

**Files:**
- Create: `src/components/layout/home-sidebar.tsx`

Composes the search box + a Topics/Journals tabbed panel. Tab state is internal to this component.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState } from "react";
import { SearchInput } from "@/components/papers/search-input";
import { TopicMonitorPanel } from "@/components/layout/topic-monitor-panel";
import { JournalFilterPanel } from "@/components/layout/journal-filter-panel";
import { JOURNALS } from "@/lib/constants/journals";

type SidebarTab = "topics" | "journals";

interface HomeSidebarProps {
  query: string;
  onQueryChange: (q: string) => void;
  activeJournals: string[];
  onToggleJournal: (slug: string) => void;
  onClearJournals: () => void;
  onActivateTopic: (topic: string) => void;
  onClearActiveTopic: () => void;
}

export function HomeSidebar({
  query,
  onQueryChange,
  activeJournals,
  onToggleJournal,
  onClearJournals,
  onActivateTopic,
  onClearActiveTopic,
}: HomeSidebarProps) {
  const [tab, setTab] = useState<SidebarTab>("topics");

  const tabClass = (isActive: boolean) =>
    `flex-1 border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
      isActive
        ? "border-blue-500 text-gray-900 dark:text-gray-100"
        : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
    }`;

  return (
    <div className="space-y-4">
      <SearchInput
        value={query}
        onChange={onQueryChange}
        placeholder="Search topic, PMID, DOI"
      />

      <div>
        <div className="flex">
          <button onClick={() => setTab("topics")} className={tabClass(tab === "topics")}>
            Topics
          </button>
          <button onClick={() => setTab("journals")} className={tabClass(tab === "journals")}>
            Journals{activeJournals.length > 0 ? ` (${activeJournals.length})` : ""}
          </button>
        </div>

        <div className="pt-3">
          {tab === "topics" ? (
            <TopicMonitorPanel
              activeQuery={query}
              onActivate={onActivateTopic}
              onClearActive={onClearActiveTopic}
            />
          ) : (
            <JournalFilterPanel
              journals={JOURNALS}
              activeJournals={activeJournals}
              onToggle={onToggleJournal}
              onClearAll={onClearJournals}
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors in `src/components/layout/home-sidebar.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/home-sidebar.tsx
git commit -m "feat: home sidebar with search + Topics/Journals tabs"
```

---

## Task 9: Restructure the home page

**Files:**
- Modify: `src/components/papers/home-page.tsx` (full rewrite of the JSX/structure)

The center sticky header becomes only the Timeline/For you tabs. Below it: relationship graph, then trial banner + filter bar, then feed. The left column uses `HomeSidebar` instead of the bare `TopicMonitorPanel`. `JournalCloud` and `cloudOpen` state are removed.

- [ ] **Step 1: Replace the file contents**

```tsx
"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Microscope, X } from "lucide-react";
const RightRail = dynamic(() => import("@/components/layout/right-rail").then((m) => ({ default: m.RightRail })), { ssr: false });
const HomeSidebar = dynamic(() => import("@/components/layout/home-sidebar").then((m) => ({ default: m.HomeSidebar })), { ssr: false });
import { PaperFeed } from "@/components/papers/paper-feed";
import { FilterBar } from "@/components/papers/filter-bar";
import { RelationshipGraphPanel } from "@/components/papers/relationship-graph-panel";
import { usePaperFilters } from "@/hooks/use-paper-filters";
import { usePapers } from "@/hooks/use-papers";
import { useAuth } from "@/hooks/use-auth";
import type { ArticleType, PapersResponse } from "@/types/filters";

type MainTab = "timeline" | "for_you";

interface HomePageProps {
  initialData?: PapersResponse;
}

export function HomePage({ initialData }: HomePageProps) {
  const searchParams = useSearchParams();
  const { filters, setFilters, clearFilters, hasActiveFilters } = usePaperFilters();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<MainTab>(user ? "for_you" : "timeline");
  const [articleType, setArticleType] = useState<ArticleType | undefined>();
  const effectiveFilters = {
    ...filters,
    personalized: Boolean(user) && activeTab === "for_you",
    articleType,
  };
  const {
    papers,
    total,
    hasMore,
    isLoading,
    isLoadingMore,
    isValidating,
    loadMore,
    dataSource,
    mutate,
  } = usePapers(effectiveFilters, initialData, {
    skipMountRevalidation: true,
  });

  useEffect(() => {
    if (user) mutate();
  }, [user, mutate]);

  useEffect(() => {
    const q = searchParams.get("q");
    const trial = searchParams.get("trial");
    if (q || trial) {
      setActiveTab("for_you");
      setFilters({
        q: q || undefined,
        trial: trial || undefined,
        sort: "date_desc",
      });
    }
    // Only run on mount to read initial URL params
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRemoveFilter = (key: string, value?: string) => {
    if (key === "journals" && value) {
      const updated = (filters.journals || []).filter((s) => s !== value);
      setFilters({ journals: updated.length > 0 ? updated : undefined });
    } else if (key === "q" && filters.trial) {
      setFilters({ q: undefined, trial: undefined });
    } else {
      setFilters({ [key]: undefined });
    }
  };

  const handleTabChange = (tab: MainTab) => {
    setActiveTab(tab);
    setFilters({ sort: "date_desc", trial: undefined });
  };

  const toggleJournal = (slug: string) => {
    const current = filters.journals || [];
    const updated = current.includes(slug)
      ? current.filter((s) => s !== slug)
      : [...current, slug];
    setFilters({ journals: updated.length > 0 ? updated : undefined });
  };

  const tabClass = (isActive: boolean) =>
    `border-b-2 px-3 py-3 font-semibold transition-colors ${
      isActive
        ? "border-blue-500 text-gray-900 dark:text-gray-100"
        : "border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-200"
    }`;

  return (
    <div className="mx-auto w-full max-w-[1280px] px-0 sm:px-4 sm:py-4">
      <div className="grid min-h-[calc(100vh-56px)] grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <div className="hidden lg:block lg:pr-4">
          <div className="sticky top-20 max-h-[calc(100vh-96px)] overflow-y-auto pr-1">
            <HomeSidebar
              query={filters.q || ""}
              onQueryChange={(q) => setFilters({ q: q || undefined, trial: undefined })}
              activeJournals={filters.journals || []}
              onToggleJournal={toggleJournal}
              onClearJournals={() => setFilters({ journals: undefined })}
              onActivateTopic={(topic) => {
                setActiveTab("for_you");
                setFilters({ q: topic, sort: "date_desc", trial: undefined });
              }}
              onClearActiveTopic={() => setFilters({ q: undefined, trial: undefined })}
            />
          </div>
        </div>

        <div className="min-w-0 border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
          <div className="sticky top-14 z-20 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
            <div className="grid grid-cols-2 text-sm">
              <button
                onClick={() => handleTabChange("timeline")}
                className={tabClass(activeTab === "timeline")}
              >
                Timeline
              </button>
              {user && (
                <button
                  onClick={() => handleTabChange("for_you")}
                  className={tabClass(activeTab === "for_you")}
                >
                  For you
                </button>
              )}
            </div>
          </div>

          <RelationshipGraphPanel
            activeTab={activeTab}
            isAuthenticated={Boolean(user)}
          />

          {filters.trial && (
            <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
              <div className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-3 py-3 dark:border-emerald-900/70 dark:bg-emerald-950/30">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800 dark:text-emerald-300">
                    <Microscope className="h-3.5 w-3.5" />
                    Active trial filter
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {filters.trial}
                  </p>
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    Timeline is showing papers matched from this trial&apos;s intervention and condition keywords.
                  </p>
                </div>
                <button
                  onClick={() => setFilters({ q: undefined, trial: undefined })}
                  className="rounded-full p-1 text-emerald-700 transition-colors hover:bg-emerald-100 hover:text-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-900/50 dark:hover:text-emerald-100"
                  aria-label="Clear active trial filter"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {hasActiveFilters && (
            <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
              <FilterBar
                filters={filters}
                onRemoveFilter={handleRemoveFilter}
                onClear={clearFilters}
              />
            </div>
          )}

          <div>
            <PaperFeed
              papers={papers}
              total={total}
              hasMore={hasMore ?? false}
              isLoading={isLoading}
              isLoadingMore={isLoadingMore ?? false}
              onLoadMore={loadMore}
              personalized={activeTab === "for_you" && Boolean(user)}
              articleType={articleType}
              onArticleTypeChange={setArticleType}
              dataSource={dataSource}
              isLiveLoading={isValidating && Boolean(filters.q)}
            />
          </div>
        </div>

        <div className="hidden xl:block xl:pl-4">
          <div className="sticky top-20 max-h-[calc(100vh-96px)] overflow-y-auto pr-1">
            <RightRail total={total} />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles and lints**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. `JournalCloud`, `Microscope`/`X` imports, `JOURNALS`, and `cloudOpen` are all still consistent — `JournalCloud`, `JOURNALS`, and `SearchInput` imports are removed; `Microscope` and `X` are still used by the trial banner.

- [ ] **Step 3: Run the full test suite**

Run: `npm run test`
Expected: PASS — all existing tests plus the new `induced-subgraph.test.ts` are green.

- [ ] **Step 4: Manual verification**

Run: `npm run dev` and open `http://localhost:3000`:
- Left sidebar shows the search box, then a Topics/Journals tab strip. Switching to Journals shows the vertical journal list; toggling rows filters the feed.
- Center column top shows the Timeline tab (and For you when logged in) — no "Home" title.
- Below the tabs, the relationship graph renders (or its empty/loading state). Switching tabs swaps trending vs. account graph.
- Trial banner and filter bar still appear directly above the feed when active.

- [ ] **Step 5: Commit**

```bash
git add src/components/papers/home-page.tsx
git commit -m "feat: restructure home page with sidebar and relationship graph"
```

---

## Self-Review Notes

- **Spec coverage:** search→sidebar (Task 8/9), tabs→top of center column (Task 9), relationship graph (Tasks 2–6), journal filter→sidebar tab (Tasks 7–9), two API routes with shared shape (Tasks 3–4), shared edge helper + types (Tasks 1–2), induced-subgraph unit tests (Task 2). All spec sections map to a task.
- **`JournalCloud`:** left in place in the repo, removed only from `home-page.tsx` imports — matches the spec's "no longer used on the home page".
- **Detail-page graph tests:** the spec mentions they "must still pass", but no such tests exist in the repo; `paper-connection-graph.tsx` is left untouched, so nothing regresses. The shared-types extraction does not modify the detail-page component (its richer types stay local), so the spec's no-regression intent holds.
- **Type consistency:** `GraphNode`/`GraphEdge`/`GraphResponse` from `src/lib/graph/types.ts` are used identically across both routes, the panel, and the graph component. `buildInducedSubgraph` returns `{ edges, connectedPmids }` and is called with that destructuring in both routes.
