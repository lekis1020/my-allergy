import { classifyPaperTopics, TOPIC_META } from "@/lib/utils/topic-tags";
import { normalizeAuthor } from "./normalize-author";
import type { TopicTag } from "@/types/filters";
import type {
  PaperNode,
  EdgeType,
  PaperEdge,
  TopicSnapshot,
  GalaxyNode,
  GalaxyEdge,
  GalaxySnapshot,
} from "./types";

// ── Weights ────────────────────────────────────────────────────────────
export const W_CITATION = 3.0;
export const W_COAUTHOR = 2.0;
export const W_MENTION = 1.5;
export const W_SIMILARITY = 1.5;
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
export interface SourceSimilarity {
  source_pmid: string;
  target_pmid: string;
  similarity: number; // 0..1, cosine similarity
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
  similarities?: SourceSimilarity[];
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

// ── Main entry point ───────────────────────────────────────────────────
export function buildGraphSnapshots(src: SourceData): Snapshots {
  const paperById = buildNodes(src);
  const edges = new Map<string, EdgeAcc>();
  applyCitations(edges, src, paperById);
  applyMentions(edges, src, paperById);
  applyCoauthors(edges, src, paperById);
  applySimilarities(edges, src, paperById);
  applyTopicReinforcement(edges, paperById);
  return finalize(paperById, edges, src);
}

function applySimilarities(
  edges: Map<string, EdgeAcc>,
  src: SourceData,
  papers: Map<string, PaperNode>
) {
  if (!src.similarities) return;
  for (const s of src.similarities) {
    if (s.source_pmid === s.target_pmid) continue;
    if (!papers.has(s.source_pmid) || !papers.has(s.target_pmid)) continue;
    const e = ensureEdge(edges, s.source_pmid, s.target_pmid);
    if (!e.types.has("similarity")) {
      e.types.add("similarity");
      // Scale by similarity strength: a barely-above-threshold pair gets
      // a small contribution; a 0.95-similarity pair gets close to full
      // W_SIMILARITY weight.
      e.weight += W_SIMILARITY * Math.max(0, s.similarity);
    }
  }
}

function ensureEdge(
  edges: Map<string, EdgeAcc>,
  a: string,
  b: string
): EdgeAcc {
  const [s, t] = a < b ? [a, b] : [b, a];
  const key = `${s}|${t}`;
  let e = edges.get(key);
  if (!e) {
    e = { source: s, target: t, types: new Set(), weight: 0 };
    edges.set(key, e);
  }
  return e;
}

function applyCitations(
  edges: Map<string, EdgeAcc>,
  src: SourceData,
  papers: Map<string, PaperNode>
) {
  for (const c of src.citations) {
    if (c.source_pmid === c.target_pmid) continue;
    if (!papers.has(c.source_pmid) || !papers.has(c.target_pmid)) continue;
    const e = ensureEdge(edges, c.source_pmid, c.target_pmid);
    if (!e.types.has("citation")) {
      e.types.add("citation");
      e.weight += W_CITATION;
    }
  }
}

function applyMentions(
  edges: Map<string, EdgeAcc>,
  src: SourceData,
  papers: Map<string, PaperNode>
) {
  for (const m of src.mentions) {
    if (m.source_pmid === m.mentioned_pmid) continue;
    if (!papers.has(m.source_pmid) || !papers.has(m.mentioned_pmid)) continue;
    const e = ensureEdge(edges, m.source_pmid, m.mentioned_pmid);
    if (!e.types.has("mention")) {
      e.types.add("mention");
      e.weight += W_MENTION;
    }
  }
}

function applyCoauthors(
  edges: Map<string, EdgeAcc>,
  src: SourceData,
  papers: Map<string, PaperNode>
) {
  // Build author-key → pmids[] index using only first or last position rows.
  const pmidsByKey = new Map<string, string[]>();
  for (const a of src.authors) {
    if (!papers.has(a.pmid)) continue;
    if (a.position !== 1 && !a.is_last) continue;
    const key = normalizeAuthor(a.last_name, a.first_name, a.initials);
    if (!key) continue;
    let arr = pmidsByKey.get(key);
    if (!arr) {
      arr = [];
      pmidsByKey.set(key, arr);
    }
    arr.push(a.pmid);
  }

  // Build edges for each shared-author cohort, skipping the common-name
  // flood and de-duplicating per pair.
  for (const pmids of pmidsByKey.values()) {
    if (pmids.length < 2) continue;
    if (pmids.length > COMMON_NAME_GUARD) continue;
    // Dedup in case the same author appears as both first AND last on a single paper.
    const unique = [...new Set(pmids)];
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const e = ensureEdge(edges, unique[i], unique[j]);
        if (!e.types.has("coauthor")) {
          e.types.add("coauthor");
          e.weight += W_COAUTHOR;
        }
      }
    }
  }
}

function applyTopicReinforcement(
  edges: Map<string, EdgeAcc>,
  papers: Map<string, PaperNode>
) {
  for (const e of edges.values()) {
    const a = papers.get(e.source);
    const b = papers.get(e.target);
    if (!a || !b) continue;
    const setA = new Set(a.topic_tags);
    let overlap = 0;
    for (const t of b.topic_tags) if (setA.has(t)) overlap += 1;
    if (overlap > 0) {
      e.types.add("topic");
      e.weight += W_TOPIC * overlap;
    }
  }
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

function finalize(
  paperById: Map<string, PaperNode>,
  edges: Map<string, EdgeAcc>,
  src: SourceData
): Snapshots {
  // ── Degree map ───────────────────────────────────────────────────
  const degree = new Map<string, number>();
  for (const e of edges.values()) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }

  // ── Per-topic subgraphs ──────────────────────────────────────────
  const allPapersByTopic = new Map<string, PaperNode[]>();
  for (const node of paperById.values()) {
    let arr = allPapersByTopic.get(node.primary_topic);
    if (!arr) {
      arr = [];
      allPapersByTopic.set(node.primary_topic, arr);
    }
    arr.push(node);
  }

  const topics = new Map<string, TopicSnapshot>();
  for (const [slug, candidates] of allPapersByTopic) {
    const sorted = [...candidates].sort((a, b) => {
      const da = degree.get(a.pmid) ?? 0;
      const db = degree.get(b.pmid) ?? 0;
      if (db !== da) return db - da;
      if (b.citation_count !== a.citation_count) return b.citation_count - a.citation_count;
      return b.publication_date.localeCompare(a.publication_date);
    });
    const top = sorted.slice(0, PER_TOPIC_CAP);
    const included = new Set(top.map((p) => p.pmid));
    const induced: PaperEdge[] = [];
    for (const e of edges.values()) {
      if (!included.has(e.source) || !included.has(e.target)) continue;
      const a = paperById.get(e.source)!;
      const b = paperById.get(e.target)!;
      if (a.primary_topic !== slug || b.primary_topic !== slug) continue;
      induced.push({
        source: e.source,
        target: e.target,
        types: [...e.types],
        weight: e.weight,
      });
    }
    topics.set(slug, {
      slug,
      nodes: top,
      edges: induced,
      truncated: {
        total: candidates.length,
        dropped: Math.max(0, candidates.length - top.length),
      },
    });
  }

  // ── Galaxy aggregation ───────────────────────────────────────────
  const galaxyNodes: GalaxyNode[] = [];
  for (const [slug, papers] of allPapersByTopic) {
    galaxyNodes.push({
      topic_slug: slug,
      topic_label: TOPIC_META[slug as TopicTag]?.label ?? slug,
      topic_color: pickTopicColor(slug as TopicTag),
      paper_count: papers.length,
      recent_paper_count: papers.filter((p) =>
        isWithinDays(p.publication_date, RECENT_WINDOW_DAYS, src)
      ).length,
    });
  }

  const galaxyEdgeAcc = new Map<string, GalaxyEdge>();
  for (const e of edges.values()) {
    const a = paperById.get(e.source);
    const b = paperById.get(e.target);
    if (!a || !b) continue;
    if (a.primary_topic === b.primary_topic) continue;
    const [s, t] = a.primary_topic < b.primary_topic
      ? [a.primary_topic, b.primary_topic]
      : [b.primary_topic, a.primary_topic];
    const key = `${s}|${t}`;
    const cur = galaxyEdgeAcc.get(key) ?? { source: s, target: t, weight: 0, paper_pair_count: 0 };
    cur.weight += e.weight;
    cur.paper_pair_count += 1;
    galaxyEdgeAcc.set(key, cur);
  }

  return {
    galaxy: { nodes: galaxyNodes, edges: [...galaxyEdgeAcc.values()] },
    topics,
  };
}

// TOPIC_META gives label/className but not a hex color. We derive a hex from
// the className's color word (e.g. "text-red-500" → #EF4444). The mapping
// matches Tailwind's default palette and is intentionally small — Phase 2
// can move this to topics.ts if more colors are needed.
function pickTopicColor(slug: TopicTag): string {
  const className = TOPIC_META[slug]?.className ?? "";
  const tones: Record<string, string> = {
    red: "#EF4444",
    amber: "#F59E0B",
    pink: "#EC4899",
    fuchsia: "#D946EF",
    yellow: "#EAB308",
    lime: "#84CC16",
    emerald: "#10B981",
    teal: "#14B8A6",
    cyan: "#06B6D4",
    sky: "#0EA5E9",
    blue: "#3B82F6",
    indigo: "#6366F1",
    violet: "#8B5CF6",
    purple: "#A855F7",
    rose: "#F43F5E",
    orange: "#F97316",
    gray: "#6B7280",
  };
  for (const [tone, hex] of Object.entries(tones)) {
    if (className.includes(`text-${tone}-`)) return hex;
    if (className.includes(`bg-${tone}-`)) return hex;
  }
  return "#6B7280";
}

function isWithinDays(dateStr: string, days: number, _src: SourceData): boolean {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const now = Date.now();
  return now - d.getTime() <= days * 24 * 60 * 60 * 1000;
}
