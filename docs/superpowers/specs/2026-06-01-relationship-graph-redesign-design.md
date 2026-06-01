# Relationship Graph Redesign — DB-wide, Multi-level

- **Date**: 2026-06-01
- **Branch**: `feat/relationship-graph-edit`
- **Author**: lekis1020 + Claude (brainstorming session)
- **Status**: Design — pending user review

## 1. Background

The Timeline tab on `/` currently renders a relationship graph above the paper
feed, computed by `/api/connections/recent`. That graph is scoped to the last
90 days (≤60 papers ranked by citation count), wired together by `paper_citations`
and `paper_mentions` edges only.

Users want **the whole database** as a relationship map: not just papers
trending now, and not just citation-based linkage. The interesting structure of
allergy/immunology literature is hidden in:

1. Direct citations (strongest signal).
2. Shared topic membership (Asthma, Urticaria, Food Allergy …).
3. Shared first/last authorship (research-group continuity).

Rendering thousands of papers as one flat force-directed graph is infeasible
both visually (hairball) and computationally (browser memory, simulation
convergence). The redesign uses a **multi-level cluster overview** to make
DB-wide structure navigable while keeping interactivity smooth.

## 2. Goals

- Replace the existing Timeline relationship graph with a DB-wide,
  topic-clustered map.
- Show inter-paper relationships ranked by strength: citation > co-author >
  mention > topic overlap.
- Keep the rendering primitive (D3 force) but layer a state machine for
  galaxy → topic → focused-paper exploration.
- Precompute snapshots so requests are cache-friendly.
- Stay within Supabase free tier; under $0/month incremental ops cost.

## 3. Non-goals (V1)

- Author-centric or journal-centric views (only paper-centric).
- Auto community detection inside a topic. Deferred to Phase 2.
- Time-slider animation of network evolution.
- Search-and-zoom UX for arbitrary papers ("find this PMID in the map").
- Per-user personalized map. The For-you tab continues to use the existing
  `/api/me/connections` for now; that endpoint is out of scope for this work.

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

## 4. Decision summary (from brainstorming)

| # | Decision | Choice |
|---|---|---|
| Q1 | Visualization scale | Cluster overview (galaxy view) |
| Q2 | Cluster unit | Multi-level — V1: Topic; Phase 2: Auto-community inside topic |
| Q3 | Coexistence with existing graph | Replace (90-day graph removed entirely from Timeline tab) |
| Q4 | Author edge condition | First OR Last author match |
| Q5 | Community mentions | Kept as a 4th edge type |
| Q6 | Cluster-click UX | Inline expand (no modal, no route change) |
| Q7 | Paper-node click UX | Click → highlight + neighbor side panel (`DetailSheet`). Navigation to `/paper/[pmid]` happens via the explicit `Open` button in the sheet on both desktop and mobile. (Brainstorming initially considered double-click for navigation; unified on the explicit button to avoid PC accidental nav and mobile zoom conflict — see §10.2.) |
| Q8 | Compute strategy | Precompute + cache (Inngest cron writes snapshots; API reads them) |

## 5. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Inngest cron (1×/day, 03:00 KST)                                │
│  relationship-graph.recompute                                   │
│   1. Fetch papers, citations, paper_authors, paper_mentions,    │
│      journals.                                                  │
│   2. Build paper-paper edges of four kinds (weighted).          │
│   3. Per-topic induced subgraphs (cap = 80 nodes).              │
│   4. Galaxy aggregation (topic-pair weight sums).               │
│   5. UPSERT paper_graph_snapshots.                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ API (anon, public, 5-min CDN cache)                             │
│   GET /api/graph/galaxy        → galaxy snapshot                │
│   GET /api/graph/topic/[slug]  → per-topic snapshot             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Timeline RelationshipGraphPanel (rewritten)                     │
│   View state: galaxy | topic:<slug> | highlight:<slug,pmid>     │
│   D3 rendering primitive reused from current RelationshipGraph  │
│   URL sync: ?map=galaxy | topic:asthma | topic:asthma&focus=PM  │
└─────────────────────────────────────────────────────────────────┘
```

The hard separation is: **all expensive work is in the cron**; the API is a
single-row read; the client renders ≤80 nodes at any moment.

## 6. Data model

### 6.1 Snapshot table

`supabase/migrations/00042_paper_graph_snapshots.sql`:

```sql
CREATE TABLE paper_graph_snapshots (
  scope TEXT PRIMARY KEY,            -- 'galaxy' | 'topic:<slug>'
  payload JSONB NOT NULL,            -- {nodes, edges, truncated?}
  node_count INT NOT NULL,
  edge_count INT NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE paper_graph_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_paper_graph_snapshots"
  ON paper_graph_snapshots FOR SELECT TO anon USING (true);
-- writes done via service client only (no INSERT/UPDATE policy)
```

Rows: 1 galaxy row + 1 row per topic_slug. With 13 topics, total 14 rows.

### 6.2 Node and edge shapes (TypeScript)

```ts
// src/lib/graph/types.ts (extended)

export interface PaperNode {
  pmid: string;
  title: string;
  publication_date: string;
  citation_count: number;
  journal_abbreviation: string;
  journal_color: string;
  topic_tags: string[];
  primary_topic: string;             // topic_tags[0] or 'uncategorized'
}

export type EdgeType = 'citation' | 'coauthor' | 'mention' | 'topic';

export interface PaperEdge {
  source: string;                    // pmid (lexicographically smaller)
  target: string;                    // pmid
  types: EdgeType[];                 // every type present on the pair
  weight: number;                    // sum (see §7)
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
  recent_paper_count: number;        // last 90 days, used for visual accent
}

export interface GalaxyEdge {
  source: string;                    // topic_slug
  target: string;                    // topic_slug
  weight: number;                    // sum of paper-paper edge weights across the cut
  paper_pair_count: number;
}

export interface GalaxySnapshot {
  nodes: GalaxyNode[];
  edges: GalaxyEdge[];
}
```

## 7. Edge definitions and weights

### 7.1 Weights

| Type | Source | Weight | Visual |
|---|---|---|---|
| `citation` | `paper_citations` (either direction) | **3.0** | Solid heavy, gray (#9CA3AF) |
| `coauthor` | First OR Last author name match | **2.0** | Solid, indigo (#6366F1) |
| `mention` | `paper_mentions` | **1.5** | Dashed, blue (#3B82F6) |
| `topic` | `topic_tags` ∩ ≥ 1 | **1.0 × overlap** | Reinforcement only (see §7.2) |

A single pair (A, B) accumulates: `edge.types` lists every type present;
`edge.weight` is the sum across types. The line is rendered in the style of
the strongest type present (`citation` > `coauthor` > `mention` > `topic`).

### 7.2 Topic edges are reinforcement-only

If `topic` were a standalone edge type, every pair of papers sharing a topic
would generate an edge: roughly $\binom{500}{2}$ per large topic, well over a
million pairs DB-wide. This is computationally wasteful and visually noisy.

**Rule**: a `topic` contribution is added to `edge.weight` only when the pair
already has a citation, coauthor, or mention edge. Two papers that share a
topic but have no citation/coauthor/mention trace are not connected by an
edge, although the force layout still places them near each other inside the
same topic cluster.

### 7.3 Co-author edge: first OR last author

A pair (A, B) qualifies for a `coauthor` edge when there is any name overlap
between `{first author of A, last author of A}` and `{first author of B, last
author of B}`. Cross-position matches count — a researcher who was first
author on A and last author on B (typical mentor/mentee progression) connects
the two papers.

Name matching is exact after normalization:

```ts
function normalizeAuthor(name: string): string {
  return name.trim().toLowerCase()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ');
}
```

Common-name collision guard: any author whose normalized name maps to more
than **200 papers** is dropped from the coauthor pass (treats them as ambiguous
"John Smith"–class names). Threshold revisited if false negatives surface in
QA.

### 7.4 Verification required before implementation

The `paper_authors` table currently has `is_first_author` (per migration 00040)
but `is_last_author` is unverified. **Pre-implementation step**: confirm the
column exists. If not, add `00043_add_paper_authors_last_author.sql` with a
backfill:

```sql
ALTER TABLE paper_authors ADD COLUMN is_last_author BOOLEAN NOT NULL DEFAULT false;

UPDATE paper_authors pa
SET is_last_author = true
FROM (
  SELECT pmid, MAX(position) AS max_pos
  FROM paper_authors
  GROUP BY pmid
) m
WHERE pa.pmid = m.pmid AND pa.position = m.max_pos;

CREATE INDEX paper_authors_last_author_idx
  ON paper_authors (full_name) WHERE is_last_author = true;
```

## 8. Cron pipeline

### 8.1 Function

`src/lib/inngest/functions/recompute-graph.ts`:

During Phase 1 (backend ship), the function is registered with the
event-only trigger `admin/graph.recompute` to allow controlled manual runs.
The cron schedule is added in Phase 3 once the first manual runs verify
the snapshot output:

```ts
export const recomputeGraph = inngest.createFunction(
  { id: 'relationship-graph.recompute', retries: 2 },
  // Phase 1: event-only trigger.
  // Phase 3 adds the cron alongside the event trigger:
  //   [{ event: 'admin/graph.recompute' }, { cron: 'TZ=UTC 0 18 * * *' }]
  { event: 'admin/graph.recompute' },
  async ({ step }) => {
    const data = await step.run('fetch', () => fetchSourceData());
    const snapshots = await step.run('build', () => buildGraphSnapshots(data));
    await step.run('write', () => writeSnapshots(snapshots));
    return {
      topics: snapshots.topics.size,
      galaxyNodes: snapshots.galaxy.nodes.length,
      galaxyEdges: snapshots.galaxy.edges.length,
    };
  }
);
```

Also a manual-trigger event `admin/graph.recompute` available behind the
existing admin gate, so adding a new topic to `topics.ts` does not require
waiting until the next 03:00.

### 8.2 Builder pseudocode

See §3.3 of the brainstorming notes (faithfully reproduced here for the
implementer):

1. **Nodes**: for each paper, compute `topic_tags` via the existing
   `src/lib/utils/topic-tags.ts` utility (title + abstract). Build
   `PaperNode`.
2. **Edges**: maintain `Map<pairKey, EdgeAcc>`. For each citation row, each
   coauthor pair, each mention row, look up or insert the pair and add the
   type and weight if not already present. Pair key is
   `min(pmid) + "|" + max(pmid)`.
3. **Topic reinforcement**: iterate existing edges; if endpoints share ≥ 1
   topic, add `topic` to `types` and `1.0 × overlap` to weight.
4. **Degree map**: `Map<pmid, count>` from the edges (used for per-topic
   ranking).
5. **Per-topic subgraphs**: for each topic slug, take candidate papers
   tagged with that slug, sort by `(degree desc, citation_count desc,
   publication_date desc)`, slice top 80. Induced edges only (both endpoints
   in the slice). Attach `truncated: { total, dropped }`.
6. **Galaxy aggregation**: for each cross-topic edge (endpoints' primary
   topics differ), accumulate `(weight, paper_pair_count)` per topic pair.
   Galaxy nodes come from `topics.ts` with `paper_count` and
   `recent_paper_count` (papers from the last 90 days).
7. **Write**: UPSERT 14 rows into `paper_graph_snapshots` on `scope` PK.

### 8.3 Complexity and budget

- Time: O(P log P + C + E), dominated by edge construction. Estimated
  ~2 seconds end-to-end on current data (~5,000 papers, ~50k citations).
- Memory peak ~50 MB (edges Map). Well within Inngest's per-step limit.
- Inngest free-tier budget: 30 runs/month × 3 steps = 90 steps. Cap is
  50,000.

## 9. API surface

### 9.1 Endpoints

```
GET /api/graph/galaxy        → 200 GalaxySnapshot
GET /api/graph/topic/[slug]  → 200 TopicSnapshot | 404
```

Both return:

```
Cache-Control: public, s-maxage=300, stale-while-revalidate=600
```

Both add a meta header `X-Graph-Computed-At` with the snapshot's
`computed_at`. The client surfaces this in the UI ("Updated 2h ago").

If the snapshot is older than **24 hours**, the API still serves it but the
response includes `stale: true`. The UI shows a discreet warning. A Discord
alert via `configure-notifications` fires on the operations channel.

### 9.2 Read path

```ts
// /api/graph/galaxy
const sb = createAnonClient();
const { data } = await sb
  .from('paper_graph_snapshots')
  .select('payload, computed_at')
  .eq('scope', 'galaxy')
  .single();
return jsonWithCacheAndComputedAt(data.payload, data.computed_at);
```

The anon client suffices because the RLS policy from §6.1 allows anon SELECT.

### 9.3 Admin trigger

`POST /api/admin/recompute-graph` — behind the existing admin guard, sends
`admin/graph.recompute` to Inngest. Returns 202 immediately.

## 10. Frontend

### 10.1 Component layout

```
RelationshipGraphPanel  (renamed; old version deleted)
├── PanelHeader              ('Relationship map' + Updated-at + Back btn)
├── GraphCanvas              (D3 host; receives nodes/edges + viewMode)
│   └── RelationshipGraph    (existing primitive, extended)
└── DetailSheet              (mobile sheet / desktop right column)
    └── PaperNeighborsList   (focused paper meta + neighbors list)
```

### 10.2 View state

```ts
type GraphView =
  | { kind: 'galaxy' }
  | { kind: 'topic'; slug: string }
  | { kind: 'highlight'; slug: string; focusedPmid: string };
```

State transitions (full diagram in §C of brainstorming notes):

- `galaxy` + click topic node → `topic`
- `topic` + click paper node → `highlight`
- `highlight` + click background → `topic` (clear focus)
- `highlight` + click a different paper node → `highlight` with new focus
- `highlight` + click the same focused node → ignore; user clicks the
  explicit `Open` button in `DetailSheet` to navigate to `/paper/[pmid]`.
  *(Decision: unify mobile and desktop on an explicit button rather than
  rely on double-click semantics. Avoids accidental nav on PC, avoids
  zoom-conflict on mobile.)*
- any state + Back button → one level up

### 10.3 URL sync

The view state is mirrored to the URL:

- `/?map=galaxy` (default; can be omitted)
- `/?map=topic:asthma`
- `/?map=topic:asthma&focus=12345678`

Reading the URL on mount restores state. Updating state pushes via
`history.replaceState` (not `pushState`) to avoid polluting browser history
during normal exploration. Back button navigates to the prior URL state,
which restores the prior view.

### 10.4 Rendering rules

- **Galaxy view**: node radius = `clamp(8, sqrt(paper_count) * 1.8, 36)`.
  Edge thickness = `clamp(0.5, log(weight) * 0.6, 4)`. Each node labeled
  with the topic name and the paper count.
- **Topic view**: node radius = `clamp(10, log(citation_count + 2) * 4, 22)`.
  Edge stroke per §7.1. Each node shows the journal abbreviation inside the
  circle and the truncated title underneath, identical to the existing
  90-day rendering.
- **Highlight overlay**: focused node and its 1-hop neighbors render at full
  opacity. Everything else fades to opacity 0.15. Edges incident to the
  focused node stay at full opacity; other edges fade.

### 10.5 Mobile

Below the `sm` breakpoint the panel collapses to a CTA: **View
relationship map**, opening a fullscreen modal. The modal hosts the same
component tree with `DetailSheet` rendered as a bottom sheet. The fallback
preserves access without trying to make a force-directed graph usable in a
360px-wide column.

### 10.6 Reuse vs. rewrite

The existing `src/components/graph/relationship-graph.tsx` D3 host is
extended (not replaced) to support:

- variable node radius (`nodeRadius(node)` callback prop),
- multi-type edge styling (replace inline `stroke` ternary with a
  `edgeStyle(edge)` callback prop),
- highlight-mode opacity (`focusedPmid?: string` prop),
- click-vs-tap unified via the explicit `Open` button rather than
  `dblclick`,
- a `onSelectNode(node)` callback to drive `DetailSheet`.

`RelationshipGraphPanel` is rewritten because its props, fetch logic, and
state are all different from the current version.

## 11. Phase 2 — auto-community inside a topic

Out of scope for V1 but designed for here so the data model and the cron
contract do not need rewrites.

Inputs already present in the per-topic subgraph: weighted edges. Phase 2
adds a `communities` array to `TopicSnapshot.payload`:

```ts
interface CommunityCell {
  id: number;
  label: string | null;              // null if unlabeled
  pmids: string[];
  modularity_contribution: number;
}

interface TopicSnapshotV2 extends TopicSnapshot {
  communities?: CommunityCell[];
}
```

Cron addition: after building per-topic edges, run Louvain (Leiden if a
solid Leiden JS implementation is available) via
`graphology-communities-louvain`. Discard communities with fewer than 4
papers; reassign their members to the nearest larger community by edge
weight. Labels are deferred (or generated via an LLM in a follow-up batch).

Frontend addition: in `topic` view, color nodes by `community_id` and draw
faint convex-hull outlines around each community. Clicking a community
hull would zoom into it (third level), but the V2 plan ships hulls first
and the click-to-zoom interaction in a subsequent iteration.

## 12. Open decisions (TBD in plan)

1. **`paper_authors.is_last_author`**: confirm or add column + backfill
   (see §7.4).
2. **Common-name guard threshold**: 200 is a starting heuristic; review
   after first cron output by inspecting top-N coauthor pairs in QA.
3. **Mobile fallback default**: open the modal automatically on first
   visit, or always require the CTA tap? Default: require tap, so the
   feed remains visible.
4. **Snapshot staleness warning UI**: discreet badge vs full banner.
5. **Admin trigger UI**: a button in `/admin` or just the API endpoint
   for now.
6. **Empty-topic policy**: a topic with 0 papers (newly added, not yet
   reflected) — render the galaxy node with `paper_count = 0` and an
   empty topic view, or hide entirely? Default: hide until `paper_count
   > 0`.

## 13. Test plan

### 13.1 Unit (Vitest)

- `lib/graph/build-snapshots.ts`
  - Edge accumulator merges types correctly on a pair seen across
    citation, coauthor, mention passes.
  - Topic reinforcement does not create new edges; only modifies weight
    and `types` on existing edges.
  - Common-name guard drops a fake high-frequency name (synthesized
    fixture).
  - Per-topic cap of 80 selects highest-degree papers; tie-breaks via
    `citation_count`, then `publication_date`.
  - Galaxy aggregation sums weights only across cross-topic edges.
- `lib/graph/induced-subgraph.ts` keeps existing test coverage; if not
  reused, deleted.

### 13.2 Integration

- API: `/api/graph/galaxy` returns the latest snapshot row and the
  `X-Graph-Computed-At` header is set.
- API: `/api/graph/topic/[slug]` 404s on unknown slug.
- Cron: idempotency — running the function twice in a row produces
  identical `payload` JSONB for the same input.

### 13.3 E2E (manual QA on a staging branch)

- Click a topic in galaxy → topic view inline-expands.
- Click a paper → side sheet opens with metadata and neighbors.
- Click `Open` in side sheet → `/paper/[pmid]`.
- Browser Back from `/paper/[pmid]` → returns to topic view with focus
  restored (URL sync).
- Mobile: CTA opens modal; sheet bottom-sheets in.
- Reload at any URL with `?map=...` restores the same view.

## 14. Cost analysis

| Axis | Current (90d) | Redesign (DB-wide) | Delta |
|---|---|---|---|
| Inngest steps/month | 0 (no cron) | ~90 | +90 |
| Supabase storage | 0 | ~1 MB | +1 MB |
| API CPU (per request) | ~50ms | ~5ms (single row read) | −45ms |
| Vercel invocations/month | unchanged | unchanged (CDN caching) | 0 |
| Initial development | — | ~8–12 hours | one-off |

Sustained additional monthly cost: effectively **$0**.

## 15. Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| Cron run fails silently | Graph becomes stale (≥24h) | `stale: true` API flag; Discord alert on the operations channel; admin trigger endpoint for manual recovery |
| `topic_tags` rule changes | Snapshot inconsistency for one cycle | Auto-resolves next cron; manual trigger available |
| Common-name coauthor collisions | False edges between unrelated groups | 200-paper guard; QA review after first run; threshold tunable |
| Snapshot size grows beyond JSONB practical limit | Slow API responses | Per-topic cap (80) bounds size; galaxy is 13×13 at most. Far from JSONB hard limits |
| `paper_authors.is_last_author` missing | Half of coauthor signal lost | Pre-implementation verification (§7.4); migration ready as fallback |
| Topic added to `topics.ts` after a cron run | Galaxy missing the node until next run | Admin trigger; documented in the topics.ts addition runbook |

## 16. Rollout

1. **Phase 0 — verification** (≤1 hour): confirm
   `paper_authors.is_last_author` exists; if not, ship migration 00043
   and backfill alone first.
2. **Phase 1 — backend** (one PR): migration 00042 + Inngest function +
   API routes + unit tests. Cron is initially disabled (manual trigger
   only) to verify output before scheduling.
3. **Phase 2 — frontend** (one PR): rewritten panel, extended D3 host,
   URL sync, mobile CTA, E2E QA on a preview deploy.
4. **Phase 3 — schedule cron** (small PR): flip cron schedule on after
   one week of manual triggers without incident.
5. **Phase 4 — auto community** (later, separate spec): Phase 2 from §11.

A feature flag is not used; the panel rewrite happens in one shot and
ships behind the normal preview-deploy gate. The old `/api/connections/recent`
endpoint is deleted in Phase 2's PR to avoid orphan code.

## 17. Out-of-scope follow-ups

- Author-centric view (galaxy of authors instead of topics).
- Time-slider animation over publication date.
- Citation depth controls (1-hop, 2-hop, …).
- A `/map` standalone page; current design uses the inline panel only.

---

End of spec. Implementation plan to follow once approved.
