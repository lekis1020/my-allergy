import { describe, expect, it, vi } from "vitest";
import { scheduleAfterIdle } from "@/lib/browser/scheduling";

describe("scheduleAfterIdle", () => {
  it("uses requestIdleCallback with a one-second timeout", () => {
    const callback = vi.fn();
    const requestIdleCallback = vi.fn(() => 17);
    const cancelIdleCallback = vi.fn();
    const scheduler = {
      requestIdleCallback,
      cancelIdleCallback,
      setTimeout: vi.fn(),
      clearTimeout: vi.fn(),
    };

    scheduleAfterIdle(callback, scheduler);

    expect(requestIdleCallback).toHaveBeenCalledWith(callback, { timeout: 1000 });
    expect(scheduler.setTimeout).not.toHaveBeenCalled();
  });

  it("falls back to a zero-delay timeout", () => {
    const callback = vi.fn();
    const setTimeout = vi.fn(() => 23);
    const scheduler = {
      setTimeout,
      clearTimeout: vi.fn(),
    };

    scheduleAfterIdle(callback, scheduler);

    expect(setTimeout).toHaveBeenCalledWith(callback, 0);
  });

  it("cancels the scheduled idle callback", () => {
    const cancelIdleCallback = vi.fn();
    const scheduler = {
      requestIdleCallback: vi.fn(() => 42),
      cancelIdleCallback,
      setTimeout: vi.fn(),
      clearTimeout: vi.fn(),
    };

    const cleanup = scheduleAfterIdle(vi.fn(), scheduler);
    cleanup();

    expect(cancelIdleCallback).toHaveBeenCalledWith(42);
    expect(scheduler.clearTimeout).not.toHaveBeenCalled();
  });

  it("clears the fallback timeout", () => {
    const clearTimeout = vi.fn();
    const scheduler = {
      setTimeout: vi.fn(() => 29),
      clearTimeout,
    };

    const cleanup = scheduleAfterIdle(vi.fn(), scheduler);
    cleanup();

    expect(clearTimeout).toHaveBeenCalledWith(29);
  });
});
