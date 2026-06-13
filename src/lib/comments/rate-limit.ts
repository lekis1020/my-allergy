import { distributedRateLimit } from "@/lib/utils/distributed-rate-limit";

// 5 new comments per user per minute (write-path spam control).
// Distributed so the limit holds across serverless instances.
export const commentWriteLimiter = distributedRateLimit({
  windowMs: 60_000,
  maxRequests: 5,
  prefix: "comments",
});
