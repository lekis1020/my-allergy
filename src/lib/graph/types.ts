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

// ── DB-wide redesign types (added 2026-06-01) ─────────────────────────

export interface PaperNode {
  pmid: string;
  title: string;
  publication_date: string;
  citation_count: number;
  journal_abbreviation: string;
  journal_color: string;
  topic_tags: string[];
  primary_topic: string; // topic_tags[0] or 'others'
}

export type EdgeType = "citation" | "coauthor" | "mention" | "topic";

export interface PaperEdge {
  source: string; // pmid (lexicographically smaller)
  target: string; // pmid
  types: EdgeType[];
  weight: number;
}

export interface TopicSnapshot {
  slug: string;
  nodes: PaperNode[];
  edges: PaperEdge[];
  truncated: { total: number; dropped: number };
}

export interface GalaxyNode {
  topic_slug: string;
  topic_label: string;
  topic_color: string;
  paper_count: number;
  recent_paper_count: number;
}

export interface GalaxyEdge {
  source: string; // topic_slug
  target: string; // topic_slug
  weight: number;
  paper_pair_count: number;
}

export interface GalaxySnapshot {
  nodes: GalaxyNode[];
  edges: GalaxyEdge[];
}
