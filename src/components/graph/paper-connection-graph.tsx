"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
// Import only the d3 submodules this component uses — the full "d3" bundle
// would drag every d3 package into the chunk.
import { select } from "d3-selection";
import { zoom as d3Zoom } from "d3-zoom";
import { drag as d3Drag } from "d3-drag";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";

interface GraphNode extends SimulationNodeDatum {
  pmid: string;
  title: string;
  journal_abbreviation: string;
  journal_color: string;
  isFocal: boolean;
}

interface MentionDetail {
  comment_id: string;
  anon_id: string;
  content_snippet: string;
  created_at: string;
}

interface GraphEdge extends SimulationLinkDatum<GraphNode> {
  type: "citation" | "mention" | "both" | "similarity" | "bookmark";
  direction: "references" | "cited_by" | "bidirectional";
  mentions: MentionDetail[];
  similarity?: number;
}

interface PaperConnectionGraphProps {
  focal: { pmid: string; title: string; journal_abbreviation: string; journal_color: string };
  nodes: Array<{ pmid: string; title: string; journal_abbreviation: string; journal_color: string; publication_date: string }>;
  edges: Array<{
    source: string; target: string;
    type: "citation" | "mention" | "both" | "similarity" | "bookmark";
    direction: "references" | "cited_by" | "bidirectional" | null;
    mentions: MentionDetail[];
    similarity?: number;
  }>;
  width: number;
  height: number;
  interactive?: boolean;
}

export function PaperConnectionGraph({
  focal, nodes, edges, width, height, interactive = true,
}: PaperConnectionGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const navigate = useCallback((pmid: string) => {
    router.push(`/paper/${pmid}`);
  }, [router]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = select(svgRef.current);
    const tooltip = select(tooltipRef.current);
    svg.selectAll("*").remove();

    // Build graph data
    const graphNodes: GraphNode[] = [
      { pmid: focal.pmid, title: focal.title, journal_abbreviation: focal.journal_abbreviation, journal_color: focal.journal_color, isFocal: true },
      ...nodes.map((n) => ({
        pmid: n.pmid, title: n.title, journal_abbreviation: n.journal_abbreviation, journal_color: n.journal_color, isFocal: false,
      })),
    ];

    const graphEdges: GraphEdge[] = edges.map((e) => ({
      source: e.source, target: e.target,
      type: e.type, direction: e.direction, mentions: e.mentions, similarity: e.similarity,
    }));

    // Defs for arrow markers
    const defs = svg.append("defs");
    defs.append("marker")
      .attr("id", "arrow-citation")
      .attr("viewBox", "0 0 10 6").attr("refX", 28).attr("refY", 3)
      .attr("markerWidth", 8).attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path").attr("d", "M0,0L10,3L0,6").attr("fill", "#9CA3AF");

    defs.append("marker")
      .attr("id", "arrow-mention")
      .attr("viewBox", "0 0 10 6").attr("refX", 28).attr("refY", 3)
      .attr("markerWidth", 8).attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path").attr("d", "M0,0L10,3L0,6").attr("fill", "#3B82F6");

    // Container with zoom
    const g = svg.append("g");

    if (interactive) {
      const zoom = d3Zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 3])
        .on("zoom", (event) => g.attr("transform", event.transform));
      svg.call(zoom);
    }

    // Force simulation
    const simulation = forceSimulation<GraphNode>(graphNodes)
      .force("link", forceLink<GraphNode, GraphEdge>(graphEdges).id((d) => d.pmid).distance(160))
      .force("charge", forceManyBody().strength(-400))
      .force("center", forceCenter(width / 2, height / 2))
      .force("collision", forceCollide().radius(40));

    // Fix focal node to center
    const focalNode = graphNodes.find((n) => n.isFocal);
    if (focalNode) {
      focalNode.fx = width / 2;
      focalNode.fy = height / 2;
    }

    // Draw edges
    const link = g.selectAll<SVGLineElement, GraphEdge>(".link")
      .data(graphEdges).enter().append("line")
      .attr("class", "link")
      .attr("stroke", (d) =>
        d.type === "citation" ? "#9CA3AF"
        : d.type === "mention" ? "#3B82F6"
        : d.type === "similarity" ? "#14b8a6"
        : d.type === "bookmark" ? "#f59e0b"
        : "#8B5CF6")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", (d) =>
        d.type === "citation" ? "6,3"
        : d.type === "similarity" ? "4,3"
        : "none")
      .attr("marker-end", (d) =>
        d.type === "citation" ? "url(#arrow-citation)"
        : d.type === "mention" || d.type === "both" ? "url(#arrow-mention)"
        : null);

    if (interactive) {
      link.on("mouseenter", function (event, d) {
        const label = d.type === "citation"
          ? (d.direction === "references" ? "References" : d.direction === "cited_by" ? "Cited by" : "Bidirectional")
          : "";
        const mentionText = d.mentions.map((m) =>
          `\u{1F4AC} ${m.content_snippet}`
        ).join("\n");
        const text = [label, mentionText].filter(Boolean).join("\n");
        tooltip.style("opacity", 1)
          .style("left", event.pageX + 12 + "px")
          .style("top", event.pageY - 12 + "px")
          .text(text);
      }).on("mouseleave", () => tooltip.style("opacity", 0));
    }

    // Draw nodes
    const node = g.selectAll<SVGGElement, GraphNode>(".node")
      .data(graphNodes).enter().append("g")
      .attr("class", "node")
      .style("cursor", interactive ? "pointer" : "default");

    if (interactive) {
      node.on("click", (_event, d) => navigate(d.pmid));
      node.call(
        d3Drag<SVGGElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            if (!d.isFocal) { d.fx = d.x; d.fy = d.y; }
          })
          .on("drag", (event, d) => {
            if (!d.isFocal) { d.fx = event.x; d.fy = event.y; }
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            if (!d.isFocal) { d.fx = null; d.fy = null; }
          })
      );
    }

    node.append("circle")
      .attr("r", (d) => d.isFocal ? 28 : 18)
      .attr("fill", (d) => d.journal_color)
      .attr("stroke", (d) => d.isFocal ? "#1F2937" : "white")
      .attr("stroke-width", (d) => d.isFocal ? 3 : 2)
      .attr("opacity", 0.9);

    node.append("text")
      .text((d) => d.journal_abbreviation)
      .attr("text-anchor", "middle").attr("dy", "0.35em")
      .attr("fill", "white").attr("font-size", (d) => d.isFocal ? "9px" : "7px")
      .attr("font-weight", "bold")
      .style("pointer-events", "none");

    // Title labels below nodes
    node.append("text")
      .text((d) => d.title.length > 30 ? d.title.slice(0, 27) + "..." : d.title)
      .attr("text-anchor", "middle").attr("dy", (d) => d.isFocal ? 42 : 30)
      .attr("fill", "currentColor").attr("font-size", "10px")
      .style("pointer-events", "none")
      .attr("class", "text-gray-700 dark:text-gray-300");

    // Tooltip on node hover
    if (interactive) {
      node.on("mouseenter", function (event, d) {
        tooltip.style("opacity", 1)
          .style("left", event.pageX + 12 + "px")
          .style("top", event.pageY - 12 + "px")
          .text(`${d.title}\n${d.journal_abbreviation}`);
      }).on("mouseleave", () => tooltip.style("opacity", 0));
    }

    // Tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x!)
        .attr("y1", (d) => (d.source as GraphNode).y!)
        .attr("x2", (d) => (d.target as GraphNode).x!)
        .attr("y2", (d) => (d.target as GraphNode).y!);
      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => { simulation.stop(); };
  }, [focal, nodes, edges, width, height, interactive, navigate]);

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="rounded-xl bg-gray-50 dark:bg-gray-900/50"
      />
      <div
        ref={tooltipRef}
        className="pointer-events-none fixed z-[100] max-w-xs whitespace-pre-wrap rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg opacity-0 transition-opacity dark:bg-gray-700"
      />
    </div>
  );
}
