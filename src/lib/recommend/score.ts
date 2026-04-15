/**
 * Personalization Phase 1 — scoring logic.
 *
 * score =
 *     2.0 * journal_affinity       (user subscribed / bookmarked the journal)
 *   + 1.5 * topic_affinity         (keyword alert matches title/abstract/keywords)
 *   + 1.0 * recency_decay          (exp(-days/30), 30-day half-life-ish)
 *   + 0.5 * ln(1 + citation_count)
 *   + 3.0 * interested_match       (explicit 👍 on this pmid)
 *   - 5.0 * not_interested_match   (same journal OR shared keyword/mesh as a 👎ed paper)
 */

export interface ScoreInputs {
  pmid: string;
  journalSlug: string;
  publicationDate: string | null;
  citationCount: number | null;
  keywords: string[];
  meshTerms: string[];
  title: string;
  abstract: string | null;
}

export interface UserAffinity {
  /** Journal slugs the user subscribed to or bookmarked (weighted set). */
  journalSlugs: Set<string>;
  /** Lower-cased keyword alerts the user configured. */
  keywordAlerts: string[];
  /** PMIDs the user explicitly marked 👍. */
  interestedPmids: Set<string>;
  /** PMIDs the user explicitly marked 👎. */
  notInterestedPmids: Set<string>;
  /** Journal slugs that appeared in any 👎 feedback. */
  dislikedJournalSlugs: Set<string>;
  /** Lower-cased keyword/mesh tokens that appeared in any 👎 feedback. */
  dislikedTokens: Set<string>;
}

export const WEIGHTS = {
  journal: 2.0,
  topic: 1.5,
  recency: 1.0,
  citation: 0.5,
  interested: 3.0,
  notInterested: 5.0,
} as const;

export const RECENCY_HALF_LIFE_DAYS = 30;

export function recencyDecay(
  publicationDate: string | null,
  now: Date = new Date()
): number {
  if (!publicationDate) return 0;
  const pub = new Date(publicationDate);
  if (Number.isNaN(pub.getTime())) return 0;
  const days = Math.max(0, (now.getTime() - pub.getTime()) / (1000 * 60 * 60 * 24));
  return Math.exp(-days / RECENCY_HALF_LIFE_DAYS);
}

export function citationBoost(count: number | null): number {
  if (!count || count <= 0) return 0;
  return Math.log(1 + count);
}

function keywordMatches(input: ScoreInputs, keywordLower: string): boolean {
  if (!keywordLower) return false;
  if (input.title.toLowerCase().includes(keywordLower)) return true;
  if (input.abstract && input.abstract.toLowerCase().includes(keywordLower)) return true;
  if (input.keywords.some((k) => k.toLowerCase().includes(keywordLower))) return true;
  if (input.meshTerms.some((m) => m.toLowerCase().includes(keywordLower))) return true;
  return false;
}

export function topicAffinity(input: ScoreInputs, affinity: UserAffinity): number {
  if (affinity.keywordAlerts.length === 0) return 0;
  const hits = affinity.keywordAlerts.filter((kw) => keywordMatches(input, kw)).length;
  if (hits === 0) return 0;
  // Cap at 1.0 — a single match already signals interest; avoid runaway scores.
  return Math.min(1, hits / affinity.keywordAlerts.length + 0.5);
}

export function journalAffinity(input: ScoreInputs, affinity: UserAffinity): number {
  return affinity.journalSlugs.has(input.journalSlug) ? 1 : 0;
}

export function interestedMatch(input: ScoreInputs, affinity: UserAffinity): number {
  return affinity.interestedPmids.has(input.pmid) ? 1 : 0;
}

/**
 * Penalty for papers similar to ones the user 👎ed.
 * Counts matches (same journal + shared keyword/mesh tokens) and normalises to [0, 1].
 */
export function notInterestedPenalty(
  input: ScoreInputs,
  affinity: UserAffinity
): number {
  if (affinity.notInterestedPmids.has(input.pmid)) return 1;
  let penalty = 0;
  if (affinity.dislikedJournalSlugs.has(input.journalSlug)) penalty += 0.4;
  const tokens = [
    ...input.keywords.map((k) => k.toLowerCase()),
    ...input.meshTerms.map((m) => m.toLowerCase()),
  ];
  const overlap = tokens.filter((t) => affinity.dislikedTokens.has(t)).length;
  if (overlap > 0) {
    penalty += Math.min(0.6, overlap * 0.2);
  }
  return Math.min(1, penalty);
}

export function scorePaper(
  input: ScoreInputs,
  affinity: UserAffinity,
  now: Date = new Date()
): number {
  return (
    WEIGHTS.journal * journalAffinity(input, affinity) +
    WEIGHTS.topic * topicAffinity(input, affinity) +
    WEIGHTS.recency * recencyDecay(input.publicationDate, now) +
    WEIGHTS.citation * citationBoost(input.citationCount) +
    WEIGHTS.interested * interestedMatch(input, affinity) -
    WEIGHTS.notInterested * notInterestedPenalty(input, affinity)
  );
}
