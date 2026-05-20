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
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full rounded-xl bg-gray-50 dark:bg-gray-900/50"
      />
      <div
        ref={tooltipRef}
        className="pointer-events-none fixed z-[100] max-w-xs whitespace-pre-wrap rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg opacity-0 transition-opacity dark:bg-gray-700"
      />
    </div>
  );
}
