# Home Initial-Load Performance Design

## Goal

Reduce the time until the home feed feels complete without changing its visible behavior, feed ordering, authentication semantics, or responsive layout.

## Scope

This first pass contains three bounded changes:

1. Stop mounting the desktop-only right rail on viewports below `xl`, and defer its database-status request and Realtime presence connection until the browser is idle.
2. Move the initial paper query into an async child inside the existing Suspense boundary so the shell and feed skeleton can stream during an ISR cache miss or regeneration.
3. Introduce a home-feed projection that fetches only the author fields rendered by cards, caps embedded authors at three, and carries the true author count separately.

The first pass does not redesign the page, remove the relationship graph, alter pagination, change feed ranking, or introduce a new dependency.

## Current Evidence

- Warm production document requests returned in roughly 70–113 ms, while the first probe returned in roughly 312 ms and reported a Vercel cache hit.
- The first cold probes of `/api/graph/galaxy` and `/api/db-status` took roughly 1.16 s and 1.42 s respectively.
- The right rail is hidden with CSS below `xl` but is still rendered by React, so its hooks run on viewports where the rail is not visible.
- `src/app/page.tsx` awaits `fetchInitialPapers()` before returning the Suspense boundary, which prevents that boundary from streaming while the query is pending.
- Feed cards display at most three author names but the shared feed projection fetches every author and unused `first_name` and `affiliation` values.

## Architecture

### Responsive right-rail mount gate

Add a small client hook that tracks a media query with `matchMedia`. `HomePage` will render `RightRail` only when `(min-width: 1280px)` matches. The right rail will schedule its data/realtime subtree after browser idle, with a timeout fallback so it remains functional on browsers without `requestIdleCallback`.

The CSS classes remain as layout protection, but JavaScript conditional rendering becomes the side-effect boundary. Resizing across the breakpoint mounts or unmounts the rail and its subscriptions cleanly.

### Streaming initial feed

`Page` becomes synchronous and returns the Suspense boundary immediately. A nested async `TimelineFeed` component owns `fetchInitialPapers()` and renders `HomePage` after the data resolves. Existing ISR revalidation remains at 600 seconds, and the current skeleton remains the fallback.

### Slim initial author payload

Keep the existing shared `PAPER_FEED_SELECT` unchanged because API personalization and other feeds may rely on its full row shape. Add a dedicated initial-feed projection and row type for the home ISR query. It will select only `last_name`, `initials`, and `position`, limit the embedded author rows to three, and include an aggregate author count.

`PaperWithJournal` gains an optional `author_count`. `PaperAuthors` and the card's author-count label use this value when present and fall back to the loaded array length elsewhere. This preserves existing consumers and avoids a cross-application migration in the first pass.

Abstract deferral and persisted `topic_tags` adoption are intentionally deferred. They require a separate card-expansion data path and broader DTO changes, which would increase behavioral risk beyond this first pass.

## Data Flow

1. The home route returns the page shell and feed skeleton immediately when the feed query is pending.
2. `TimelineFeed` resolves the cached/ISR Supabase query and streams `HomePage` with initial data.
3. The feed renders the same ten papers in the same order with up to three author records plus the true total count.
4. The graph keeps its existing viewport gate.
5. The right rail does not exist below `xl`; at `xl` and above it mounts after idle and then starts DB-status and presence work.

## Error Handling

- Initial-feed query errors retain the current empty-feed fallback and server log.
- Media-query setup must tolerate server rendering and browsers without `addEventListener` on `MediaQueryList` by using the existing modern API target only after mount.
- Idle scheduling falls back to `setTimeout(0)` and cancels pending work on unmount.
- Missing author aggregates fall back to the number of loaded author rows.

## Compatibility Constraints

- No new package.
- No database migration.
- No change to anonymous or authenticated feed semantics.
- No removal of AI summaries, abstracts, graph panels, ads, or right-rail features.
- No shared `PAPER_FEED_SELECT` narrowing in this pass.

## Tests

1. A page-source test proves `fetchInitialPapers()` runs inside the async Suspense child rather than before the boundary.
2. A responsive mount test proves the right rail is absent below `xl`, appears above `xl`, and cleans up after resizing down.
3. An idle-boundary test proves right-rail children do not run before the idle callback.
4. A feed transformation test proves a capped author list still exposes the full author count and falls back safely when the aggregate is missing.
5. Existing unit tests, lint, typecheck/build, and production route behavior remain green.

## Success Criteria

- Mobile and tablet home loads do not request `/api/db-status` or open the home presence channel.
- Desktop right-rail work starts only after the main browser task becomes idle.
- Cold ISR rendering can emit the existing shell/skeleton before Supabase finishes.
- Initial home paper rows transfer no author `first_name` or `affiliation` fields and contain at most three embedded authors.
- Feed ordering, card content, author totals, pagination, auth behavior, and responsive appearance remain unchanged.
