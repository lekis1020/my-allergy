import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { observeFeedEnd } from "../feed-pagination";

describe("observeFeedEnd", () => {
  const sentinel = {} as Element;
  const observe = vi.fn();
  const disconnect = vi.fn();
  let observerCallback: IntersectionObserverCallback;
  let observerOptions: IntersectionObserverInit | undefined;

  beforeEach(() => {
    observe.mockReset();
    disconnect.mockReset();
    observerOptions = undefined;

    class IntersectionObserverStub {
      observe = observe;
      disconnect = disconnect;

      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        observerCallback = callback;
        observerOptions = options;
      }
    }

    vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function startObserver(overrides: Partial<Parameters<typeof observeFeedEnd>[1]> = {}) {
    const onLoadMore = vi.fn();
    const cleanup = observeFeedEnd(sentinel, {
      hasMore: true,
      isLoadingMore: false,
      thresholdPixels: 660,
      onLoadMore,
      ...overrides,
    });

    return { cleanup, onLoadMore };
  }

  it("does not load when the sentinel is not intersecting", () => {
    const { onLoadMore } = startObserver();

    observerCallback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("loads once when the sentinel intersects while a load is pending", () => {
    const { onLoadMore } = startObserver();
    const entries = [{ isIntersecting: true } as IntersectionObserverEntry];

    observerCallback(entries, {} as IntersectionObserver);
    observerCallback(entries, {} as IntersectionObserver);

    expect(onLoadMore).toHaveBeenCalledOnce();
  });

  it.each([
    { hasMore: false, isLoadingMore: false },
    { hasMore: true, isLoadingMore: true },
  ])("does not load when pagination is guarded by %o", (guards) => {
    const { onLoadMore } = startObserver(guards);

    observerCallback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("observes the sentinel with the configured bottom root margin", () => {
    startObserver();

    expect(observe).toHaveBeenCalledWith(sentinel);
    expect(observerOptions).toEqual({ rootMargin: "0px 0px 660px 0px" });
  });

  it("disconnects the observer during cleanup", () => {
    const { cleanup } = startObserver();

    cleanup();

    expect(disconnect).toHaveBeenCalledOnce();
  });
});
