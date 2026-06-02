"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { Loader2, Network, ChevronLeft, AlertTriangle } from "lucide-react";
import { RelationshipGraph } from "@/components/graph/relationship-graph";
import { DetailSheet } from "@/components/papers/detail-sheet";
import { useGraphView } from "@/hooks/use-graph-view";
import type {
  GalaxySnapshot,
  TopicSnapshot,
  PaperNode,
  PaperEdge,
} from "@/lib/graph/types";

const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`graph fetch ${url}: ${res.status}`);
  return (await res.json()) as T;
};

const PANEL_WIDTH = 680;
const PANEL_HEIGHT = 360;

export function RelationshipGraphPanel() {
  const [view, setView] = useGraphView();

  // Galaxy fetch (only when we are on the galaxy state).
  const galaxy = useSWR<GalaxySnapshot & { stale?: boolean }>(
    view.kind === "galaxy" ? "/api/graph/galaxy" : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Topic fetch (when we are on topic or highlight).
  const topicSlug = view.kind === "galaxy" ? null : view.slug;
  const topic = useSWR<TopicSnapshot & { stale?: boolean }>(
    topicSlug ? `/api/graph/topic/${topicSlug}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Galaxy click → topic. We render topic clusters as our standard
  // GraphNode shape by promoting them: pmid := slug, title := label.
  const galaxyGraphNodes = useMemo(() => {
    if (!galaxy.data) return [];
    return galaxy.data.nodes.map((n) => ({
      pmid: n.topic_slug,
      title: `${n.topic_label} (${n.paper_count})`,
      journal_abbreviation: n.topic_label.slice(0, 4).toUpperCase(),
      journal_color: n.topic_color,
      publication_date: "",
    }));
  }, [galaxy.data]);

  const galaxyGraphEdges = useMemo(() => {
    if (!galaxy.data) return [];
    return galaxy.data.edges.map((e) => ({
      source: e.source,
      target: e.target,
      type: "citation" as const,
    }));
  }, [galaxy.data]);

  const topicGraphNodes = useMemo(
    () => topic.data?.nodes ?? [],
    [topic.data]
  );

  const topicGraphEdges = useMemo(() => {
    if (!topic.data) return [];
    return topic.data.edges.map((e) => ({
      source: e.source,
      target: e.target,
      // Pick the strongest type for the legacy `type` field on GraphEdge.
      type: pickStrongest(e.types),
    }));
  }, [topic.data]);

  const isLoading = view.kind === "galaxy" ? galaxy.isLoading : topic.isLoading;
  const error = view.kind === "galaxy" ? galaxy.error : topic.error;

  const focused: { node: PaperNode; neighbors: { node: PaperNode; edge: PaperEdge }[] } | null =
    view.kind === "highlight" && topic.data
      ? buildFocusedView(view.focusedPmid, topic.data)
      : null;

  return (
    <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {view.kind !== "galaxy" && (
            <button
              type="button"
              onClick={() =>
                setView(view.kind === "highlight" ? { kind: "topic", slug: view.slug } : { kind: "galaxy" })
              }
              className="rounded p-0.5 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Back"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <Network className="h-3.5 w-3.5" />
          {view.kind === "galaxy"
            ? "Relationship map"
            : `Relationship map · ${view.slug}`}
        </h2>
        {(view.kind === "galaxy" ? galaxy.data?.stale : topic.data?.stale) && (
          <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            Stale
          </span>
        )}
      </div>

      <div className="flex gap-3">
        <div className={focused ? "min-w-0 flex-1" : "w-full"}>
          {isLoading ? (
            <div className="flex h-[120px] items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-900/50">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <p className="rounded-xl bg-gray-50 px-3 py-4 text-xs text-gray-400 dark:bg-gray-900/50 dark:text-gray-500">
              관계도를 불러오지 못했습니다.
            </p>
          ) : view.kind === "galaxy" ? (
            galaxyGraphNodes.length === 0 ? (
              <p className="rounded-xl bg-gray-50 px-3 py-6 text-center text-xs text-gray-500 dark:bg-gray-900/50 dark:text-gray-400">
                아직 관계도가 생성되지 않았습니다.
              </p>
            ) : (
              <RelationshipGraph
                nodes={galaxyGraphNodes}
                edges={galaxyGraphEdges}
                width={PANEL_WIDTH}
                height={PANEL_HEIGHT}
                onSelectNode={(n) => setView({ kind: "topic", slug: n.pmid })}
                nodeRadius={(n) => 16 + Math.min(20, Math.sqrt(galaxyNodeCount(galaxy.data!, n.pmid)) * 1.8)}
              />
            )
          ) : (
            <RelationshipGraph
              nodes={topicGraphNodes}
              edges={topicGraphEdges}
              width={PANEL_WIDTH}
              height={PANEL_HEIGHT}
              focusedPmid={view.kind === "highlight" ? view.focusedPmid : undefined}
              onSelectNode={(n) =>
                setView({ kind: "highlight", slug: view.slug, focusedPmid: n.pmid })
              }
            />
          )}
        </div>
        {focused && (
          <div className="hidden w-72 md:block">
            <DetailSheet
              focused={focused.node}
              neighbors={focused.neighbors}
              onClose={() =>
                view.kind === "highlight" && setView({ kind: "topic", slug: view.slug })
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

function pickStrongest(types: PaperEdge["types"]): "citation" | "mention" | "both" {
  const has = (t: PaperEdge["types"][number]) => types.includes(t);
  if (has("citation") && has("mention")) return "both";
  if (has("citation")) return "citation";
  if (has("mention")) return "mention";
  // Co-author / topic fall back to the citation visual in the V1 legacy edge
  // taxonomy. Phase 2 should add proper "coauthor" / "topic" enum values to
  // GraphEdge so the rendering primitive can style them distinctly.
  return "citation";
}

function buildFocusedView(focusedPmid: string, snap: TopicSnapshot) {
  const node = snap.nodes.find((n) => n.pmid === focusedPmid);
  if (!node) return null;
  const neighbors: { node: PaperNode; edge: PaperEdge }[] = [];
  for (const e of snap.edges) {
    const otherPmid =
      e.source === focusedPmid ? e.target : e.target === focusedPmid ? e.source : null;
    if (!otherPmid) continue;
    const other = snap.nodes.find((n) => n.pmid === otherPmid);
    if (other) neighbors.push({ node: other, edge: e });
  }
  neighbors.sort((a, b) => b.edge.weight - a.edge.weight);
  return { node, neighbors };
}

function galaxyNodeCount(snap: GalaxySnapshot, slug: string): number {
  return snap.nodes.find((n) => n.topic_slug === slug)?.paper_count ?? 0;
}
