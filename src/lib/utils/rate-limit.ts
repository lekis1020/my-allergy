interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  cleanupIntervalMs?: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

interface WindowEntry {
  timestamps: number[];
  lastCleanup: number;
}

export function rateLimit(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? 60_000;
  const maxRequests = options.maxRequests ?? 60;
  const cleanupIntervalMs = options.cleanupIntervalMs ?? 300_000;

  const store = new Map<string, WindowEntry>();

  // Periodic cleanup to prevent unbounded memory growth
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      const valid = entry.timestamps.filter((t) => now - t < windowMs);
      if (valid.length === 0) {
        store.delete(key);
      } else {
        entry.timestamps = valid;
        entry.lastCleanup = now;
      }
    }
  }, cleanupIntervalMs);

  // Allow GC in test / serverless environments
  if (typeof interval === "object" && interval.unref) {
    interval.unref();
  }

  function check(ip: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - windowMs;

    let entry = store.get(ip);
    if (!entry) {
      entry = { timestamps: [], lastCleanup: now };
      store.set(ip, entry);
    }

    // Lazy cleanup: drop expired timestamps
    entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

    const count = entry.timestamps.length;
    const resetAt = entry.timestamps.length > 0
      ? entry.timestamps[0] + windowMs
      : now + windowMs;

    if (count >= maxRequests) {
      return { success: false, remaining: 0, resetAt };
    }

    entry.timestamps.push(now);
    return { success: true, remaining: maxRequests - count - 1, resetAt };
  }

  return { check };
}
