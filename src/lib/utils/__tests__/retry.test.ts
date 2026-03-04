import { describe, it, expect, vi, beforeEach } from "vitest";
import { withRetry } from "../retry";

function makeResponse(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers });
}

describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("returns response immediately on success", async () => {
    const fn = vi.fn().mockResolvedValue(makeResponse(200));
    const result = await withRetry(fn);
    expect(result.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on 429 and succeeds on second attempt", async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(429))
      .mockResolvedValueOnce(makeResponse(200));

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, jitter: false });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on 500 server error", async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(500))
      .mockResolvedValueOnce(makeResponse(200));

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, jitter: false });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws after maxAttempts exceeded on network error", async () => {
    vi.useRealTimers();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network failure"))
      .mockRejectedValueOnce(new Error("Network failure"))
      .mockRejectedValueOnce(new Error("Network failure"));

    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 1, jitter: false })
    ).rejects.toThrow("Network failure");
    expect(fn).toHaveBeenCalledTimes(3);
    vi.useFakeTimers();
  });

  it("returns last error response when maxAttempts reached on 5xx", async () => {
    const fn = vi.fn().mockResolvedValue(makeResponse(503));

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, jitter: false });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe(503);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("respects Retry-After header in seconds", async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(429, { "Retry-After": "2" }))
      .mockResolvedValueOnce(makeResponse(200));

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, jitter: false });
    // Advance by 2000ms (Retry-After: 2 seconds)
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(result.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 404", async () => {
    const fn = vi.fn().mockResolvedValue(makeResponse(404));

    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 });
    expect(result.status).toBe(404);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry on 200", async () => {
    const fn = vi.fn().mockResolvedValue(makeResponse(200));

    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 });
    expect(result.status).toBe(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("uses default options when none provided", async () => {
    const fn = vi.fn().mockResolvedValue(makeResponse(200));
    const result = await withRetry(fn);
    expect(result.status).toBe(200);
  });
});
