import { rateLimit } from "@/lib/utils/rate-limit";

// 5 new comments per user per minute (write-path spam control).
export const commentWriteLimiter = rateLimit({
  windowMs: 60_000,
  maxRequests: 5,
});
