import { classifyPaperTopics } from "@/lib/utils/topic-tags";
import type { TopicTag } from "@/types/filters";
import type {
  PaperNode,
  EdgeType,
  TopicSnapshot,
  GalaxySnapshot,
} from "./types";

// ── Weights ────────────────────────────────────────────────────────────
export const W_CITATION = 3.0;
export const W_COAUTHOR = 2.0;
export const W_MENTION = 1.5;
export const W_TOPIC = 1.0;

// ── Caps ───────────────────────────────────────────────────────────────
export const PER_TOPIC_CAP = 80;
export const COMMON_NAME_GUARD = 200;
export const RECENT_WINDOW_DAYS = 90;

// ── Source row shapes ──────────────────────────────────────────────────
export interface SourcePaper {
  pmid: string;
  title: string;
  abstract: string | null;
  publication_date: string;
  epub_date: string | null;
  citation_count: number | null;
  journal_id: string;
}
export interface SourceCitation {
  source_pmid: string;
  target_pmid: string;
}
/** Already joined to papers.pmid by the caller. */
export interface SourceAuthor {
  pmid: string;
  last_name: string;
  first_name: string | null;
  initials: string | null;
  position: number;
  is_last: boolean; // computed by the SQL aggregation in recompute-graph.ts
}
export interface SourceMention {
  source_pmid: string;
  mentioned_pmid: string;
}
export interface SourceJournal {
  id: string;
  abbreviation: string;
  color: string;
}
export interface SourceData {
  papers: SourcePaper[];
  citations: SourceCitation[];
  authors: SourceAuthor[];
  mentions: SourceMention[];
  journals: SourceJournal[];
}

export interface Snapshots {
  galaxy: GalaxySnapshot;
  topics: Map<string, TopicSnapshot>;
}

// Internal accumulator (not exported). `types` is a Set during build for O(1)
// dedupe; serialized to an array at the end.
interface EdgeAcc {
  source: string;
  target: string;
  types: Set<EdgeType>;
  weight: number;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _pairKey = (a: string, b: string) =>
  a < b ? `${a}|${b}` : `${b}|${a}`;

// ── Main entry point ───────────────────────────────────────────────────
export function buildGraphSnapshots(src: SourceData): Snapshots {
  const paperById = buildNodes(src);
  const edges = new Map<string, EdgeAcc>();
  // Tasks 6–8 layer additional passes here.
  return finalize(paperById, edges, src);
}

function buildNodes(src: SourceData): Map<string, PaperNode> {
  const journalById = new Map(src.journals.map((j) => [j.id, j]));
  const out = new Map<string, PaperNode>();

  for (const p of src.papers) {
    const j = journalById.get(p.journal_id);
    const topics = classifyPaperTopics({
      title: p.title,
      abstract: p.abstract,
      keywords: [],
      meshTerms: [],
    });
    out.set(p.pmid, {
      pmid: p.pmid,
      title: p.title,
      publication_date: p.publication_date,
      citation_count: p.citation_count ?? 0,
      journal_abbreviation: j?.abbreviation ?? "?",
      journal_color: j?.color ?? "#999999",
      topic_tags: topics,
      primary_topic: topics[0] ?? "others",
    });
  }

  return out;
}

// Placeholder — Task 8 replaces with the real implementation.
function finalize(
  paperById: Map<string, PaperNode>,
  _edges: Map<string, EdgeAcc>,
  _src: SourceData
): Snapshots {
  const topics = new Map<string, TopicSnapshot>();
  for (const [pmid, node] of paperById) {
    const slug = node.primary_topic;
    let snap = topics.get(slug);
    if (!snap) {
      snap = { slug, nodes: [], edges: [], truncated: { total: 0, dropped: 0 } };
      topics.set(slug, snap);
    }
    snap.nodes.push(node);
    snap.truncated.total += 1;
    void pmid;
  }
  return {
    galaxy: { nodes: [], edges: [] },
    topics,
  };
}

// Ensure TopicTag is used (needed for classifyPaperTopics return type awareness).
void (null as unknown as TopicTag);
