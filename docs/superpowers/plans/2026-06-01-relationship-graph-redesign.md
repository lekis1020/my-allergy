# Relationship Graph Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Timeline tab's 90-day relationship graph with a DB-wide, topic-clustered, multi-level relationship map computed daily by an Inngest cron.

**Architecture:** Inngest cron writes per-topic and galaxy snapshots into `paper_graph_snapshots`. Two read-only API endpoints serve those snapshots with 5-minute CDN cache. The home Timeline panel renders the snapshots in a `galaxy → topic → highlight` state machine on top of the existing D3 force-graph primitive. Spec: `docs/superpowers/specs/2026-06-01-relationship-graph-redesign-design.md`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (PostgreSQL + RLS), Inngest (cron + event triggers), D3 v7 (force layout), Tailwind v4, SWR, Vitest.

---

## Spec deviations (lock-in before coding)

The spec was written before the implementer verified `paper_authors`. The deviations below override the spec:

1. **No `is_last_author` column.** `paper_authors` already has `position INTEGER` (1 = first). Last author per paper is `MAX(position) GROUP BY paper_id`. There is no need for `00043_add_paper_authors_last_author.sql`. The plan uses position-based extraction.
2. **`paper_authors.paper_id` is UUID** (FK to `papers.id`), not `pmid`. The cron must join `paper_authors → papers` to get pmid before building edges.
3. **Author name fields** are `last_name`, `first_name`, `initials` (no `full_name`). The plan normalizes `${last_name}|${first_name?[0]}` for matching.
4. **Topic utility** is `classifyPaperTopics(signals)` taking `{ title, abstract, keywords, meshTerms }`. We synthesize empty arrays for keywords/meshTerms since the cron does not have those columns readily — title+abstract is enough for snapshot purposes (the same classification path already powers the home sidebar).
5. **Inngest functions** live in one file `src/lib/inngest/functions.ts` per existing convention. We add the new function in a separate module `src/lib/inngest/recompute-graph.ts` and re-export from `functions.ts`. The serve handler in `src/app/api/inngest/route.ts` adds the new export to the `functions` array.
6. **Admin guard** uses the existing pattern: `createServerAuthClient().auth.getSession()` + `isAdmin(session.user.email)`. No new auth helper.

These deviations are committed in Task 1 as a spec amendment so the spec stays the source of truth.

---

## File map

### Backend (Phase 1)

| Path | Action | Responsibility |
|---|---|---|
| `docs/superpowers/specs/2026-06-01-relationship-graph-redesign-design.md` | Modify | Spec amendment (Task 1) |
| `supabase/migrations/00042_paper_graph_snapshots.sql` | Create | Snapshot table + RLS |
| `src/lib/graph/types.ts` | Modify | Add `PaperNode`, `EdgeType`, `PaperEdge`, `TopicSnapshot`, `GalaxyNode`, `GalaxyEdge`, `GalaxySnapshot` |
| `src/lib/graph/normalize-author.ts` | Create | Pure normalization function for author name matching |
| `src/lib/graph/normalize-author.test.ts` | Create | Unit tests |
| `src/lib/graph/build-snapshots.ts` | Create | Pure builder: source rows → snapshots |
| `src/lib/graph/build-snapshots.test.ts` | Create | Unit tests for builder |
| `src/lib/inngest/recompute-graph.ts` | Create | Inngest function (fetch → build → write) |
| `src/lib/inngest/functions.ts` | Modify | Re-export `recomputeGraphFn` |
| `src/app/api/inngest/route.ts` | Modify | Add `recomputeGraphFn` to serve handler |
| `src/app/api/graph/galaxy/route.ts` | Create | GET — read galaxy snapshot |
| `src/app/api/graph/topic/[slug]/route.ts` | Create | GET — read per-topic snapshot |
| `src/app/api/admin/recompute-graph/route.ts` | Create | POST — admin-guarded Inngest trigger |

### Frontend (Phase 2)

| Path | Action | Responsibility |
|---|---|---|
| `docs/mockups/relationship-graph/galaxy.html` | Create | Static visual for galaxy state |
| `docs/mockups/relationship-graph/topic.html` | Create | Static visual for topic state |
| `docs/mockups/relationship-graph/highlight.html` | Create | Static visual for highlight state |
| `src/components/graph/relationship-graph.tsx` | Modify | Add `nodeRadius`, `edgeStyle`, `focusedPmid`, `onSelectNode` props |
| `src/hooks/use-graph-view.ts` | Create | View state + URL sync via `useSearchParams` |
| `src/hooks/use-graph-view.test.ts` | Create | Unit tests for transitions |
| `src/components/papers/detail-sheet.tsx` | Create | Focused-paper side sheet with neighbors and `Open` button |
| `src/components/papers/relationship-graph-panel.tsx` | Modify (rewrite) | State machine, two-endpoint fetch, mobile CTA |
| `src/app/api/connections/recent/route.ts` | Delete | Superseded by `/api/graph/topic/*` |
| `src/lib/graph/induced-subgraph.ts` | Delete | Was only used by the deleted route |
| `src/lib/graph/__tests__/induced-subgraph.test.ts` | Delete | Was only used by the deleted route |

### Phase 3

| Path | Action | Responsibility |
|---|---|---|
| `src/lib/inngest/recompute-graph.ts` | Modify | Add cron schedule alongside event trigger |

---

## TDD note for the implementer

Every code task below is **test first**. Run the test, see it fail, then write the implementation. The Vitest config is at `vitest.config.ts` — globals on, `@/` resolves to `src/`. Tests live next to the implementation (per existing pattern, e.g. `src/lib/utils/__tests__/topic-tags.test.ts`). For new files in `src/lib/graph/`, put tests at `src/lib/graph/__tests__/<name>.test.ts` to match the convention.

Migration/SQL and API-route tasks have no pre-existing harness for execution-time integration tests. Where appropriate the plan adds **shape tests** (verifying types and the response envelope) using fetch-mocked Vitest tests; full execution is verified by manual QA on the preview deploy in Phase 2 wrap-up.

---

# Phase 0 — Verification & spec patch

### Task 1: Patch the spec with verified deviations

**Files:**
- Modify: `docs/superpowers/specs/2026-06-01-relationship-graph-redesign-design.md`

- [ ] **Step 1: Open the spec and insert an Amendments section right after §3 (Non-goals).** Use this exact content:

```markdown
## 3a. Amendments after schema verification (2026-06-01)

The following deviations from the original spec were locked in after verifying
the live schema. They override the corresponding paragraphs below.

- **No `is_last_author` migration.** `paper_authors` has `position INTEGER`
  (1 = first). Last author per paper is `MAX(position) GROUP BY paper_id`,
  read via SQL aggregation in the cron. Section 7.4 ("Verification required
  before implementation") and the 00043 migration described there are
  withdrawn.
- **`paper_authors` key.** The table FKs to `papers.id` (UUID) via `paper_id`,
  not directly to `pmid`. The cron joins `paper_authors → papers` to obtain
  pmid before building edges.
- **Author name fields** are `last_name`, `first_name`, `initials` (no
  `full_name`). Normalization key is `${last_name}|${first_initial}`.
- **Topic utility entry point** is `classifyPaperTopics(signals)` from
  `src/lib/utils/topic-tags.ts`, taking `{ title, abstract, keywords,
  meshTerms }`. The cron passes `keywords: []` and `meshTerms: []` because
  those columns are not part of the cron's fetch set; title+abstract is the
  same classification path the home sidebar already relies on.
- **Inngest layout.** Functions live in `src/lib/inngest/functions.ts`. The
  new function is implemented in `src/lib/inngest/recompute-graph.ts` and
  re-exported from `functions.ts`. Serve handler is at
  `src/app/api/inngest/route.ts`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-06-01-relationship-graph-redesign-design.md
git commit -m "docs(spec): amend relationship graph spec for verified paper_authors schema"
```

---

# Phase 1 — Backend

### Task 2: Migration — `paper_graph_snapshots` table

**Files:**
- Create: `supabase/migrations/00042_paper_graph_snapshots.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Stores precomputed relationship-graph snapshots for the home Timeline panel.
-- One row per scope: 'galaxy' (top-level topic-cluster view) or
-- 'topic:<slug>' (per-topic paper subgraph, capped at 80 nodes).
--
-- The payload is opaque JSONB so the cron can evolve the schema (e.g. add a
-- Phase 2 `communities` array) without a schema migration.
--
-- Reads are public (anon SELECT). Writes are via the service role only and
-- are not exposed by any RLS policy.
CREATE TABLE IF NOT EXISTS paper_graph_snapshots (
  scope TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  node_count INT NOT NULL,
  edge_count INT NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE paper_graph_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_paper_graph_snapshots"
  ON paper_graph_snapshots FOR SELECT TO anon
  USING (true);

CREATE POLICY "authenticated_read_paper_graph_snapshots"
  ON paper_graph_snapshots FOR SELECT TO authenticated
  USING (true);
```

- [ ] **Step 2: Apply locally**

Run: `supabase db reset` (or `supabase migration up` if the local stack stays running). Expected output ends with `Applied migration: 00042_paper_graph_snapshots`.

- [ ] **Step 3: Verify table is queryable from anon**

Run (psql):
```sql
SELECT * FROM paper_graph_snapshots;
```
Expected: 0 rows, no permission error.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00042_paper_graph_snapshots.sql
git commit -m "feat(graph): add paper_graph_snapshots table"
```

---

### Task 3: Extend graph types

**Files:**
- Modify: `src/lib/graph/types.ts`

- [ ] **Step 1: Add the new exports to the bottom of `src/lib/graph/types.ts`** (keep all existing exports, they are still used until Task 19 deletes them):

```ts
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 errors. (The new types are not yet referenced; they just need to parse.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/graph/types.ts
git commit -m "feat(graph): add DB-wide snapshot types"
```

---

### Task 4: Author name normalization

**Files:**
- Create: `src/lib/graph/normalize-author.ts`
- Create: `src/lib/graph/__tests__/normalize-author.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/graph/__tests__/normalize-author.test.ts
import { describe, it, expect } from "vitest";
import { normalizeAuthor } from "@/lib/graph/normalize-author";

describe("normalizeAuthor", () => {
  it("returns null for empty inputs", () => {
    expect(normalizeAuthor(null, null)).toBeNull();
    expect(normalizeAuthor("", "")).toBeNull();
  });

  it("uses last_name + first_initial when both present", () => {
    expect(normalizeAuthor("Smith", "John")).toBe("smith|j");
    expect(normalizeAuthor("Bousquet", "Jean")).toBe("bousquet|j");
  });

  it("uses last_name + initials when first_name missing", () => {
    expect(normalizeAuthor("Lee", null, "JK")).toBe("lee|j");
    expect(normalizeAuthor("Kim", "", "S")).toBe("kim|s");
  });

  it("falls back to last_name only when no first name or initials", () => {
    expect(normalizeAuthor("Singh", null, null)).toBe("singh|");
  });

  it("lowercases and trims punctuation", () => {
    expect(normalizeAuthor("  O'Connor ", "  Mary-Anne ")).toBe("o'connor|m");
    expect(normalizeAuthor("Smith.", "J.")).toBe("smith|j");
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/lib/graph/__tests__/normalize-author.test.ts`
Expected: FAIL — `Cannot find module '@/lib/graph/normalize-author'`.

- [ ] **Step 3: Implement**

```ts
// src/lib/graph/normalize-author.ts

/**
 * Normalize an author for cross-paper matching.
 *
 * Returns a stable key of the form `<last_name lowercased>|<first_initial>`
 * (or `<last_name>|` when no first-name signal exists). Two papers' authors
 * are considered "the same person" when their keys are equal.
 *
 * Using just the first initial is a deliberate trade-off: it merges "Smith J"
 * variants under one key without requiring a disambiguation pass. Common-name
 * collisions are dealt with downstream (see build-snapshots.ts: drop authors
 * whose key maps to > 200 papers).
 */
export function normalizeAuthor(
  lastName: string | null,
  firstName: string | null,
  initials: string | null = null
): string | null {
  const last = (lastName ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (!last) return null;

  const firstSource =
    (firstName ?? "").trim() || (initials ?? "").trim();
  const firstInitial = firstSource
    ? firstSource.replace(/[^a-zA-Z]/g, "").charAt(0).toLowerCase()
    : "";

  return `${last}|${firstInitial}`;
}
```

- [ ] **Step 4: Run and confirm pass**

Run: `npx vitest run src/lib/graph/__tests__/normalize-author.test.ts`
Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/graph/normalize-author.ts src/lib/graph/__tests__/normalize-author.test.ts
git commit -m "feat(graph): normalize-author util for coauthor edge matching"
```

---

### Task 5: Builder — source types and node-build skeleton

**Files:**
- Create: `src/lib/graph/build-snapshots.ts`
- Create: `src/lib/graph/__tests__/build-snapshots.test.ts`

> This task lands only the source row types, the constants, and the node-build step. Tasks 6–8 layer the edge passes on top of the same file. Keeping each pass on its own commit makes review and debugging tractable.

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/graph/__tests__/build-snapshots.test.ts
import { describe, it, expect } from "vitest";
import { buildGraphSnapshots, type SourceData } from "@/lib/graph/build-snapshots";

function emptySource(overrides: Partial<SourceData> = {}): SourceData {
  return {
    papers: [],
    citations: [],
    authors: [],
    mentions: [],
    journals: [],
    ...overrides,
  };
}

describe("buildGraphSnapshots — node build", () => {
  it("produces an empty galaxy and zero topics when there are no papers", () => {
    const out = buildGraphSnapshots(emptySource());
    expect(out.galaxy.nodes).toHaveLength(0);
    expect(out.galaxy.edges).toHaveLength(0);
    expect(out.topics.size).toBe(0);
  });

  it("assigns primary_topic from classifyPaperTopics on title+abstract", () => {
    const out = buildGraphSnapshots(emptySource({
      papers: [
        {
          pmid: "1",
          title: "Severe asthma management with biologics",
          abstract: "Asthma treatment review.",
          publication_date: "2025-01-01",
          epub_date: "2025-01-01",
          citation_count: 5,
          journal_id: "j1",
        },
      ],
      journals: [{ id: "j1", abbreviation: "JACI", color: "#123456" }],
    }));
    const asthma = out.topics.get("asthma");
    expect(asthma).toBeDefined();
    expect(asthma!.nodes[0].primary_topic).toBe("asthma");
    expect(asthma!.nodes[0].journal_abbreviation).toBe("JACI");
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/lib/graph/__tests__/build-snapshots.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the skeleton**

```ts
// src/lib/graph/build-snapshots.ts
import { classifyPaperTopics } from "@/lib/utils/topic-tags";
import type { TopicTag } from "@/types/filters";
import { TOPIC_META } from "@/lib/utils/topic-tags";
import { normalizeAuthor } from "./normalize-author";
import type {
  PaperNode,
  PaperEdge,
  EdgeType,
  TopicSnapshot,
  GalaxyNode,
  GalaxyEdge,
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

const pairKey = (a: string, b: string) =>
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
```

- [ ] **Step 4: Run and confirm pass**

Run: `npx vitest run src/lib/graph/__tests__/build-snapshots.test.ts`
Expected: both tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/graph/build-snapshots.ts src/lib/graph/__tests__/build-snapshots.test.ts
git commit -m "feat(graph): build-snapshots skeleton with node build"
```

---

### Task 6: Builder — citation and mention edges

**Files:**
- Modify: `src/lib/graph/build-snapshots.ts`
- Modify: `src/lib/graph/__tests__/build-snapshots.test.ts`

- [ ] **Step 1: Add failing tests at the bottom of the test file**

```ts
describe("buildGraphSnapshots — citation and mention edges", () => {
  function withTwoPapers(extra: Partial<SourceData> = {}) {
    return emptySource({
      papers: [
        { pmid: "A", title: "Asthma biologics", abstract: "asthma asthma", publication_date: "2025-01-01", epub_date: null, citation_count: 0, journal_id: "j1" },
        { pmid: "B", title: "Severe asthma trial", abstract: "asthma", publication_date: "2025-02-01", epub_date: null, citation_count: 0, journal_id: "j1" },
      ],
      journals: [{ id: "j1", abbreviation: "JACI", color: "#000000" }],
      ...extra,
    });
  }

  it("creates a citation edge with weight 3 between A and B", () => {
    const out = buildGraphSnapshots(withTwoPapers({ citations: [{ source_pmid: "A", target_pmid: "B" }] }));
    const asthma = out.topics.get("asthma")!;
    expect(asthma.edges).toHaveLength(1);
    expect(asthma.edges[0].types).toContain("citation");
    expect(asthma.edges[0].weight).toBeCloseTo(3 + 1, 5); // citation + topic reinforcement (Task 7)? No — only citation; topic added in Task 7.
  });

  it("creates a mention edge with weight 1.5", () => {
    const out = buildGraphSnapshots(withTwoPapers({ mentions: [{ source_pmid: "A", mentioned_pmid: "B" }] }));
    const asthma = out.topics.get("asthma")!;
    expect(asthma.edges).toHaveLength(1);
    expect(asthma.edges[0].types).toEqual(["mention"]);
    expect(asthma.edges[0].weight).toBeCloseTo(1.5, 5);
  });

  it("merges citation and mention on the same pair", () => {
    const out = buildGraphSnapshots(withTwoPapers({
      citations: [{ source_pmid: "A", target_pmid: "B" }],
      mentions: [{ source_pmid: "B", mentioned_pmid: "A" }],
    }));
    const e = out.topics.get("asthma")!.edges[0];
    expect(new Set(e.types)).toEqual(new Set(["citation", "mention"]));
    expect(e.weight).toBeCloseTo(3 + 1.5, 5);
  });

  it("ignores self-loops and unknown endpoints", () => {
    const out = buildGraphSnapshots(withTwoPapers({
      citations: [
        { source_pmid: "A", target_pmid: "A" },
        { source_pmid: "A", target_pmid: "Z" },
      ],
    }));
    expect(out.topics.get("asthma")!.edges).toHaveLength(0);
  });
});
```

The first test above has a deliberately wrong expectation for the weight (citation alone should produce 3.0; the topic reinforcement is added in Task 7). Fix the expected value in this task to `3.0` — the topic test will be added in Task 7.

```ts
// Replace the expected weight in the first citation test:
expect(asthma.edges[0].weight).toBeCloseTo(3, 5);
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/lib/graph/__tests__/build-snapshots.test.ts`
Expected: 4 new tests fail (no citation/mention passes yet).

- [ ] **Step 3: Implement the citation and mention passes inside `buildGraphSnapshots`**

Replace the body of `buildGraphSnapshots` with:

```ts
export function buildGraphSnapshots(src: SourceData): Snapshots {
  const paperById = buildNodes(src);
  const edges = new Map<string, EdgeAcc>();
  applyCitations(edges, src, paperById);
  applyMentions(edges, src, paperById);
  return finalize(paperById, edges, src);
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
```

Update `finalize` to attach the edges Map into the per-topic snapshots (still without cap / topic reinforcement / galaxy):

```ts
function finalize(
  paperById: Map<string, PaperNode>,
  edges: Map<string, EdgeAcc>,
  _src: SourceData
): Snapshots {
  const topics = new Map<string, TopicSnapshot>();

  for (const node of paperById.values()) {
    const slug = node.primary_topic;
    let snap = topics.get(slug);
    if (!snap) {
      snap = { slug, nodes: [], edges: [], truncated: { total: 0, dropped: 0 } };
      topics.set(slug, snap);
    }
    snap.nodes.push(node);
    snap.truncated.total += 1;
  }

  for (const e of edges.values()) {
    const a = paperById.get(e.source);
    const b = paperById.get(e.target);
    if (!a || !b) continue;
    if (a.primary_topic !== b.primary_topic) continue;
    const snap = topics.get(a.primary_topic);
    snap?.edges.push({
      source: e.source,
      target: e.target,
      types: [...e.types],
      weight: e.weight,
    });
  }

  return {
    galaxy: { nodes: [], edges: [] },
    topics,
  };
}
```

- [ ] **Step 4: Run and confirm pass**

Run: `npx vitest run src/lib/graph/__tests__/build-snapshots.test.ts`
Expected: all tests pass (6 total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/graph/build-snapshots.ts src/lib/graph/__tests__/build-snapshots.test.ts
git commit -m "feat(graph): citation and mention edge passes"
```

---

### Task 7: Builder — coauthor pass + topic reinforcement + common-name guard

**Files:**
- Modify: `src/lib/graph/build-snapshots.ts`
- Modify: `src/lib/graph/__tests__/build-snapshots.test.ts`

- [ ] **Step 1: Add failing tests**

```ts
describe("buildGraphSnapshots — coauthor pass", () => {
  it("links two papers that share first author", () => {
    const out = buildGraphSnapshots(emptySource({
      papers: [
        { pmid: "A", title: "Asthma study", abstract: "asthma", publication_date: "2025-01-01", epub_date: null, citation_count: 0, journal_id: "j1" },
        { pmid: "B", title: "Asthma cohort", abstract: "asthma", publication_date: "2025-02-01", epub_date: null, citation_count: 0, journal_id: "j1" },
      ],
      authors: [
        { pmid: "A", last_name: "Kim", first_name: "Soo", initials: null, position: 1, is_last: false },
        { pmid: "A", last_name: "Park", first_name: "Min", initials: null, position: 5, is_last: true },
        { pmid: "B", last_name: "Kim", first_name: "Soo", initials: null, position: 1, is_last: false },
        { pmid: "B", last_name: "Lee", first_name: "J", initials: null, position: 4, is_last: true },
      ],
      journals: [{ id: "j1", abbreviation: "JACI", color: "#000" }],
    }));
    const asthma = out.topics.get("asthma")!;
    expect(asthma.edges).toHaveLength(1);
    expect(asthma.edges[0].types).toContain("coauthor");
    expect(asthma.edges[0].weight).toBeCloseTo(2 + 1, 5); // coauthor + topic reinforcement
  });

  it("links two papers across first ↔ last author position", () => {
    const out = buildGraphSnapshots(emptySource({
      papers: [
        { pmid: "A", title: "Asthma 1", abstract: "asthma", publication_date: "2025-01-01", epub_date: null, citation_count: 0, journal_id: "j1" },
        { pmid: "B", title: "Asthma 2", abstract: "asthma", publication_date: "2025-02-01", epub_date: null, citation_count: 0, journal_id: "j1" },
      ],
      authors: [
        { pmid: "A", last_name: "Park", first_name: "M", initials: null, position: 1, is_last: false },
        { pmid: "B", last_name: "Park", first_name: "M", initials: null, position: 6, is_last: true },
      ],
      journals: [{ id: "j1", abbreviation: "JACI", color: "#000" }],
    }));
    const e = out.topics.get("asthma")!.edges[0];
    expect(e.types).toContain("coauthor");
  });

  it("drops authors above the common-name guard", () => {
    const papers = Array.from({ length: 250 }, (_, i) => ({
      pmid: `p${i}`, title: "Asthma", abstract: "asthma", publication_date: "2025-01-01", epub_date: null, citation_count: 0, journal_id: "j1",
    }));
    const authors = papers.map((p) => ({
      pmid: p.pmid, last_name: "Smith", first_name: "J", initials: null, position: 1, is_last: false,
    }));
    const out = buildGraphSnapshots(emptySource({
      papers, authors, journals: [{ id: "j1", abbreviation: "JACI", color: "#000" }],
    }));
    // No coauthor edges should be created because "smith|j" exceeds the guard.
    const totalEdges = [...out.topics.values()].reduce((n, t) => n + t.edges.length, 0);
    expect(totalEdges).toBe(0);
  });
});

describe("buildGraphSnapshots — topic reinforcement", () => {
  it("adds 'topic' to types and 1.0 per shared topic, only on existing edges", () => {
    const out = buildGraphSnapshots(emptySource({
      papers: [
        { pmid: "A", title: "Severe asthma in urticaria patients", abstract: "asthma urticaria", publication_date: "2025-01-01", epub_date: null, citation_count: 0, journal_id: "j1" },
        { pmid: "B", title: "Asthma trial", abstract: "asthma", publication_date: "2025-02-01", epub_date: null, citation_count: 0, journal_id: "j1" },
      ],
      citations: [{ source_pmid: "A", target_pmid: "B" }],
      journals: [{ id: "j1", abbreviation: "JACI", color: "#000" }],
    }));
    const edges = [...out.topics.values()].flatMap((t) => t.edges);
    expect(edges).toHaveLength(1);
    expect(new Set(edges[0].types)).toEqual(new Set(["citation", "topic"]));
    expect(edges[0].weight).toBeGreaterThanOrEqual(3 + 1);
  });

  it("does not create topic-only edges", () => {
    const out = buildGraphSnapshots(emptySource({
      papers: [
        { pmid: "A", title: "Asthma", abstract: "asthma", publication_date: "2025-01-01", epub_date: null, citation_count: 0, journal_id: "j1" },
        { pmid: "B", title: "Asthma", abstract: "asthma", publication_date: "2025-02-01", epub_date: null, citation_count: 0, journal_id: "j1" },
      ],
      journals: [{ id: "j1", abbreviation: "JACI", color: "#000" }],
    }));
    const edges = [...out.topics.values()].flatMap((t) => t.edges);
    expect(edges).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/lib/graph/__tests__/build-snapshots.test.ts`
Expected: 5 new tests fail.

- [ ] **Step 3: Add the coauthor and topic-reinforcement passes**

Insert these functions in `build-snapshots.ts`:

```ts
function applyCoauthors(
  edges: Map<string, EdgeAcc>,
  src: SourceData,
  papers: Map<string, PaperNode>
) {
  // 1. Build author-key → pmids[] index, but only using first or last
  //    position rows (the caller filters; we trust the contract).
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

  // 2. Build edges for each shared-author cohort, skipping the common-name
  //    flood and de-duplicating per pair.
  for (const pmids of pmidsByKey.values()) {
    if (pmids.length < 2) continue;
    if (pmids.length > COMMON_NAME_GUARD) continue;
    // Dedup the pmids in case the same author appears as both first AND last
    // on a single paper (rare but possible).
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
```

Wire them into `buildGraphSnapshots`:

```ts
export function buildGraphSnapshots(src: SourceData): Snapshots {
  const paperById = buildNodes(src);
  const edges = new Map<string, EdgeAcc>();
  applyCitations(edges, src, paperById);
  applyMentions(edges, src, paperById);
  applyCoauthors(edges, src, paperById);
  applyTopicReinforcement(edges, paperById);
  return finalize(paperById, edges, src);
}
```

- [ ] **Step 4: Run and confirm pass**

Run: `npx vitest run src/lib/graph/__tests__/build-snapshots.test.ts`
Expected: all tests pass (11 total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/graph/build-snapshots.ts src/lib/graph/__tests__/build-snapshots.test.ts
git commit -m "feat(graph): coauthor pass + topic reinforcement + common-name guard"
```

---

### Task 8: Builder — per-topic cap + galaxy aggregation

**Files:**
- Modify: `src/lib/graph/build-snapshots.ts`
- Modify: `src/lib/graph/__tests__/build-snapshots.test.ts`

- [ ] **Step 1: Add failing tests**

```ts
describe("buildGraphSnapshots — per-topic cap", () => {
  it("caps a topic at PER_TOPIC_CAP nodes by (degree desc, citation desc)", () => {
    // 100 papers all tagged asthma; pmids that have citations should win.
    const papers = Array.from({ length: 100 }, (_, i) => ({
      pmid: `p${i}`,
      title: "Asthma",
      abstract: "asthma asthma",
      publication_date: `2024-01-${(i % 28) + 1}`,
      epub_date: null,
      citation_count: i, // higher i → higher tiebreaker
      journal_id: "j1",
    }));
    // Give p99 a single citation edge so it has degree 1.
    const citations = [{ source_pmid: "p99", target_pmid: "p98" }];
    const out = buildGraphSnapshots(emptySource({
      papers,
      citations,
      journals: [{ id: "j1", abbreviation: "JACI", color: "#000" }],
    }));
    const asthma = out.topics.get("asthma")!;
    expect(asthma.nodes.length).toBe(80);
    expect(asthma.truncated.total).toBe(100);
    expect(asthma.truncated.dropped).toBe(20);
    // p99 and p98 (degree 1) should be in the slice.
    const pmids = asthma.nodes.map((n) => n.pmid);
    expect(pmids).toContain("p99");
    expect(pmids).toContain("p98");
    // Edges should only include endpoints in the slice.
    for (const e of asthma.edges) {
      expect(pmids).toContain(e.source);
      expect(pmids).toContain(e.target);
    }
  });
});

describe("buildGraphSnapshots — galaxy aggregation", () => {
  it("aggregates cross-topic edges into galaxy edges with summed weights", () => {
    const out = buildGraphSnapshots(emptySource({
      papers: [
        { pmid: "A", title: "Asthma study", abstract: "asthma", publication_date: "2025-01-01", epub_date: null, citation_count: 0, journal_id: "j1" },
        { pmid: "B", title: "Urticaria study", abstract: "urticaria", publication_date: "2025-02-01", epub_date: null, citation_count: 0, journal_id: "j1" },
      ],
      citations: [{ source_pmid: "A", target_pmid: "B" }],
      journals: [{ id: "j1", abbreviation: "JACI", color: "#000" }],
    }));
    expect(out.galaxy.nodes.find((n) => n.topic_slug === "asthma")?.paper_count).toBe(1);
    expect(out.galaxy.nodes.find((n) => n.topic_slug === "urticaria")?.paper_count).toBe(1);
    const cross = out.galaxy.edges.find(
      (e) =>
        (e.source === "asthma" && e.target === "urticaria") ||
        (e.source === "urticaria" && e.target === "asthma")
    );
    expect(cross).toBeDefined();
    expect(cross!.weight).toBeCloseTo(3, 5);
    expect(cross!.paper_pair_count).toBe(1);
  });

  it("does not include same-topic edges in the galaxy", () => {
    const out = buildGraphSnapshots(emptySource({
      papers: [
        { pmid: "A", title: "Asthma 1", abstract: "asthma", publication_date: "2025-01-01", epub_date: null, citation_count: 0, journal_id: "j1" },
        { pmid: "B", title: "Asthma 2", abstract: "asthma", publication_date: "2025-02-01", epub_date: null, citation_count: 0, journal_id: "j1" },
      ],
      citations: [{ source_pmid: "A", target_pmid: "B" }],
      journals: [{ id: "j1", abbreviation: "JACI", color: "#000" }],
    }));
    expect(out.galaxy.edges).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/lib/graph/__tests__/build-snapshots.test.ts`
Expected: 3 new tests fail.

- [ ] **Step 3: Replace `finalize` with the full implementation**

```ts
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
```

- [ ] **Step 4: Run and confirm pass**

Run: `npx vitest run src/lib/graph/__tests__/build-snapshots.test.ts`
Expected: all tests pass (14 total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/graph/build-snapshots.ts src/lib/graph/__tests__/build-snapshots.test.ts
git commit -m "feat(graph): per-topic cap + galaxy aggregation"
```

---

### Task 9: Inngest function — fetch + build + write

**Files:**
- Create: `src/lib/inngest/recompute-graph.ts`
- Modify: `src/lib/inngest/functions.ts`
- Modify: `src/app/api/inngest/route.ts`

- [ ] **Step 1: Write the function**

```ts
// src/lib/inngest/recompute-graph.ts
import { inngest } from "./client";
import { createServiceClient } from "@/lib/supabase/server";
import {
  buildGraphSnapshots,
  type SourceData,
  type SourceAuthor,
} from "@/lib/graph/build-snapshots";

/**
 * Recomputes the DB-wide relationship-graph snapshots.
 *
 * Phase 1 ships with an event-only trigger so the operator can run it
 * controlled before flipping on the daily cron in Phase 3. The cron will
 * eventually be added alongside the event:
 *
 *   [{ event: "admin/graph.recompute" }, { cron: "TZ=UTC 0 18 * * *" }]
 *
 * The function is intentionally split into three named steps so Inngest's
 * step memoization caches intermediate output across retries.
 */
export const recomputeGraphFn = inngest.createFunction(
  { id: "relationship-graph.recompute", retries: 2 },
  { event: "admin/graph.recompute" },
  async ({ step }) => {
    const sourceData = await step.run("fetch-source-data", async () => {
      return await fetchSourceData();
    });

    const snapshots = await step.run("build-snapshots", async () => {
      return buildGraphSnapshots(sourceData);
    });

    const written = await step.run("write-snapshots", async () => {
      return await writeSnapshots(snapshots);
    });

    return {
      topicCount: snapshots.topics.size,
      galaxyNodes: snapshots.galaxy.nodes.length,
      galaxyEdges: snapshots.galaxy.edges.length,
      writtenRows: written,
    };
  }
);

async function fetchSourceData(): Promise<SourceData> {
  const sb = createServiceClient();

  // Papers — title + abstract for topic classification, plus the fields the
  // snapshot needs at render time.
  const { data: papers, error: papersErr } = await sb
    .from("papers")
    .select("pmid, title, abstract, publication_date, epub_date, citation_count, journal_id");
  if (papersErr) throw new Error(`fetch papers: ${papersErr.message}`);

  const { data: citations, error: citErr } = await sb
    .from("paper_citations")
    .select("source_pmid, target_pmid");
  if (citErr) throw new Error(`fetch citations: ${citErr.message}`);

  const { data: mentions, error: menErr } = await sb
    .from("paper_mentions")
    .select("source_pmid, mentioned_pmid");
  if (menErr) throw new Error(`fetch mentions: ${menErr.message}`);

  const { data: journals, error: jErr } = await sb
    .from("journals")
    .select("id, abbreviation, color");
  if (jErr) throw new Error(`fetch journals: ${jErr.message}`);

  // Authors — first author rows (position = 1) and last-author rows
  // (position = MAX(position) per paper). We compute the max-position map
  // in JS rather than SQL because Supabase's PostgREST does not expose the
  // grouping aggregate cleanly.
  const { data: allAuthorRows, error: aErr } = await sb
    .from("paper_authors")
    .select("paper_id, last_name, first_name, initials, position, papers!inner(pmid)");
  if (aErr) throw new Error(`fetch authors: ${aErr.message}`);

  type Row = {
    paper_id: string;
    last_name: string;
    first_name: string | null;
    initials: string | null;
    position: number;
    papers: { pmid: string };
  };

  const rows = (allAuthorRows ?? []) as unknown as Row[];

  const maxPosByPaper = new Map<string, number>();
  for (const r of rows) {
    const cur = maxPosByPaper.get(r.paper_id) ?? 0;
    if (r.position > cur) maxPosByPaper.set(r.paper_id, r.position);
  }

  const authors: SourceAuthor[] = [];
  for (const r of rows) {
    const isLast = r.position === maxPosByPaper.get(r.paper_id);
    if (r.position !== 1 && !isLast) continue;
    authors.push({
      pmid: r.papers.pmid,
      last_name: r.last_name,
      first_name: r.first_name,
      initials: r.initials,
      position: r.position,
      is_last: isLast,
    });
  }

  return {
    papers: papers ?? [],
    citations: citations ?? [],
    mentions: mentions ?? [],
    journals: journals ?? [],
    authors,
  };
}

async function writeSnapshots(s: ReturnType<typeof buildGraphSnapshots>): Promise<number> {
  const sb = createServiceClient();
  const rows = [
    {
      scope: "galaxy",
      payload: s.galaxy,
      node_count: s.galaxy.nodes.length,
      edge_count: s.galaxy.edges.length,
    },
    ...[...s.topics.entries()].map(([slug, snap]) => ({
      scope: `topic:${slug}`,
      payload: snap,
      node_count: snap.nodes.length,
      edge_count: snap.edges.length,
    })),
  ];
  const { error } = await sb
    .from("paper_graph_snapshots")
    .upsert(rows, { onConflict: "scope" });
  if (error) throw new Error(`upsert snapshots: ${error.message}`);
  return rows.length;
}
```

- [ ] **Step 2: Re-export from `src/lib/inngest/functions.ts`**

Add this line near the other exports at the top of the file:

```ts
export { recomputeGraphFn } from "./recompute-graph";
```

- [ ] **Step 3: Register in the serve handler**

In `src/app/api/inngest/route.ts`, add to the imports:

```ts
import {
  syncJournalFn,
  syncAllFn,
  backfillJournalFn,
  backfillAllFn,
  onDemandEnrichFn,
  generateTrendingAnalysisFn,
  generateGeographyInsightsFn,
  recomputeGraphFn,
} from "@/lib/inngest/functions";
```

And add to the `functions` array:

```ts
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    syncJournalFn,
    syncAllFn,
    backfillJournalFn,
    backfillAllFn,
    onDemandEnrichFn,
    generateTrendingAnalysisFn,
    generateGeographyInsightsFn,
    recomputeGraphFn,
  ],
});
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/inngest/recompute-graph.ts src/lib/inngest/functions.ts src/app/api/inngest/route.ts
git commit -m "feat(graph): inngest recompute-graph function with event trigger"
```

---

### Task 10: Admin trigger API route

**Files:**
- Create: `src/app/api/admin/recompute-graph/route.ts`

- [ ] **Step 1: Write the route**

```ts
// src/app/api/admin/recompute-graph/route.ts
import { NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/admin";
import { inngest } from "@/lib/inngest/client";

/**
 * Manual trigger for the relationship-graph recompute Inngest function.
 *
 * Used:
 *  - After adding a new topic to `topics.ts` so the galaxy reflects it
 *    without waiting for the next scheduled run.
 *  - For incident recovery if the cron is paused or fails.
 */
export async function POST() {
  const authClient = await createServerAuthClient();
  const { data: { session } } = await authClient.auth.getSession();
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await inngest.send({ name: "admin/graph.recompute", data: {} });

  return NextResponse.json({ ok: true, dispatched: true }, { status: 202 });
}
```

- [ ] **Step 2: Manual smoke test (after `npm run dev`)**

Run (assumes logged-in admin session cookie):
```bash
curl -X POST -i http://localhost:3000/api/admin/recompute-graph -b "$(< ~/.my-allergy-session-cookie)"
```
Expected: `HTTP/1.1 202` with `{"ok":true,"dispatched":true}`. Without cookie: `403`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/recompute-graph/route.ts
git commit -m "feat(graph): admin trigger for relationship-graph recompute"
```

---

### Task 11: GET /api/graph/galaxy

**Files:**
- Create: `src/app/api/graph/galaxy/route.ts`

- [ ] **Step 1: Write the route**

```ts
// src/app/api/graph/galaxy/route.ts
import { NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/server";
import type { GalaxySnapshot } from "@/lib/graph/types";

const STALE_AFTER_HOURS = 24;

export async function GET() {
  const sb = createAnonClient();
  const { data, error } = await sb
    .from("paper_graph_snapshots")
    .select("payload, computed_at")
    .eq("scope", "galaxy")
    .maybeSingle();

  if (error) {
    console.error("[graph/galaxy] read error:", error);
    return NextResponse.json<GalaxySnapshot>({ nodes: [], edges: [] }, { status: 500 });
  }

  if (!data) {
    // Snapshot has never been computed. Return empty body so the UI shows
    // the empty state rather than an error.
    const res = NextResponse.json<GalaxySnapshot>({ nodes: [], edges: [] });
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    return res;
  }

  const computedAt = new Date(data.computed_at as string);
  const ageMs = Date.now() - computedAt.getTime();
  const stale = ageMs > STALE_AFTER_HOURS * 60 * 60 * 1000;

  const res = NextResponse.json({
    ...(data.payload as GalaxySnapshot),
    stale,
  });
  res.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  res.headers.set("X-Graph-Computed-At", computedAt.toISOString());
  return res;
}
```

- [ ] **Step 2: Smoke test**

Run: `curl -i http://localhost:3000/api/graph/galaxy`
Expected: `200` with `{"nodes":[],"edges":[]}` before the cron has ever run, OR a populated body after running the admin trigger and Inngest dev server.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/graph/galaxy/route.ts
git commit -m "feat(graph): GET /api/graph/galaxy reads snapshot"
```

---

### Task 12: GET /api/graph/topic/[slug]

**Files:**
- Create: `src/app/api/graph/topic/[slug]/route.ts`

- [ ] **Step 1: Write the route**

```ts
// src/app/api/graph/topic/[slug]/route.ts
import { NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/server";
import type { TopicSnapshot } from "@/lib/graph/types";

const STALE_AFTER_HOURS = 24;

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_req: Request, ctx: RouteContext) {
  const { slug } = await ctx.params;
  const sb = createAnonClient();
  const { data, error } = await sb
    .from("paper_graph_snapshots")
    .select("payload, computed_at")
    .eq("scope", `topic:${slug}`)
    .maybeSingle();

  if (error) {
    console.error(`[graph/topic/${slug}] read error:`, error);
    return NextResponse.json({ error: "snapshot read failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const computedAt = new Date(data.computed_at as string);
  const ageMs = Date.now() - computedAt.getTime();
  const stale = ageMs > STALE_AFTER_HOURS * 60 * 60 * 1000;

  const res = NextResponse.json({
    ...(data.payload as TopicSnapshot),
    stale,
  });
  res.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  res.headers.set("X-Graph-Computed-At", computedAt.toISOString());
  return res;
}
```

- [ ] **Step 2: Smoke test**

Run: `curl -i http://localhost:3000/api/graph/topic/asthma`
Expected: `404` before cron has populated the row, or `200` with the topic snapshot afterward.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/graph/topic/\[slug\]/route.ts
git commit -m "feat(graph): GET /api/graph/topic/[slug] reads snapshot"
```

---

### Task 13: Phase 1 wrap — manual cron dry-run + PR

- [ ] **Step 1: Run the function locally**

Start Inngest dev server:
```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```
In a separate shell, with a logged-in admin session:
```bash
curl -X POST http://localhost:3000/api/admin/recompute-graph
```
Watch the Inngest dashboard at `http://localhost:8288` for the run to complete.

- [ ] **Step 2: Inspect the snapshot rows**

Run (psql):
```sql
SELECT scope, node_count, edge_count, computed_at
FROM paper_graph_snapshots
ORDER BY scope;
```
Expected: 1 `galaxy` row + 1 row per topic that has papers, each with `node_count > 0`.

- [ ] **Step 3: Validate payload shape**

Run: `curl -s http://localhost:3000/api/graph/galaxy | jq '.nodes | length, .edges | length'`
Expected: two integers; the first is the number of topics (≤ 13), the second is the number of cross-topic edges.

- [ ] **Step 4: Push branch and open a draft PR for the backend**

```bash
git push -u origin feat/relationship-graph-edit
gh pr create --draft --base main --title "feat(graph): DB-wide relationship-graph backend (Phase 1)" --body "Implements Phase 1 of \`docs/superpowers/specs/2026-06-01-relationship-graph-redesign-design.md\`.

- Migration \`00042_paper_graph_snapshots\`
- Inngest \`relationship-graph.recompute\` (event-only trigger; cron added in Phase 3)
- Read endpoints: GET /api/graph/galaxy, GET /api/graph/topic/[slug]
- Admin trigger: POST /api/admin/recompute-graph
- Pure builder \`src/lib/graph/build-snapshots.ts\` with 14 unit tests

Frontend (Phase 2) follows in a separate PR after mockup approval.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

The Phase 1 PR ships **without** any frontend change; the existing Timeline graph continues to render via the old endpoint.

---

# Phase 2 — Frontend

### Task 14: Static mockups (mockup-first)

> Per project memory: **non-trivial UI restructuring requires a static HTML mockup committed to `docs/mockups/` and approved by the user before any component code lands**. This task produces those mockups and pauses for user approval before Task 15.

**Files:**
- Create: `docs/mockups/relationship-graph/galaxy.html`
- Create: `docs/mockups/relationship-graph/topic.html`
- Create: `docs/mockups/relationship-graph/highlight.html`

- [ ] **Step 1: Build `galaxy.html`**

A single-file HTML page with inline CSS that mimics the home page chrome
(sticky header, sidebar, right rail) and shows the panel in the `galaxy`
state. Use the same blue/gray palette as `home-page.tsx`. The graph itself
is an inline SVG with hand-placed circles for ~13 topics; no JS required.
Include the panel header with "Relationship map" + "Updated 2h ago".

- [ ] **Step 2: Build `topic.html`**

Same chrome, but the panel shows the inline-expanded state for "Asthma":
back button, "Asthma (top 80 of 612)" header, a force-layout-like SVG of
~30 paper nodes (journal-colored circles with abbreviation labels and
truncated titles). Edge styles by type per §7.1 of the spec.

- [ ] **Step 3: Build `highlight.html`**

Same chrome with the topic graph, plus a right-side `DetailSheet` showing
title, journal, date, neighbor list (10 items with journal badges), and
an `Open` button. The focused node and its 1-hop neighbors are at full
opacity; all other nodes are at opacity 0.15.

- [ ] **Step 4: Take screenshots and present them**

Use `mcp__chrome-devtools` to open each file and screenshot at 1280×800.
Save screenshots next to the HTML (`galaxy.png`, `topic.png`,
`highlight.png`).

- [ ] **Step 5: Commit and pause for user approval**

```bash
git add docs/mockups/relationship-graph/
git commit -m "docs(mockup): relationship-graph galaxy/topic/highlight states"
```

> **STOP HERE.** Present the three screenshots to the user. Do not proceed
> to Task 15 until they approve. Iterate on the mockups based on feedback
> before any component code.

---

### Task 15: Extend the D3 primitive

**Files:**
- Modify: `src/components/graph/relationship-graph.tsx`

The current component renders a single homogeneous graph. We add optional
props for variable radius, edge styling, focus, and a unified node-click
handler. **All new props are optional**; existing callers (the about-to-be-deleted
`RelationshipGraphPanel`) continue to compile until Task 18.

- [ ] **Step 1: Add the new prop types**

At the top of `src/components/graph/relationship-graph.tsx`, replace the
`RelationshipGraphProps` interface with:

```ts
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
}
```

- [ ] **Step 2: Wire the props inside the effect**

Where the component currently sets `circle.attr("r", 16)`, replace with:

```ts
node.append("circle")
  .attr("r", (d) => props.nodeRadius?.(d as unknown as GraphNode) ?? 16)
  .attr("fill", (d) => d.journal_color)
  .attr("stroke", "white")
  .attr("stroke-width", 2)
  .attr("opacity", (d) => {
    if (!focusedPmid) return 0.9;
    if (d.pmid === focusedPmid) return 1;
    if (focusedNeighbors.has(d.pmid)) return 0.9;
    return 0.15;
  });
```

Add at the top of the effect, before the simulation:

```ts
const focusedNeighbors = new Set<string>();
if (focusedPmid) {
  for (const e of edges) {
    if (e.source === focusedPmid) focusedNeighbors.add(e.target);
    else if (e.target === focusedPmid) focusedNeighbors.add(e.source);
  }
}
```

Replace the link stroke logic with:

```ts
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

function defaultEdgeStroke(t: GraphEdge["type"]) {
  return t === "citation" ? "#9CA3AF" : t === "mention" ? "#3B82F6" : "#8B5CF6";
}
```

Replace the click handler:

```ts
node.on("click", (_event, d) => {
  if (onSelectNode) onSelectNode(d as unknown as GraphNode);
  else navigate(d.pmid);
});
```

Destructure new props at the top of the component:

```ts
export function RelationshipGraph({
  nodes, edges, width, height,
  nodeRadius, edgeStyle, focusedPmid, onSelectNode,
}: RelationshipGraphProps) {
```

And include them in the effect's dependency array:

```ts
}, [nodes, edges, width, height, navigate, nodeRadius, edgeStyle, focusedPmid, onSelectNode]);
```

- [ ] **Step 3: Type-check and run existing tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 type errors; all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/graph/relationship-graph.tsx
git commit -m "feat(graph): extend D3 primitive with variable radius/edge style/focus"
```

---

### Task 16: View-state hook with URL sync

**Files:**
- Create: `src/hooks/use-graph-view.ts`
- Create: `src/hooks/__tests__/use-graph-view.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/hooks/__tests__/use-graph-view.test.ts
import { describe, it, expect } from "vitest";
import { parseGraphViewFromQuery, serializeGraphView } from "@/hooks/use-graph-view";

describe("parseGraphViewFromQuery", () => {
  it("defaults to galaxy when no map param", () => {
    expect(parseGraphViewFromQuery(new URLSearchParams(""))).toEqual({ kind: "galaxy" });
  });
  it("parses topic:<slug>", () => {
    const q = new URLSearchParams("map=topic:asthma");
    expect(parseGraphViewFromQuery(q)).toEqual({ kind: "topic", slug: "asthma" });
  });
  it("parses topic + focus into highlight", () => {
    const q = new URLSearchParams("map=topic:asthma&focus=12345");
    expect(parseGraphViewFromQuery(q)).toEqual({
      kind: "highlight",
      slug: "asthma",
      focusedPmid: "12345",
    });
  });
  it("ignores focus without a topic", () => {
    const q = new URLSearchParams("focus=12345");
    expect(parseGraphViewFromQuery(q)).toEqual({ kind: "galaxy" });
  });
});

describe("serializeGraphView", () => {
  it("returns an empty querystring for galaxy", () => {
    expect(serializeGraphView({ kind: "galaxy" })).toBe("");
  });
  it("returns map=topic:<slug> for topic", () => {
    expect(serializeGraphView({ kind: "topic", slug: "asthma" })).toBe("map=topic%3Aasthma");
  });
  it("returns map + focus for highlight", () => {
    expect(serializeGraphView({ kind: "highlight", slug: "asthma", focusedPmid: "12345" }))
      .toBe("map=topic%3Aasthma&focus=12345");
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/hooks/__tests__/use-graph-view.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/hooks/use-graph-view.ts
"use client";

import { useCallback, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export type GraphView =
  | { kind: "galaxy" }
  | { kind: "topic"; slug: string }
  | { kind: "highlight"; slug: string; focusedPmid: string };

export function parseGraphViewFromQuery(params: URLSearchParams): GraphView {
  const map = params.get("map");
  const focus = params.get("focus");
  if (!map || map === "galaxy") return { kind: "galaxy" };
  if (map.startsWith("topic:")) {
    const slug = map.slice("topic:".length);
    if (!slug) return { kind: "galaxy" };
    if (focus) return { kind: "highlight", slug, focusedPmid: focus };
    return { kind: "topic", slug };
  }
  return { kind: "galaxy" };
}

export function serializeGraphView(view: GraphView): string {
  const p = new URLSearchParams();
  if (view.kind === "galaxy") return "";
  if (view.kind === "topic") {
    p.set("map", `topic:${view.slug}`);
    return p.toString();
  }
  p.set("map", `topic:${view.slug}`);
  p.set("focus", view.focusedPmid);
  return p.toString();
}

/**
 * Drives the relationship-graph panel's view state and keeps it in sync with
 * the URL via `history.replaceState` (no history pollution during exploration).
 *
 * The hook subscribes to the URL on mount so a deep link like
 * `/?map=topic:asthma&focus=12345` restores the right state when the user
 * arrives.
 */
export function useGraphView(): [GraphView, (next: GraphView) => void] {
  const router = useRouter();
  const search = useSearchParams();
  const [view, setView] = useState<GraphView>(() => parseGraphViewFromQuery(search));

  // Keep state in sync if the URL changes externally (e.g. Back button).
  useEffect(() => {
    setView(parseGraphViewFromQuery(search));
  }, [search]);

  const update = useCallback((next: GraphView) => {
    setView(next);
    const qs = serializeGraphView(next);
    const target = qs ? `?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", target);
    // Keep Next router's internal state aligned without forcing a fetch.
    router.replace(target, { scroll: false });
  }, [router]);

  return [view, update];
}
```

- [ ] **Step 4: Run and confirm pass**

Run: `npx vitest run src/hooks/__tests__/use-graph-view.test.ts`
Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-graph-view.ts src/hooks/__tests__/use-graph-view.test.ts
git commit -m "feat(graph): use-graph-view hook with URL sync"
```

---

### Task 17: `DetailSheet` component

**Files:**
- Create: `src/components/papers/detail-sheet.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/components/papers/detail-sheet.tsx
"use client";

import Link from "next/link";
import { X } from "lucide-react";
import type { PaperNode, PaperEdge } from "@/lib/graph/types";

interface DetailSheetProps {
  focused: PaperNode;
  neighbors: { node: PaperNode; edge: PaperEdge }[];
  onClose: () => void;
}

/**
 * The right-side sheet for the `highlight` view of the relationship panel.
 *
 * On desktop it renders inline next to the graph (consumer positions it).
 * On mobile it should be wrapped in a bottom-sheet container by the parent.
 */
export function DetailSheet({ focused, neighbors, onClose }: DetailSheetProps) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Selected paper
          </p>
          <h3 className="mt-1 line-clamp-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
            {focused.title}
          </h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            <span style={{ color: focused.journal_color }} className="font-semibold">
              {focused.journal_abbreviation}
            </span>
            <span className="mx-1">·</span>
            <span>{focused.publication_date}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close detail"
          className="rounded-full p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <Link
        href={`/paper/${focused.pmid}`}
        className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        Open paper →
      </Link>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Neighbors ({neighbors.length})
        </p>
        {neighbors.length === 0 ? (
          <p className="text-xs text-gray-500">No connected papers in this view.</p>
        ) : (
          <ul className="space-y-2">
            {neighbors.map(({ node, edge }) => (
              <li key={node.pmid} className="text-xs">
                <Link href={`/paper/${node.pmid}`} className="block hover:underline">
                  <span style={{ color: node.journal_color }} className="font-semibold">
                    [{node.journal_abbreviation}]
                  </span>{" "}
                  <span className="text-gray-800 dark:text-gray-200">{node.title}</span>
                </Link>
                <p className="text-[10px] text-gray-500">
                  {edge.types.join(" · ")} · w {edge.weight.toFixed(1)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/papers/detail-sheet.tsx
git commit -m "feat(graph): DetailSheet for focused paper + neighbors"
```

---

### Task 18: Rewrite `RelationshipGraphPanel`

**Files:**
- Modify: `src/components/papers/relationship-graph-panel.tsx`

- [ ] **Step 1: Replace the file contents with the new implementation**

```tsx
// src/components/papers/relationship-graph-panel.tsx
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
```

- [ ] **Step 2: Update `home-page.tsx` to drop the prop**

In `src/components/papers/home-page.tsx`, change:

```tsx
<RelationshipGraphPanel
  activeTab={activeTab}
  isAuthenticated={Boolean(user)}
/>
```

to:

```tsx
{activeTab === "timeline" && <RelationshipGraphPanel />}
```

The panel is Timeline-only in the redesign. The For-you tab keeps using
`/api/me/connections` via its own (existing) wiring elsewhere — out of scope
for this work.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Manual smoke test**

Open `http://localhost:3000` in a fresh browser tab. Confirm the relationship
map renders in galaxy state. Click a topic → topic view inline-expands. Click
a paper → `DetailSheet` appears. Click `Open paper →` → navigates to
`/paper/[pmid]`. Use the browser Back button → returns to the panel state via
URL sync.

- [ ] **Step 5: Commit**

```bash
git add src/components/papers/relationship-graph-panel.tsx src/components/papers/home-page.tsx
git commit -m "feat(graph): rewrite RelationshipGraphPanel as galaxy/topic/highlight state machine"
```

---

### Task 19: Mobile fullscreen modal

**Files:**
- Modify: `src/components/papers/relationship-graph-panel.tsx`

- [ ] **Step 1: Add a mobile CTA + modal wrapper**

Wrap the existing panel body in a desktop-only `sm:block` and add a
mobile-only CTA + modal at the top of the component. Insert before the
existing `return` block:

```tsx
const [mobileOpen, setMobileOpen] = useState(false);
```

Add `import { useState } from "react";` at the top of the file. Then wrap
the existing return like this:

```tsx
return (
  <>
    {/* Mobile CTA */}
    <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800 sm:hidden">
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-50 px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:bg-gray-900/50 dark:text-gray-300 dark:hover:bg-gray-900"
      >
        <Network className="h-4 w-4" />
        View relationship map
      </button>
    </div>

    {/* Desktop inline panel */}
    <div className="hidden sm:block">
      {renderBody()}
    </div>

    {/* Mobile fullscreen modal */}
    {mobileOpen && (
      <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-950 sm:hidden">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <h2 className="text-sm font-semibold">Relationship map</h2>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close map"
            className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {renderBody()}
        </div>
      </div>
    )}
  </>
);
```

Refactor the body of the existing `return` into a `renderBody()` function
inside the component so it can be reused in both desktop and mobile branches.
Add `import { X } from "lucide-react";`.

- [ ] **Step 2: Manual smoke test**

In Chrome DevTools, resize to a 375px-wide viewport. Confirm the inline panel
is hidden, the CTA is visible, and clicking it opens a fullscreen modal with
the same panel inside.

- [ ] **Step 3: Commit**

```bash
git add src/components/papers/relationship-graph-panel.tsx
git commit -m "feat(graph): mobile fullscreen modal for relationship map"
```

---

### Task 20: Delete superseded code

**Files:**
- Delete: `src/app/api/connections/recent/route.ts`
- Delete: `src/lib/graph/induced-subgraph.ts`
- Delete: `src/lib/graph/__tests__/induced-subgraph.test.ts`

> Skip any file that does not exist on this branch. The `home-page.tsx` and
> `relationship-graph-panel.tsx` callers were already updated in Task 18.

- [ ] **Step 1: Verify no remaining callers**

Run: `git grep -n "connections/recent" src/ ; git grep -n "induced-subgraph" src/`
Expected: no matches (the matches in `src/app/api/me/connections/route.ts`,
if any, are unrelated to the deleted route).

If a match exists outside the planned deletions, stop and report. Do not
proceed.

- [ ] **Step 2: Delete files**

```bash
git rm src/app/api/connections/recent/route.ts
git rm src/lib/graph/induced-subgraph.ts
git rm src/lib/graph/__tests__/induced-subgraph.test.ts
```

- [ ] **Step 3: Type-check, lint, and run all tests**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: 0 errors, 0 lint warnings, all tests pass.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(graph): remove superseded 90-day connections endpoint"
```

---

### Task 21: Phase 2 wrap — preview QA + PR

- [ ] **Step 1: Push branch and update PR**

```bash
git push
gh pr ready  # mark draft as ready for review
```

- [ ] **Step 2: Run the full E2E checklist from spec §13.3 on the Vercel preview deploy**

The preview URL is in the PR's first deployment comment. Walk each item:

1. Click a topic in galaxy → topic view inline-expands.
2. Click a paper → side sheet opens with metadata and neighbors.
3. Click `Open paper →` in side sheet → `/paper/[pmid]`.
4. Browser Back from `/paper/[pmid]` → returns to topic view with focus
   restored (URL sync).
5. Mobile (Chrome DevTools 375px): CTA opens modal; same flow works.
6. Reload at any URL with `?map=...` restores the same view.
7. The "Updated …" timestamp matches the most recent cron run.

If any item fails, file a fix in this same PR.

- [ ] **Step 3: Request review and merge once approved**

Per the user's PR workflow preference: non-trivial changes go via feature
branch + PR. Wait for explicit approval before merging.

---

# Phase 3 — Enable cron

> Ship as a separate, one-line PR a week after Phase 2 merge, once at least 7
> manual triggers have been verified without incident.

### Task 22: Add cron schedule alongside the event trigger

**Files:**
- Modify: `src/lib/inngest/recompute-graph.ts`

- [ ] **Step 1: Add the cron trigger**

Replace:
```ts
  { event: "admin/graph.recompute" },
```
with:
```ts
  [{ event: "admin/graph.recompute" }, { cron: "TZ=UTC 0 18 * * *" }],
```

- [ ] **Step 2: Verify Inngest dashboard picks up the schedule**

After deploy, check the Inngest dashboard's "Functions" page. Expected:
`relationship-graph.recompute` shows two triggers (event + cron) and the
next scheduled run is the upcoming 18:00 UTC.

- [ ] **Step 3: Commit and PR**

```bash
git commit -m "feat(graph): enable daily cron for relationship-graph.recompute"
git push
gh pr create --base main --title "feat(graph): enable cron for relationship-graph.recompute" --body "Adds the daily cron trigger alongside the existing event trigger. The function shipped with event-only in PR #N to allow controlled verification. After 1 week of clean manual runs, switching on the schedule."
```

---

# Phase 4 — Deferred (separate spec)

Auto-community detection inside a topic, per §11 of the spec. Plan to be
written in a new doc when prioritized; do not start here.

---

## Self-review notes (run by writer)

- **Spec coverage:** Each spec section now maps to tasks:
  - §5 architecture → Tasks 2, 9, 11, 12, 18
  - §6 data model → Tasks 2, 3
  - §7 edges → Tasks 4, 5, 6, 7, 8
  - §8 cron pipeline → Task 9
  - §9 API → Tasks 10, 11, 12
  - §10 frontend → Tasks 15, 16, 17, 18, 19
  - §11 Phase 2 → Phase 4 (out of scope here)
  - §12 TBDs → all of them are deferred (snapshot warning UI is Task 18 step 1; mobile fallback default is Task 19 step 1; admin trigger UI absent — only the API exists)
  - §13 test plan → unit tests in Tasks 4–8, 16; smoke checks in Tasks 11, 12, 13, 18, 19
  - §14 cost analysis → none required in plan
  - §15 risks → Stale flag in Task 11/12; admin trigger in Task 10
  - §16 rollout → Phase split matches Phase 1/2/3/4 in this plan
- **Placeholders:** none. Every code block is concrete.
- **Type consistency:** `PaperNode`, `PaperEdge`, `EdgeType`, `GalaxyNode`,
  `GalaxyEdge` are introduced in Task 3 and referenced by exact name in every
  subsequent task. `SourcePaper`/`SourceAuthor`/`SourceCitation`/`SourceMention`/`SourceJournal`/`SourceData` are introduced in Task 5 and reused in Task 9. `GraphView` enum
  introduced in Task 16 and reused in Task 18.
