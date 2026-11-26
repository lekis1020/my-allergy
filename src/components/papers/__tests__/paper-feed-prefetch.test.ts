import { describe, it, expect } from "vitest";
import { shouldPrefetchNextPage } from "../paper-feed";

describe("shouldPrefetchNextPage", () => {
  const nearEnd = {
    lastRenderedIndex: 8,
    itemCount: 10,
    hasMore: true,
    isLoadingMore: false,
  };

  it("does not prefetch before the user scrolls", () => {
    expect(
      shouldPrefetchNextPage({ ...nearEnd, hasUserScrolled: false }),
    ).toBe(false);
  });

  it("prefetches once the user has scrolled and the overscan reaches the tail", () => {
    expect(
      shouldPrefetchNextPage({ ...nearEnd, hasUserScrolled: true }),
    ).toBe(true);
  });

  it("does not prefetch when more pages are already loading", () => {
    expect(
      shouldPrefetchNextPage({
        ...nearEnd,
        hasUserScrolled: true,
        isLoadingMore: true,
      }),
    ).toBe(false);
  });

  it("does not prefetch when hasMore is false", () => {
    expect(
      shouldPrefetchNextPage({
        ...nearEnd,
        hasUserScrolled: true,
        hasMore: false,
      }),
    ).toBe(false);
  });

  it("does not prefetch when the rendered tail is still far from the end", () => {
    expect(
      shouldPrefetchNextPage({
        hasUserScrolled: true,
        lastRenderedIndex: 2,
        itemCount: 10,
        hasMore: true,
        isLoadingMore: false,
      }),
    ).toBe(false);
  });
});
