# Home Initial-Load Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the home page stream its feed fallback immediately, avoid invisible right-rail work on narrow screens, and reduce the initial author payload without changing visible behavior.

**Architecture:** Keep the existing ISR and feed APIs. Move the initial query into an async Suspense child, introduce a responsive/idle client boundary around `RightRail`, and use a home-only Supabase projection that caps embedded authors while carrying an aggregate total.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase/PostgREST, Vitest.

---

## File map

| Path | Action | Responsibility |
|---|---|---|
| `src/app/__tests__/page.test.tsx` | Create | Prove the route returns Suspense before invoking the feed query |
| `src/app/page.tsx` | Modify | Move the initial fetch into async `TimelineFeed` |
| `src/lib/browser/scheduling.ts` | Create | Cancellable idle scheduling with timeout fallback |
| `src/lib/browser/__tests__/scheduling.test.ts` | Create | Verify idle/fallback scheduling and cleanup |
| `src/hooks/use-media-query.ts` | Create | `useSyncExternalStore` media-query subscription |
| `src/hooks/__tests__/use-media-query.test.ts` | Create | Verify media snapshot and subscription cleanup |
| `src/components/layout/responsive-right-rail.tsx` | Create | Mount the right rail only at `xl` and after idle |
| `src/components/papers/home-page.tsx` | Modify | Replace direct `RightRail` rendering with the responsive boundary |
| `src/lib/papers/__tests__/transform.test.ts` | Create | Verify aggregate author count mapping and safe fallbacks |
| `src/components/papers/__tests__/paper-authors.test.tsx` | Create | Verify capped author rendering uses the full total |
| `src/lib/papers/transform.ts` | Modify | Add initial-feed projection and aggregate mapping |
| `src/lib/papers/fetch-initial.ts` | Modify | Use the slim projection and cap embedded authors |
| `src/types/filters.ts` | Modify | Add optional `author_count` to feed DTO |
| `src/components/papers/paper-authors.tsx` | Modify | Accept an optional total |
| `src/components/papers/paper-card.tsx` | Modify | Display and pass the aggregate author total |

---

### Task 1: Stream the initial feed inside Suspense

**Files:**
- Create: `src/app/__tests__/page.test.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";

const fetchInitialPapers = vi.fn(async () => ({
  papers: [], total: 0, limit: 10, hasMore: false, nextCursor: null,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/papers/fetch-initial", () => ({ fetchInitialPapers }));
vi.mock("@/components/papers/home-page", () => ({
  HomePage: (props: unknown) => ({ type: "mock-home", props, key: null }),
}));

import Page, { TimelineFeed } from "../page";

describe("home page streaming", () => {
  beforeEach(() => fetchInitialPapers.mockClear());

  it("returns the Suspense boundary without starting the feed query", () => {
    const result = Page();
    expect(result).not.toBeInstanceOf(Promise);
    expect(result.type).toBe(Suspense);
    expect(fetchInitialPapers).not.toHaveBeenCalled();
  });

  it("loads the initial feed inside the async child", async () => {
    const result = await TimelineFeed();
    expect(fetchInitialPapers).toHaveBeenCalledOnce();
    expect(result.props.initialData.total).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/app/__tests__/page.test.tsx`

Expected: FAIL because `Page()` returns a Promise and `TimelineFeed` is not exported.

- [ ] **Step 3: Implement the streaming boundary**

Change `src/app/page.tsx` so `Page` is synchronous and renders `<TimelineFeed />` inside the existing Suspense. Add:

```tsx
export async function TimelineFeed() {
  const initialData = await fetchInitialPapers();
  return <HomePage initialData={initialData} />;
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- src/app/__tests__/page.test.tsx`

Expected: 2 tests passed.

---

### Task 2: Gate and defer the right rail

**Files:**
- Create: `src/lib/browser/scheduling.ts`
- Create: `src/lib/browser/__tests__/scheduling.test.ts`
- Create: `src/hooks/use-media-query.ts`
- Create: `src/hooks/__tests__/use-media-query.test.ts`
- Create: `src/components/layout/responsive-right-rail.tsx`
- Modify: `src/components/papers/home-page.tsx`

- [ ] **Step 1: Write failing tests for scheduling and media subscriptions**

Create `src/lib/browser/__tests__/scheduling.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { scheduleAfterIdle } from "../scheduling";

describe("scheduleAfterIdle", () => {
  it("uses requestIdleCallback and cancels its handle", () => {
    const callback = vi.fn();
    const cancelIdleCallback = vi.fn();
    const scheduler = {
      requestIdleCallback: vi.fn(() => 17),
      cancelIdleCallback,
      setTimeout: vi.fn(() => 0),
      clearTimeout: vi.fn(),
    };

    const cancel = scheduleAfterIdle(callback, scheduler);

    expect(scheduler.requestIdleCallback).toHaveBeenCalledWith(callback, { timeout: 1_000 });
    expect(scheduler.setTimeout).not.toHaveBeenCalled();
    cancel();
    expect(cancelIdleCallback).toHaveBeenCalledWith(17);
  });

  it("falls back to a cancellable zero-delay timeout", () => {
    const callback = vi.fn();
    const clearTimeout = vi.fn();
    const scheduler = {
      setTimeout: vi.fn(() => 23),
      clearTimeout,
    };

    const cancel = scheduleAfterIdle(callback, scheduler);

    expect(scheduler.setTimeout).toHaveBeenCalledWith(callback, 0);
    cancel();
    expect(clearTimeout).toHaveBeenCalledWith(23);
  });
});
```

Create `src/hooks/__tests__/use-media-query.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { getMediaQuerySnapshot, subscribeToMediaQuery } from "../use-media-query";

describe("media-query store", () => {
  it("reads the current match", () => {
    const target = { matchMedia: vi.fn(() => ({ matches: true })) };
    expect(getMediaQuerySnapshot("(min-width: 1280px)", target)).toBe(true);
  });

  it("forwards changes and removes the listener", () => {
    const onChange = vi.fn();
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const media = { matches: false, addEventListener, removeEventListener };
    const target = { matchMedia: vi.fn(() => media) };

    const unsubscribe = subscribeToMediaQuery("(min-width: 1280px)", onChange, target);
    const listener = addEventListener.mock.calls[0][1] as () => void;
    listener();
    expect(onChange).toHaveBeenCalledOnce();
    unsubscribe();
    expect(removeEventListener).toHaveBeenCalledWith("change", listener);
  });
});
```

- [ ] **Step 2: Run both tests and verify RED**

Run: `npm test -- src/lib/browser/__tests__/scheduling.test.ts src/hooks/__tests__/use-media-query.test.ts`

Expected: FAIL because both modules are missing.

- [ ] **Step 3: Implement the browser primitives**

Create `src/lib/browser/scheduling.ts`:

```ts
export interface IdleScheduler {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
  setTimeout(callback: () => void, delay: number): number;
  clearTimeout(handle: number): void;
}

export function scheduleAfterIdle(
  callback: () => void,
  scheduler: IdleScheduler = window,
): () => void {
  if (scheduler.requestIdleCallback && scheduler.cancelIdleCallback) {
    const handle = scheduler.requestIdleCallback(callback, { timeout: 1_000 });
    return () => scheduler.cancelIdleCallback?.(handle);
  }
  const handle = scheduler.setTimeout(callback, 0);
  return () => scheduler.clearTimeout(handle);
}
```

Create `src/hooks/use-media-query.ts`:

```ts
"use client";

import { useCallback, useSyncExternalStore } from "react";

type MediaTarget = Pick<Window, "matchMedia">;

export function getMediaQuerySnapshot(query: string, target: MediaTarget = window) {
  return target.matchMedia(query).matches;
}

export function subscribeToMediaQuery(
  query: string,
  listener: () => void,
  target: MediaTarget = window,
) {
  const media = target.matchMedia(query);
  const handleChange = () => listener();
  media.addEventListener("change", handleChange);
  return () => media.removeEventListener("change", handleChange);
}

export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (listener: () => void) => subscribeToMediaQuery(query, listener),
    [query],
  );
  const getSnapshot = useCallback(() => getMediaQuerySnapshot(query), [query]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
```

- [ ] **Step 4: Verify primitive tests GREEN**

Run: `npm test -- src/lib/browser/__tests__/scheduling.test.ts src/hooks/__tests__/use-media-query.test.ts`

Expected: all tests passed.

- [ ] **Step 5: Add the responsive idle boundary**

Create `src/components/layout/responsive-right-rail.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { scheduleAfterIdle } from "@/lib/browser/scheduling";

const RightRail = dynamic(
  () => import("@/components/layout/right-rail").then((module) => module.RightRail),
  { ssr: false },
);

export function ResponsiveRightRail({ total }: { total: number }) {
  const isWide = useMediaQuery("(min-width: 1280px)");
  return isWide ? <IdleRightRail total={total} /> : null;
}

function IdleRightRail({ total }: { total: number }) {
  const [ready, setReady] = useState(false);
  useEffect(() => scheduleAfterIdle(() => setReady(true)), []);
  return ready ? <RightRail total={total} /> : null;
}
```

Replace the `RightRail` dynamic import and direct render in `home-page.tsx` with `ResponsiveRightRail`.

- [ ] **Step 6: Run lint and focused tests**

Run: `npm run lint -- src/components/layout/responsive-right-rail.tsx src/components/papers/home-page.tsx src/hooks/use-media-query.ts src/lib/browser/scheduling.ts`

Expected: exit 0.

---

### Task 3: Slim the initial author payload

**Files:**
- Create: `src/lib/papers/__tests__/transform.test.ts`
- Create: `src/components/papers/__tests__/paper-authors.test.tsx`
- Modify: `src/lib/papers/transform.ts`
- Modify: `src/lib/papers/fetch-initial.ts`
- Modify: `src/types/filters.ts`
- Modify: `src/components/papers/paper-authors.tsx`
- Modify: `src/components/papers/paper-card.tsx`

- [ ] **Step 1: Write failing transformation and rendering tests**

Create `src/lib/papers/__tests__/transform.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toPaperDto, type PaperRow } from "../transform";

const row = {
  id: "paper-1",
  pmid: "123",
  doi: null,
  title: "Example paper",
  abstract: "Example abstract",
  publication_date: "2026-09-01",
  epub_date: "2026-09-02",
  volume: null,
  issue: null,
  pages: null,
  keywords: [],
  mesh_terms: [],
  ai_summary: "Summary",
  citation_count: 2,
  journal_id: "journal-1",
  publication_types: ["Journal Article"],
  journals: {
    id: "journal-1",
    name: "Journal",
    abbreviation: "J",
    color: "#000000",
    slug: "journal",
  },
  paper_authors: [
    { last_name: "Alpha", initials: "A", position: 1 },
    { last_name: "Beta", initials: "B", position: 2 },
    { last_name: "Gamma", initials: "G", position: 3 },
  ],
  author_count: [{ count: 8 }],
} as unknown as PaperRow;

describe("toPaperDto author totals", () => {
  it("maps a full count while normalizing omitted author details", () => {
    const dto = toPaperDto(row);
    expect(dto.author_count).toBe(8);
    expect(dto.authors[0].first_name).toBeNull();
    expect(dto.authors[0].affiliation).toBeNull();
  });

  it("falls back to the loaded author count", () => {
    const withoutAggregate = { ...row, author_count: undefined } as PaperRow;
    expect(toPaperDto(withoutAggregate).author_count).toBe(3);
  });
});
```

Create `src/components/papers/__tests__/paper-authors.test.tsx`:

```tsx
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AuthorSummary, PaperWithJournal } from "@/types/filters";
import { PaperAuthors } from "../paper-authors";
import { PaperCard } from "../paper-card";

const authors: AuthorSummary[] = [
  { last_name: "Alpha", first_name: null, initials: "A", affiliation: null, position: 1 },
  { last_name: "Beta", first_name: null, initials: "B", affiliation: null, position: 2 },
  { last_name: "Gamma", first_name: null, initials: "G", affiliation: null, position: 3 },
];

const paper: PaperWithJournal = {
  id: "paper-1",
  pmid: "123",
  doi: null,
  title: "Example paper",
  abstract: "Example abstract",
  publication_date: "2026-09-02",
  volume: null,
  issue: null,
  pages: null,
  keywords: [],
  mesh_terms: [],
  citation_count: 0,
  journal_id: "journal-1",
  journal_name: "Journal",
  journal_abbreviation: "J",
  journal_color: "#000000",
  journal_slug: "journal",
  topic_tags: [],
  authors,
  author_count: 8,
};

describe("capped author display", () => {
  it("shows remaining authors from the full total", () => {
    const html = renderToStaticMarkup(<PaperAuthors authors={authors} total={8} />);
    expect(html).toContain("+5 more");
  });

  it("shows the full total on a paper card", () => {
    const html = renderToStaticMarkup(<PaperCard paper={paper} />);
    expect(html).toContain("8 authors");
  });
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/lib/papers/__tests__/transform.test.ts src/components/papers/__tests__/paper-authors.test.tsx`

Expected: FAIL because the aggregate count is not mapped or rendered.

- [ ] **Step 3: Implement the DTO and component changes**

Add `INITIAL_PAPER_FEED_SELECT`, matching the shared columns but selecting:

```ts
paper_authors (last_name, initials, position),
author_count:paper_authors (count)
```

Make `PaperRow.paper_authors[].first_name` and `.affiliation` optional, add optional `author_count`, normalize missing values to `null`, and set the DTO's optional `author_count` to the aggregate or loaded-array fallback.

Add `author_count?: number` to `PaperWithJournal`. Add `total?: number` to `PaperAuthors`; calculate remaining names from `total ?? authors.length`. Pass the total from `PaperCard` and show it in the author label.

Change `fetchInitialPapers()` to use `INITIAL_PAPER_FEED_SELECT` and append `.limit(3, { referencedTable: "paper_authors" })` before its range.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- src/lib/papers/__tests__/transform.test.ts src/components/papers/__tests__/paper-authors.test.tsx`

Expected: all tests passed.

---

### Task 4: Full verification

**Files:** all modified files.

- [ ] **Step 1: Run the entire unit suite**

Run: `npm test`

Expected: 22+ test files and 194+ tests passed, with no new warnings.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: exit 0.

- [ ] **Step 3: Run the production build/typecheck**

Run: `npm run build`

Expected: exit 0 and `/` remains prerendered with 600-second revalidation.

- [ ] **Step 4: Review the diff**

Run: `git diff --check && git status --short && git diff --stat`

Expected: no whitespace errors and only plan-scoped files changed.

- [ ] **Step 5: Commit the implementation**

```bash
git add -- src/app/page.tsx src/app/__tests__/page.test.tsx src/lib/browser src/hooks/use-media-query.ts src/hooks/__tests__/use-media-query.test.ts src/components/layout/responsive-right-rail.tsx src/components/papers/home-page.tsx src/lib/papers/transform.ts src/lib/papers/fetch-initial.ts src/lib/papers/__tests__/transform.test.ts src/types/filters.ts src/components/papers/paper-authors.tsx src/components/papers/paper-card.tsx src/components/papers/__tests__/paper-authors.test.tsx docs/superpowers/plans/2026-09-26-home-initial-load-performance.md
git commit -m "perf: improve home initial loading"
```
