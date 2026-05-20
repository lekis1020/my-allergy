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
 *
 * On each edge, `source` is the lexicographically smaller pmid of the pair and
 * `target` the larger; original citation direction is intentionally not preserved.
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

  return { edges, connectedPmids: [...connected].sort() };
}
