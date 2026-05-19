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
