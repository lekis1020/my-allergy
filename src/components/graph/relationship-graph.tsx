"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as d3 from "d3";
import { Plus, Minus, RotateCcw } from "lucide-react";
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
  /**
   * Optional radius callback. Default: 16 (matches V1 behavior).
   */
  nodeRadius?: (node: GraphNode) => number;
  /**
   * Optional stroke / dash override per edge. Default keeps the current
   * citation/mention/both ternary inline.
   */
  edgeStyle?: (edge: GraphEdge) => { stroke: string; strokeWidth: number; dasharray: string | null };
  /**
   * When set, non-focused, non-neighbor nodes and their incident edges fade
   * to opacity 0.15. The focused node stays at full opacity.
   */
  focusedPmid?: string;
  /**
   * If provided, click invokes this instead of the default
   * `router.push(/paper/[pmid])` behavior.
   */
  onSelectNode?: (node: GraphNode) => void;
  /** D3 link force distance. Default 120. */
  linkDistance?: number;
  /** D3 manyBody charge strength (negative = repel). Default -300. */
  chargeStrength?: number;
  /**
   * Additional X/Y centering force strength (0–1). Default 0. Useful for
   * edgeless graphs where charge alone would spread nodes off-canvas.
   */
  centerStrength?: number;
}

export function RelationshipGraph({
  nodes, edges, width, height,
  nodeRadius, edgeStyle, focusedPmid, onSelectNode,
  linkDistance = 120,
  chargeStrength = -300,
  centerStrength = 0,
}: RelationshipGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const router = useRouter();

  const navigate = useCallback((pmid: string) => {
    router.push(`/paper/${pmid}`);
  }, [router]);

  const handleZoomIn = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(200).call(zoomRef.current.scaleBy, 1.4);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(200).call(zoomRef.current.scaleBy, 1 / 1.4);
  }, []);

  const handleZoomReset = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(200).call(zoomRef.current.transform, d3.zoomIdentity);
  }, []);

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

    const focusedNeighbors = new Set<string>();
    if (focusedPmid) {
      for (const e of edges) {
        if (e.source === focusedPmid) focusedNeighbors.add(e.target);
        else if (e.target === focusedPmid) focusedNeighbors.add(e.source);
      }
    }

    function defaultEdgeStroke(t: GraphEdge["type"]) {
      return t === "citation" ? "#9CA3AF" : t === "mention" ? "#3B82F6" : "#8B5CF6";
    }

    const g = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);
    zoomRef.current = zoom;

    const simulation = d3.forceSimulation<SimNode>(graphNodes)
      .force("link", d3.forceLink<SimNode, SimEdge>(graphEdges).id((d) => d.pmid).distance(linkDistance))
      .force("charge", d3.forceManyBody().strength(chargeStrength))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(34));
    if (centerStrength > 0) {
      simulation.force("x", d3.forceX(width / 2).strength(centerStrength));
      simulation.force("y", d3.forceY(height / 2).strength(centerStrength));
    }

    const link = g.selectAll<SVGLineElement, SimEdge>(".link")
      .data(graphEdges).enter().append("line")
      .attr("class", "link")
      .attr("stroke", (d) => edgeStyle ? edgeStyle(d as unknown as GraphEdge).stroke : defaultEdgeStroke(d.type))
      .attr("stroke-width", (d) => edgeStyle ? edgeStyle(d as unknown as GraphEdge).strokeWidth : 2)
      .attr("stroke-dasharray", (d) => {
        const style = edgeStyle?.(d as unknown as GraphEdge);
        if (style?.dasharray !== undefined) return style.dasharray ?? "";
        return d.type === "citation" ? "6,3" : "";
      })
      .attr("opacity", (d) => {
        if (!focusedPmid) return 1;
        const src = (d.source as SimNode).pmid;
        const tgt = (d.target as SimNode).pmid;
        if (src === focusedPmid || tgt === focusedPmid) return 1;
        return 0.15;
      });

    const node = g.selectAll<SVGGElement, SimNode>(".node")
      .data(graphNodes).enter().append("g")
      .attr("class", "node")
      .style("cursor", "pointer");

    node.on("click", (_event, d) => {
      if (onSelectNode) onSelectNode(d as unknown as GraphNode);
      else navigate(d.pmid);
    });
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
      .attr("r", (d) => nodeRadius?.(d as unknown as GraphNode) ?? 16)
      .attr("fill", (d) => d.journal_color)
      .attr("stroke", "white")
      .attr("stroke-width", 2)
      .attr("opacity", (d) => {
        if (!focusedPmid) return 0.9;
        if (d.pmid === focusedPmid) return 1;
        if (focusedNeighbors.has(d.pmid)) return 0.9;
        return 0.15;
      });

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
  }, [nodes, edges, width, height, navigate, nodeRadius, edgeStyle, focusedPmid, onSelectNode, linkDistance, chargeStrength, centerStrength]);

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full rounded-xl bg-gray-50 dark:bg-gray-900/50"
      />
      <div className="absolute right-2 top-2 flex flex-col gap-1">
        <button
          type="button"
          onClick={handleZoomIn}
          aria-label="Zoom in"
          className="rounded-md border border-gray-200 bg-white/95 p-1.5 text-gray-700 shadow-sm transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          aria-label="Zoom out"
          className="rounded-md border border-gray-200 bg-white/95 p-1.5 text-gray-700 shadow-sm transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleZoomReset}
          aria-label="Reset zoom"
          className="rounded-md border border-gray-200 bg-white/95 p-1.5 text-gray-700 shadow-sm transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
      <div
        ref={tooltipRef}
        className="pointer-events-none fixed z-[100] max-w-xs whitespace-pre-wrap rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg opacity-0 transition-opacity dark:bg-gray-700"
      />
    </div>
  );
}
