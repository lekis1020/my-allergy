import { describe, expect, it, vi } from "vitest";
import {
  getMediaQuerySnapshot,
  subscribeToMediaQuery,
} from "@/hooks/use-media-query";

describe("getMediaQuerySnapshot", () => {
  it("returns the current media-query match", () => {
    const target = {
      matchMedia: vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    };

    expect(getMediaQuerySnapshot("(min-width: 1280px)", target)).toBe(true);
  });

  it("returns false without a browser target", () => {
    expect(getMediaQuerySnapshot("(min-width: 1280px)", undefined)).toBe(false);
  });
});

describe("subscribeToMediaQuery", () => {
  it("removes the exact change listener it added", () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const target = {
      matchMedia: vi.fn(() => ({
        matches: false,
        addEventListener,
        removeEventListener,
      })),
    };
    const listener = vi.fn();

    const unsubscribe = subscribeToMediaQuery(
      "(min-width: 1280px)",
      listener,
      target,
    );
    unsubscribe();

    expect(addEventListener).toHaveBeenCalledWith("change", listener);
    expect(removeEventListener).toHaveBeenCalledWith("change", listener);
  });
});
