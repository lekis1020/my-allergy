import type { AffinityProfile } from "./profile";

// ── Types ──

export interface ProfileScoreInputs {
  pmid: string;
  journalSlug: string;
  publicationDate: string | null;
  citationCount: number | null;
  keywords: string[];
  meshTerms: string[];
  topicTags: string[];
  authorKeys: string[]; // "LastName_Initials" format
  publicationTypes: string[];
}

export interface ScoringContext {
  profile: AffinityProfile;
  interestedPmids: Set<string>;
  notInterestedPmids: Set<string>;
}

// ── Constants ──

export const DIMENSION_WEIGHTS = {
  topics: 3.0,
  authors: 2.0,
  keywords: 2.0,
  mesh_terms: 1.5,
  journals: 2.0,
  article_types: 1.0,
  explicit: 3.0,
  recency: 1.0,
  citations: 0.5,
} as const;

export const RECENCY_HALF_LIFE_DAYS = 30;

// ── Scoring Functions ──

export function recencyDecay(
  publicationDate: string | null,
  now: Date = new Date()
): number {
  if (!publicationDate) return 0;
  const pub = new Date(publicationDate);
  if (Number.isNaN(pub.getTime())) return 0;
  const days = Math.max(0, (now.getTime() - pub.getTime()) / 86_400_000);
  return Math.exp(-days / RECENCY_HALF_LIFE_DAYS);
}

export function citationBoost(count: number | null): number {
  if (!count || count <= 0) return 0;
  return Math.log(1 + count);
}

/**
 * Compute similarity between a profile dimension and a paper's features.
 * Returns the sum of profile weights for features that appear in the paper.
 */
export function dimensionSimilarity(
  profileDimension: Record<string, number>,
  paperFeatures: string[]
): number {
  let sum = 0;
  for (const feature of paperFeatures) {
    const weight = profileDimension[feature];
    if (weight !== undefined) {
      sum += weight;
    }
  }
  return sum;
}

/**
 * Explicit feedback match: +1 interested, -1 not_interested, 0 neutral.
 */
export function explicitMatch(
  pmid: string,
  interestedPmids: Set<string>,
  notInterestedPmids: Set<string>
): number {
  if (interestedPmids.has(pmid)) return 1;
  if (notInterestedPmids.has(pmid)) return -1;
  return 0;
}

export function scorePaper(
  input: ProfileScoreInputs,
  context: ScoringContext,
  now: Date = new Date()
): number {
  const { profile, interestedPmids, notInterestedPmids } = context;

  const profileScore =
    DIMENSION_WEIGHTS.topics *
      dimensionSimilarity(profile.topics, input.topicTags) +
    DIMENSION_WEIGHTS.authors *
      dimensionSimilarity(profile.authors, input.authorKeys) +
    DIMENSION_WEIGHTS.keywords *
      dimensionSimilarity(profile.keywords, input.keywords) +
    DIMENSION_WEIGHTS.mesh_terms *
      dimensionSimilarity(profile.mesh_terms, input.meshTerms) +
    DIMENSION_WEIGHTS.journals *
      dimensionSimilarity(profile.journals, [input.journalSlug]) +
    DIMENSION_WEIGHTS.article_types *
      dimensionSimilarity(profile.article_types, input.publicationTypes);

  const explicit =
    DIMENSION_WEIGHTS.explicit *
    explicitMatch(input.pmid, interestedPmids, notInterestedPmids);

  const baseScore =
    DIMENSION_WEIGHTS.recency * recencyDecay(input.publicationDate, now) +
    DIMENSION_WEIGHTS.citations * citationBoost(input.citationCount);

  return profileScore + explicit + baseScore;
}
