// SERVER ONLY. Do NOT import this module from client components — it reads
// COMMUNITY_SALT from process.env which must never leak to the browser.
import { createHash } from "node:crypto";

/**
 * Deterministic per-(paper, user) anonymous identifier for the community feature.
 *
 * The salt MUST stay on the server. We intentionally do NOT hash user_id alone
 * so that the same user gets a different anon_id on each paper — this makes it
 * harder to correlate a real user's activity across threads while still giving
 * each paper thread a stable handle (e.g. "익명 #a2f3c9") to follow a
 * conversation.
 */
export function generateAnonId(pmid: string, userId: string): string {
  const salt = process.env.COMMUNITY_SALT;
  if (!salt) {
    throw new Error("COMMUNITY_SALT env var is required to derive anon_id");
  }
  return createHash("sha256")
    .update(`${pmid}|${userId}|${salt}`)
    .digest("hex")
    .slice(0, 6);
}

/** Format for UI display: "익명 #a2f3c9" */
export function formatAnonId(anonId: string): string {
  return `익명 #${anonId}`;
}
