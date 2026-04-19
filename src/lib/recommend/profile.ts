import { classifyPaperTopics } from "@/lib/utils/topic-tags";

// ── Types ──

export interface AffinityProfile {
  topics: Record<string, number>;
  authors: Record<string, number>;
  keywords: Record<string, number>;
  mesh_terms: Record<string, number>;
  journals: Record<string, number>;
  article_types: Record<string, number>;
  feedback_count: number;
  updated_at: string;
}

export type AffinityDimension =
  | "topics"
  | "authors"
  | "keywords"
  | "mesh_terms"
  | "journals"
  | "article_types";

export interface PaperFeatures {
  topics: string[];
  authors: string[];
  keywords: string[];
  mesh_terms: string[];
  journals: string[];
  article_types: string[];
}

// ── Constants ──

export const DIMENSIONS: AffinityDimension[] = [
  "topics",
  "authors",
  "keywords",
  "mesh_terms",
  "journals",
  "article_types",
];

export const LEARNING_RATE = 0.15;
export const DECAY_RATE = 0.995;
export const MIN_WEIGHT_THRESHOLD = 0.01;

export const MAX_FEATURES: Record<AffinityDimension, number> = {
  topics: 50,
  authors: 100,
  keywords: 200,
  mesh_terms: 200,
  journals: 50,
  article_types: 20,
};

// ── Core Functions ──

export function emptyProfile(): AffinityProfile {
  return {
    topics: {},
    authors: {},
    keywords: {},
    mesh_terms: {},
    journals: {},
    article_types: {},
    feedback_count: 0,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Update weights for the given features using exponential moving average.
 * α_effective = LEARNING_RATE / sqrt(n_features) to normalize total impact.
 */
export function updateWeights(
  weights: Record<string, number>,
  features: string[],
  target: 1 | -1
): Record<string, number> {
  if (features.length === 0) return { ...weights };

  const alpha = LEARNING_RATE / Math.sqrt(features.length);
  const result = { ...weights };

  for (const feature of features) {
    const current = result[feature] ?? 0;
    result[feature] = current + alpha * (target - current);
  }

  return result;
}

/**
 * Keep only the top `maxK` entries by |weight|.
 */
export function pruneWeights(
  weights: Record<string, number>,
  maxK: number
): Record<string, number> {
  const entries = Object.entries(weights);
  if (entries.length <= maxK) return { ...weights };

  entries.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  return Object.fromEntries(entries.slice(0, maxK));
}

/**
 * Apply time decay: weight *= DECAY_RATE ^ days.
 * Removes entries that fall below MIN_WEIGHT_THRESHOLD.
 */
export function applyDecay(
  weights: Record<string, number>,
  days: number
): Record<string, number> {
  if (days <= 0) return { ...weights };

  const factor = Math.pow(DECAY_RATE, days);
  const result: Record<string, number> = {};

  for (const [key, value] of Object.entries(weights)) {
    const decayed = value * factor;
    if (Math.abs(decayed) >= MIN_WEIGHT_THRESHOLD) {
      result[key] = decayed;
    }
  }

  return result;
}

// ── Feature Extraction ──

interface PaperRow {
  pmid: string;
  title: string;
  abstract: string | null;
  keywords: unknown;
  mesh_terms: unknown;
  publication_types: unknown;
  journals: { slug: string } | null;
  paper_authors: Array<{ last_name: string; initials: string | null }>;
}

function toStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((v): v is string => typeof v === "string");
}

/**
 * Extract feature vectors from a paper row for profile updating.
 */
export function extractPaperFeatures(paper: PaperRow): PaperFeatures {
  const keywords = toStringArray(paper.keywords).map((k) => k.toLowerCase());
  const meshTerms = toStringArray(paper.mesh_terms).map((m) => m.toLowerCase());
  const publicationTypes = toStringArray(paper.publication_types);

  const topicTags = classifyPaperTopics({
    title: String(paper.title ?? ""),
    abstract: typeof paper.abstract === "string" ? paper.abstract : null,
    keywords,
    meshTerms,
  });

  const authorKeys = paper.paper_authors
    .map((a) => `${a.last_name}_${a.initials ?? ""}`.replace(/\s+/g, ""))
    .filter(Boolean);

  const journalSlug = paper.journals?.slug;

  return {
    topics: topicTags.filter((t) => t !== "others"),
    authors: authorKeys,
    keywords,
    mesh_terms: meshTerms,
    journals: journalSlug ? [journalSlug] : [],
    article_types: publicationTypes,
  };
}

/**
 * Apply a single feedback to the profile: update weights + prune all dimensions.
 */
export function applyFeedbackToProfile(
  profile: AffinityProfile,
  features: PaperFeatures,
  target: 1 | -1
): AffinityProfile {
  const updated = { ...profile };

  for (const dim of DIMENSIONS) {
    const featureList = features[dim];
    if (featureList.length > 0) {
      const newWeights = updateWeights(updated[dim], featureList, target);
      updated[dim] = pruneWeights(newWeights, MAX_FEATURES[dim]);
    }
  }

  updated.feedback_count = profile.feedback_count + 1;
  updated.updated_at = new Date().toISOString();

  return updated;
}
