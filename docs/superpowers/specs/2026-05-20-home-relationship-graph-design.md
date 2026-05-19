# Home Relationship Graph & Layout Restructure — Design

Date: 2026-05-20
Status: Approved (pending spec review)

## Goal

Restructure the home page (`/`) so that:

1. The search box moves into the left sidebar, above the Topics panel.
2. The Timeline / For you tabs move to the top of the center column (replacing the "Home" title).
3. A new **relationship graph** sits between the tabs and the feed, showing
   citation/mention relationships among a set of papers.
4. The journal filter (currently a word cloud in the center header) moves into
   the left sidebar as a tabbed panel: **Topics / Journals**.

The relationship graph is the substantial new feature; items 1, 2, 4 are layout moves.

## Current state

- `src/components/papers/home-page.tsx` — 3-column grid
  (`[280px | feed | 320px]`). Left = `TopicMonitorPanel`, center = sticky
  header (`Home` title, Timeline/For you tabs, `SearchInput`, collapsible
  `JournalCloud`) + `PaperFeed`, right = `RightRail`.
- Timeline/For you tabs render only for logged-in users (`user && (...)`);
  `activeTab` drives `effectiveFilters.personalized`.
- `src/app/api/papers/[pmid]/connections/route.ts` already builds a
  paper-centric `{ focal, nodes, edges }` graph from `paper_citations` and
  `paper_mentions` for the detail page.
- `src/components/graph/paper-connection-graph.tsx` renders that graph with
  d3-force; it **pins a focal node** to the center.
- Account ↔ paper links live in `bookmarks` (`user_id`, `pmid`),
  `paper_comments` (`user_id`, `paper_pmid`), `paper_likes` (`user_id`,
  `paper_pmid`).

No database migration is required — `paper_citations` and `paper_mentions`
already hold the edge data.

## Layout

### Left sidebar

A new `HomeSidebar` component replaces the bare `TopicMonitorPanel`:

1. **Search** — `SearchInput` moved from the center header. Drives `filters.q`.
2. **Tabbed panel** with two tabs:
   - **Topics** → existing `TopicMonitorPanel` (unchanged).
   - **Journals** → new `JournalFilterPanel`: the 7 journals as a vertical list
     of toggle rows (multi-select), driving `filters.journals`. Replaces the
     center-header `JournalCloud`; `JournalCloud` is no longer used on the home
     page.

### Center column

Sticky header becomes **only the Timeline / For you tabs**:

- Not logged in → a single `Timeline` tab.
- Logged in → `Timeline` + `For you`, with `For you` active by default
  (unchanged default).

Below the header, in order:

1. **Relationship graph** (`RelationshipGraphPanel`).
2. `FilterBar` (only when filters are active) and the active-trial banner —
   unchanged, kept directly above the feed.
3. **Feed** (`PaperFeed`) — unchanged.

### Right column

`RightRail` — unchanged.

## Relationship graph

### Behaviour by tab

| Active tab | Graph contents |
|------------|----------------|
| Timeline (any visitor) | **Global graph** — trending papers + citation/mention edges among them |
| For you (logged in) | **Account graph** — papers the user bookmarked, commented on, or liked + citation/mention edges among them |

The graph contents follow the active tab, consistent with the feed. A
logged-in user on the Timeline tab sees the global graph.

### Components

- `src/components/graph/relationship-graph.tsx` — a **focal-free** d3-force
  graph. Nodes are papers (journal-colored circle + abbreviation, title label);
  edges are citation (dashed/grey) or mention (solid/blue) or both (violet),
  matching the existing detail-page styling. Nodes are clickable
  (`/paper/[pmid]`), draggable, and the canvas is zoomable. Rendered inline at
  ~360px tall. Reuses the d3 patterns from `paper-connection-graph.tsx`; shared
  node/edge TypeScript types are factored into a small shared module rather
  than duplicated.
- `src/components/papers/relationship-graph-panel.tsx` — owns data fetching
  and states:
  - chooses the endpoint by active tab + auth,
  - loading skeleton,
  - empty state (logged-in user with no bookmarked/commented/liked papers, or
    a set with no edges) → a short prompt, e.g. "북마크·댓글·좋아요한 논문이
    모이면 관계도가 그려집니다",
  - error state → quiet inline message, never blocks the feed.

### API

Two route handlers returning the same shape — `{ nodes, edges }` (no `focal`):

```ts
interface GraphNode {
  pmid: string;
  title: string;
  journal_abbreviation: string;
  journal_color: string;
  publication_date: string;
}
interface GraphEdge {
  source: string;          // pmid
  target: string;          // pmid
  type: "citation" | "mention" | "both";
}
```

- `GET /api/me/connections` — **auth required** (`createServerAuthClient`;
  401 / empty when anonymous).
  1. Collect the user's pmids from `bookmarks`, `paper_comments`,
     `paper_likes`. Cap at the most recent **60** pmids (by interaction
     recency) to keep the graph readable and the query bounded.
  2. Find `paper_citations` and `paper_mentions` rows where **both** endpoints
     are in that pmid set (the induced sub-graph).
  3. Fetch paper metadata for the pmids that have at least one edge; return
     them as `nodes` plus the `edges`.
- `GET /api/connections/trending` — no auth.
  1. Take the top trending pmids (most-cited recent papers, same selection
     basis as the trending feed), capped at **60**.
  2. Same induced-sub-graph edge build as above.

The trending graph is the same for everyone and gets a short CDN cache header
(`s-maxage`). The account graph is per-user and is **not** CDN-cached. Edge-
aggregation logic is extracted into a shared helper so both routes and the unit
tests use one implementation.

### Edge cases

- Anonymous user: `For you` tab is not rendered, so `/api/me/connections` is
  only ever called for authenticated sessions.
- A user with papers but no edges among them → empty state (not an error).
- Node cap (60) prevents pathological graphs; nodes with no edges are dropped.

## Files

**New**

- `src/components/graph/relationship-graph.tsx`
- `src/components/papers/relationship-graph-panel.tsx`
- `src/components/layout/home-sidebar.tsx`
- `src/components/layout/journal-filter-panel.tsx`
- `src/app/api/me/connections/route.ts`
- `src/app/api/connections/trending/route.ts`
- `src/lib/graph/induced-subgraph.ts` — shared edge-aggregation helper
- shared graph types module (e.g. `src/lib/graph/types.ts`)

**Modified**

- `src/components/papers/home-page.tsx` — layout restructure (sidebar, tabs to
  top, graph panel, search/journals removed from center header).

**No longer used on the home page**

- `JournalCloud` — left in place for now; removed from `home-page.tsx` imports.

## Testing

- Vitest unit tests for `src/lib/graph/induced-subgraph.ts`: given a pmid set
  and citation/mention rows, it returns only edges with both endpoints in the
  set, with correct `type` (`citation` / `mention` / `both`), and drops
  edgeless nodes.
- Existing detail-page graph tests must still pass (the focal graph component
  is unchanged; only shared types are extracted).

## Out of scope

- No changes to the paper detail page graph.
- No new database tables or migrations.
- No persistence of graph layout/positions.
