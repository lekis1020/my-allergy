import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { rateLimit } from "./rate-limit";

interface DistributedRateLimitOptions {
  windowMs: number;
  maxRequests: number;
  /** Key namespace in Redis, e.g. "ondemand" or "comments". */
  prefix: string;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  /** Epoch ms when the window resets. */
  resetAt: number;
}

interface AsyncLimiter {
  check(key: string): Promise<RateLimitResult>;
}

/**
 * Rate limiter that survives the serverless many-instances model.
 *
 * When UPSTASH_REDIS_REST_URL / _TOKEN are set it uses an Upstash sliding
 * window (atomic, shared across all instances). Without them it falls back
 * to the in-memory limiter — correct for local dev and a single instance,
 * best-effort under serverless fan-out. This lets the code ship before the
 * Upstash project exists; setting the two env vars activates it with no
 * code change.
 *
 * Reserve this for low-frequency, high-stakes per-user limits (external API
 * quota, write-path spam). High-frequency IP throttles stay on the
 * in-memory limiter — putting them on Redis would burn quota and add a
 * round-trip to hot read paths.
 */
export function distributedRateLimit(
  options: DistributedRateLimitOptions,
): AsyncLimiter {
  const { windowMs, maxRequests, prefix } = options;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    const redis = new Redis({ url, token });
    const windowSeconds = Math.max(1, Math.round(windowMs / 1000));
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s`),
      prefix: `ratelimit:${prefix}`,
      analytics: false,
    });

    return {
      async check(key: string): Promise<RateLimitResult> {
        try {
          const { success, remaining, reset } = await limiter.limit(key);
          return { success, remaining, resetAt: reset };
        } catch (error) {
          // Never let a Redis hiccup hard-block a request. Fail open.
          console.warn(`[rate-limit:${prefix}] Upstash check failed, allowing:`, error);
          return { success: true, remaining: maxRequests, resetAt: Date.now() + windowMs };
        }
      },
    };
  }

  // Fallback: in-memory limiter wrapped in the async interface.
  const mem = rateLimit({ windowMs, maxRequests });
  return {
    async check(key: string): Promise<RateLimitResult> {
      return mem.check(key);
    },
  };
}
