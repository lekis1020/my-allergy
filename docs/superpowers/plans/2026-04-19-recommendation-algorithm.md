# Recommendation Algorithm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace simple token-matching personalization with a multi-dimensional affinity profile that learns from every thumbs-up/down feedback.

**Architecture:** New `user_affinity_profiles` table stores per-user weighted feature vectors across 6 dimensions (topics, authors, keywords, mesh_terms, journals, article_types). Each feedback updates weights via online learning (exponential moving average). Scoring combines profile-based similarity with explicit PMID matching, recency decay, and citation boost.

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL + RLS), TypeScript, Vitest, SWR

**Spec:** `docs/superpowers/specs/2026-04-19-recommendation-algorithm-design.md`

---

### Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/00023_user_affinity_profiles.sql`

- [ ] **Step 1: Write migration**

```sql
-- Multi-dimensional affinity profile for personalized feed scoring.
-- Each JSONB column stores { "feature_name": weight } where weight ∈ [-1, 1].

CREATE TABLE IF NOT EXISTS user_affinity_profiles (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  topics        JSONB NOT NULL DEFAULT '{}',
  authors       JSONB NOT NULL DEFAULT '{}',
  keywords      JSONB NOT NULL DEFAULT '{}',
  mesh_terms    JSONB NOT NULL DEFAULT '{}',
  journals      JSONB NOT NULL DEFAULT '{}',
  article_types JSONB NOT NULL DEFAULT '{}',
  feedback_count INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_affinity_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON user_affinity_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON user_affinity_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON user_affinity_profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own profile" ON user_affinity_profiles
  FOR DELETE USING (auth.uid() = user_id);
```

- [ ] **Step 2: Verify migration applies locally**

Run: `npx supabase db push --local` (or `npx supabase migration up --local`)
Expected: Migration 00023 applied successfully.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00023_user_affinity_profiles.sql
git commit -m "feat: add user_affinity_profiles table (migration 00023)"
```

---

### Task 2: Profile Types & Constants

**Files:**
- Create: `src/lib/recommend/profile.ts`

- [ ] **Step 1: Create profile module with types and constants**

```typescript
// src/lib/recommend/profile.ts

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

export type AffinityDimension = "topics" | "authors" | "keywords" | "mesh_terms" | "journals" | "article_types";

export const DIMENSIONS: AffinityDimension[] = [
  "topics", "authors", "keywords", "mesh_terms", "journals", "article_types",
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

export interface PaperFeatures {
  topics: string[];
  authors: string[];
  keywords: string[];
  mesh_terms: string[];
  journals: string[];
  article_types: string[];
}

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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/recommend/profile.ts
git commit -m "feat: add affinity profile types and constants"
```

---

### Task 3: Profile Update Logic (TDD)

**Files:**
- Create: `src/lib/recommend/__tests__/profile.test.ts`
- Modify: `src/lib/recommend/profile.ts`

- [ ] **Step 1: Write failing tests for updateWeights**

```typescript
// src/lib/recommend/__tests__/profile.test.ts
import { describe, expect, it } from "vitest";
import {
  updateWeights,
  pruneWeights,
  applyDecay,
  LEARNING_RATE,
  DECAY_RATE,
  MIN_WEIGHT_THRESHOLD,
} from "../profile";

describe("updateWeights", () => {
  it("creates new entries from zero for positive feedback", () => {
    const weights: Record<string, number> = {};
    const features = ["dupilumab", "asthma"];
    const result = updateWeights(weights, features, 1);
    // α_eff = 0.15 / sqrt(2) ≈ 0.106
    const alpha = LEARNING_RATE / Math.sqrt(2);
    expect(result["dupilumab"]).toBeCloseTo(alpha, 4);
    expect(result["asthma"]).toBeCloseTo(alpha, 4);
  });

  it("strengthens existing positive weights on positive feedback", () => {
    const weights: Record<string, number> = { dupilumab: 0.3 };
    const result = updateWeights(weights, ["dupilumab"], 1);
    // α_eff = 0.15 / sqrt(1) = 0.15
    // 0.3 + 0.15 * (1 - 0.3) = 0.405
    expect(result["dupilumab"]).toBeCloseTo(0.405, 4);
  });

  it("moves weight toward -1 on negative feedback", () => {
    const weights: Record<string, number> = { covid: 0.0 };
    const result = updateWeights(weights, ["covid"], -1);
    expect(result["covid"]).toBeCloseTo(-0.15, 4);
  });

  it("conflicting feedback converges toward zero", () => {
    let weights: Record<string, number> = { topic: 0.0 };
    // alternate positive and negative
    for (let i = 0; i < 20; i++) {
      weights = updateWeights(weights, ["topic"], i % 2 === 0 ? 1 : -1);
    }
    expect(Math.abs(weights["topic"])).toBeLessThan(0.1);
  });

  it("does not modify weights for features not in the list", () => {
    const weights: Record<string, number> = { existing: 0.5 };
    const result = updateWeights(weights, ["new_feature"], 1);
    expect(result["existing"]).toBe(0.5);
  });

  it("handles empty features list gracefully", () => {
    const weights: Record<string, number> = { a: 0.5 };
    const result = updateWeights(weights, [], 1);
    expect(result).toEqual({ a: 0.5 });
  });

  it("normalizes learning rate by sqrt(n_features)", () => {
    const w1 = updateWeights({}, ["a"], 1);
    const w25 = updateWeights({}, Array.from({ length: 25 }, (_, i) => `k${i}`), 1);
    // single feature: α = 0.15, 25 features: α = 0.15/5 = 0.03
    expect(w1["a"]).toBeCloseTo(0.15, 4);
    expect(w25["k0"]).toBeCloseTo(0.03, 4);
  });
});

describe("pruneWeights", () => {
  it("removes entries below maxK by |weight|", () => {
    const weights: Record<string, number> = {};
    for (let i = 0; i < 10; i++) {
      weights[`k${i}`] = (i + 1) * 0.1; // 0.1 to 1.0
    }
    const result = pruneWeights(weights, 5);
    expect(Object.keys(result).length).toBe(5);
    // should keep top 5 by |weight|: k5..k9 (0.6..1.0)
    expect(result["k5"]).toBeDefined();
    expect(result["k9"]).toBeDefined();
    expect(result["k0"]).toBeUndefined();
  });

  it("keeps negative weights by absolute value", () => {
    const weights = { a: 0.1, b: -0.9, c: 0.2 };
    const result = pruneWeights(weights, 2);
    expect(result["b"]).toBe(-0.9);
    expect(result["c"]).toBe(0.2);
    expect(result["a"]).toBeUndefined();
  });

  it("returns unchanged if under maxK", () => {
    const weights = { a: 0.5, b: 0.3 };
    const result = pruneWeights(weights, 10);
    expect(result).toEqual(weights);
  });
});

describe("applyDecay", () => {
  it("returns unchanged weights for 0 days", () => {
    const weights = { a: 0.5, b: -0.3 };
    const result = applyDecay(weights, 0);
    expect(result["a"]).toBeCloseTo(0.5, 5);
    expect(result["b"]).toBeCloseTo(-0.3, 5);
  });

  it("decays weights by rate^days", () => {
    const weights = { a: 1.0 };
    const result = applyDecay(weights, 30);
    expect(result["a"]).toBeCloseTo(Math.pow(DECAY_RATE, 30), 4);
  });

  it("removes weights below MIN_WEIGHT_THRESHOLD after decay", () => {
    const weights = { a: 0.02 };
    const result = applyDecay(weights, 100);
    // 0.02 * 0.995^100 ≈ 0.012 → still above 0.01
    // 0.02 * 0.995^200 ≈ 0.007 → below threshold
    const result2 = applyDecay(weights, 200);
    expect(result["a"]).toBeDefined();
    expect(result2["a"]).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/recommend/__tests__/profile.test.ts`
Expected: FAIL — `updateWeights`, `pruneWeights`, `applyDecay` not exported.

- [ ] **Step 3: Implement updateWeights, pruneWeights, applyDecay**

Add to `src/lib/recommend/profile.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/recommend/__tests__/profile.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/recommend/profile.ts src/lib/recommend/__tests__/profile.test.ts
git commit -m "feat: implement profile update, pruning, and decay logic with tests"
```

---

### Task 4: Multi-Dimensional Scoring (TDD)

**Files:**
- Modify: `src/lib/recommend/score.ts`
- Modify: `src/lib/recommend/__tests__/score.test.ts`

- [ ] **Step 1: Write failing tests for new scoring**

Replace `src/lib/recommend/__tests__/score.test.ts` entirely:

```typescript
import { describe, expect, it } from "vitest";
import {
  recencyDecay,
  citationBoost,
  dimensionSimilarity,
  explicitMatch,
  scorePaper,
  DIMENSION_WEIGHTS,
  RECENCY_HALF_LIFE_DAYS,
  type ProfileScoreInputs,
  type ScoringContext,
} from "../score";
import { emptyProfile, type AffinityProfile } from "../profile";

function makeInputs(overrides: Partial<ProfileScoreInputs> = {}): ProfileScoreInputs {
  return {
    pmid: "1",
    journalSlug: "jaci",
    publicationDate: null,
    citationCount: null,
    keywords: [],
    meshTerms: [],
    topicTags: [],
    authorKeys: [],
    publicationTypes: [],
    ...overrides,
  };
}

function makeContext(overrides: Partial<ScoringContext> = {}): ScoringContext {
  return {
    profile: emptyProfile(),
    interestedPmids: new Set(),
    notInterestedPmids: new Set(),
    ...overrides,
  };
}

describe("recencyDecay", () => {
  it("returns 0 for missing date", () => {
    expect(recencyDecay(null)).toBe(0);
  });

  it("returns 1 for same day", () => {
    const now = new Date("2026-04-15T00:00:00Z");
    expect(recencyDecay("2026-04-15", now)).toBeCloseTo(1, 5);
  });

  it("decays over half-life", () => {
    const now = new Date("2026-04-15T00:00:00Z");
    const pub = new Date(now.getTime() - RECENCY_HALF_LIFE_DAYS * 86400_000);
    expect(recencyDecay(pub.toISOString(), now)).toBeCloseTo(Math.exp(-1), 3);
  });
});

describe("citationBoost", () => {
  it("returns 0 for null/zero", () => {
    expect(citationBoost(null)).toBe(0);
    expect(citationBoost(0)).toBe(0);
  });

  it("returns ln(1+n)", () => {
    expect(citationBoost(9)).toBeCloseTo(Math.log(10), 5);
  });
});

describe("dimensionSimilarity", () => {
  it("returns 0 for empty profile dimension", () => {
    expect(dimensionSimilarity({}, ["asthma"])).toBe(0);
  });

  it("sums matching weights", () => {
    const profile = { dupilumab: 0.9, asthma: 0.5, covid: -0.4 };
    const features = ["dupilumab", "asthma"];
    expect(dimensionSimilarity(profile, features)).toBeCloseTo(1.4, 5);
  });

  it("negative weights produce negative similarity", () => {
    const profile = { covid: -0.8 };
    expect(dimensionSimilarity(profile, ["covid"])).toBeCloseTo(-0.8, 5);
  });

  it("ignores features not in profile", () => {
    const profile = { asthma: 0.5 };
    expect(dimensionSimilarity(profile, ["unknown"])).toBe(0);
  });
});

describe("explicitMatch", () => {
  it("returns +1 for interested PMID", () => {
    expect(explicitMatch("42", new Set(["42"]), new Set())).toBe(1);
  });

  it("returns -1 for not_interested PMID", () => {
    expect(explicitMatch("42", new Set(), new Set(["42"]))).toBe(-1);
  });

  it("returns 0 for unknown PMID", () => {
    expect(explicitMatch("99", new Set(["42"]), new Set(["13"]))).toBe(0);
  });
});

describe("scorePaper", () => {
  const now = new Date("2026-04-15T00:00:00Z");

  it("returns only base score for empty profile", () => {
    const input = makeInputs({
      publicationDate: "2026-04-15",
      citationCount: 10,
    });
    const ctx = makeContext();
    const s = scorePaper(input, ctx, now);
    // recency = 1.0, citation = ln(11) ≈ 2.397
    const expected = DIMENSION_WEIGHTS.recency * 1.0 +
      DIMENSION_WEIGHTS.citations * Math.log(11);
    expect(s).toBeCloseTo(expected, 3);
  });

  it("boosts paper matching profile topics", () => {
    const profile = emptyProfile();
    profile.topics = { asthma: 0.8 };
    const input = makeInputs({ topicTags: ["asthma"] });
    const ctx = makeContext({ profile });
    const s = scorePaper(input, ctx, now);
    expect(s).toBeGreaterThan(scorePaper(makeInputs(), makeContext(), now));
  });

  it("boosts paper matching profile authors", () => {
    const profile = emptyProfile();
    profile.authors = { "Kim_SH": 0.7 };
    const input = makeInputs({ authorKeys: ["Kim_SH"] });
    const ctx = makeContext({ profile });
    const s = scorePaper(input, ctx, now);
    expect(s).toBeGreaterThan(scorePaper(makeInputs(), makeContext(), now));
  });

  it("penalises paper matching negative profile weights", () => {
    const profile = emptyProfile();
    profile.keywords = { "covid-19": -0.8 };
    const input = makeInputs({ keywords: ["covid-19"] });
    const ctx = makeContext({ profile });
    const s = scorePaper(input, ctx, now);
    expect(s).toBeLessThan(scorePaper(makeInputs(), makeContext(), now));
  });

  it("explicit interested gives strong boost", () => {
    const input = makeInputs({ pmid: "42" });
    const ctx = makeContext({ interestedPmids: new Set(["42"]) });
    const s = scorePaper(input, ctx, now);
    expect(s).toBeGreaterThanOrEqual(DIMENSION_WEIGHTS.explicit);
  });

  it("explicit not_interested gives strong penalty", () => {
    const input = makeInputs({
      pmid: "13",
      publicationDate: "2026-04-15",
      citationCount: 50,
    });
    const ctx = makeContext({ notInterestedPmids: new Set(["13"]) });
    const s = scorePaper(input, ctx, now);
    expect(s).toBeLessThan(0);
  });

  it("profile-matched paper ranks above unmatched paper", () => {
    const profile = emptyProfile();
    profile.keywords = { dupilumab: 0.9 };
    profile.journals = { jaci: 0.8 };
    const ctx = makeContext({ profile });

    const matched = makeInputs({
      journalSlug: "jaci",
      keywords: ["dupilumab"],
      publicationDate: "2026-03-15",
    });
    const unmatched = makeInputs({
      journalSlug: "allergy",
      keywords: ["unrelated"],
      publicationDate: "2026-04-15",
    });
    expect(scorePaper(matched, ctx, now)).toBeGreaterThan(
      scorePaper(unmatched, ctx, now)
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/recommend/__tests__/score.test.ts`
Expected: FAIL — new exports not found.

- [ ] **Step 3: Rewrite score.ts with new multi-dimensional scoring**

Replace `src/lib/recommend/score.ts` entirely:

```typescript
// src/lib/recommend/score.ts
import type { AffinityProfile } from "./profile";

export interface ProfileScoreInputs {
  pmid: string;
  journalSlug: string;
  publicationDate: string | null;
  citationCount: number | null;
  keywords: string[];
  meshTerms: string[];
  topicTags: string[];
  authorKeys: string[];       // "LastName_Initials" format
  publicationTypes: string[];
}

export interface ScoringContext {
  profile: AffinityProfile;
  interestedPmids: Set<string>;
  notInterestedPmids: Set<string>;
}

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
    DIMENSION_WEIGHTS.topics * dimensionSimilarity(profile.topics, input.topicTags) +
    DIMENSION_WEIGHTS.authors * dimensionSimilarity(profile.authors, input.authorKeys) +
    DIMENSION_WEIGHTS.keywords * dimensionSimilarity(profile.keywords, input.keywords) +
    DIMENSION_WEIGHTS.mesh_terms * dimensionSimilarity(profile.mesh_terms, input.meshTerms) +
    DIMENSION_WEIGHTS.journals * dimensionSimilarity(profile.journals, [input.journalSlug]) +
    DIMENSION_WEIGHTS.article_types * dimensionSimilarity(profile.article_types, input.publicationTypes);

  const explicit =
    DIMENSION_WEIGHTS.explicit * explicitMatch(input.pmid, interestedPmids, notInterestedPmids);

  const baseScore =
    DIMENSION_WEIGHTS.recency * recencyDecay(input.publicationDate, now) +
    DIMENSION_WEIGHTS.citations * citationBoost(input.citationCount);

  return profileScore + explicit + baseScore;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/recommend/__tests__/score.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/recommend/score.ts src/lib/recommend/__tests__/score.test.ts
git commit -m "feat: replace scoring with multi-dimensional profile-based algorithm"
```

---

### Task 5: Feature Extraction & Profile Persistence

**Files:**
- Modify: `src/lib/recommend/profile.ts`
- Modify: `src/lib/recommend/affinity.ts`

- [ ] **Step 1: Add extractPaperFeatures to profile.ts**

Append to `src/lib/recommend/profile.ts`:

```typescript
import { classifyPaperTopics } from "@/lib/utils/topic-tags";

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
```

- [ ] **Step 2: Rewrite affinity.ts for profile-based loading**

Replace `src/lib/recommend/affinity.ts` entirely:

```typescript
// src/lib/recommend/affinity.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { AffinityProfile } from "./profile";
import type { ScoringContext } from "./score";
import { emptyProfile, applyDecay, DIMENSIONS } from "./profile";

type AuthedClient = SupabaseClient<Database>;

/**
 * Load the user's affinity profile and explicit feedback sets.
 * Applies time decay on load. Returns empty profile if none exists.
 */
export async function loadScoringContext(
  supabase: AuthedClient,
  userId: string
): Promise<ScoringContext> {
  const [profileRes, feedbackRes] = await Promise.all([
    supabase
      .from("user_affinity_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("paper_feedback")
      .select("paper_pmid, feedback")
      .eq("user_id", userId),
  ]);

  // Build explicit feedback sets
  const interestedPmids = new Set<string>();
  const notInterestedPmids = new Set<string>();
  for (const row of feedbackRes.data ?? []) {
    if (row.feedback === "interested") interestedPmids.add(row.paper_pmid);
    else if (row.feedback === "not_interested") notInterestedPmids.add(row.paper_pmid);
  }

  // Load or create profile
  let profile: AffinityProfile;
  if (profileRes.data) {
    profile = {
      topics: (profileRes.data.topics ?? {}) as Record<string, number>,
      authors: (profileRes.data.authors ?? {}) as Record<string, number>,
      keywords: (profileRes.data.keywords ?? {}) as Record<string, number>,
      mesh_terms: (profileRes.data.mesh_terms ?? {}) as Record<string, number>,
      journals: (profileRes.data.journals ?? {}) as Record<string, number>,
      article_types: (profileRes.data.article_types ?? {}) as Record<string, number>,
      feedback_count: profileRes.data.feedback_count ?? 0,
      updated_at: profileRes.data.updated_at ?? new Date().toISOString(),
    };

    // Apply time decay
    const lastUpdate = new Date(profile.updated_at);
    const daysSince = Math.max(
      0,
      (Date.now() - lastUpdate.getTime()) / 86_400_000
    );
    if (daysSince >= 1) {
      for (const dim of DIMENSIONS) {
        profile[dim] = applyDecay(profile[dim], daysSince);
      }
    }
  } else {
    profile = emptyProfile();
  }

  return { profile, interestedPmids, notInterestedPmids };
}

/**
 * Save the updated profile to the database (upsert).
 */
export async function saveProfile(
  supabase: AuthedClient,
  userId: string,
  profile: AffinityProfile
): Promise<void> {
  await supabase.from("user_affinity_profiles").upsert(
    {
      user_id: userId,
      topics: profile.topics,
      authors: profile.authors,
      keywords: profile.keywords,
      mesh_terms: profile.mesh_terms,
      journals: profile.journals,
      article_types: profile.article_types,
      feedback_count: profile.feedback_count,
      updated_at: profile.updated_at,
    },
    { onConflict: "user_id" }
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/recommend/profile.ts src/lib/recommend/affinity.ts
git commit -m "feat: add feature extraction, profile persistence, and scoring context loader"
```

---

### Task 6: Feedback API Integration

**Files:**
- Modify: `src/app/api/feedback/route.ts`

- [ ] **Step 1: Add profile update to POST handler**

Add imports at top of `src/app/api/feedback/route.ts`:

```typescript
import { extractPaperFeatures, applyFeedbackToProfile, emptyProfile } from "@/lib/recommend/profile";
import { saveProfile } from "@/lib/recommend/affinity";
import { createAnonClient } from "@/lib/supabase/server";
```

After the successful upsert block (after `return NextResponse.json({ success: true }, { status: 201 });` line), restructure the POST function so the profile update happens before the return. Insert this block between the upsert and the success return:

```typescript
  // Update affinity profile (best-effort — don't fail the request)
  try {
    const anonClient = createAnonClient();
    const { data: paperData } = await anonClient
      .from("papers")
      .select(`
        pmid, title, abstract, keywords, mesh_terms, publication_types,
        journals!inner(slug),
        paper_authors(last_name, initials)
      `)
      .eq("pmid", pmid)
      .maybeSingle();

    if (paperData) {
      const features = extractPaperFeatures({
        ...paperData,
        paper_authors: paperData.paper_authors ?? [],
      });
      const target = feedback === "interested" ? 1 : -1;

      // Load current profile
      const { data: profileRow } = await supabase
        .from("user_affinity_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      const currentProfile = profileRow
        ? {
            topics: (profileRow.topics ?? {}) as Record<string, number>,
            authors: (profileRow.authors ?? {}) as Record<string, number>,
            keywords: (profileRow.keywords ?? {}) as Record<string, number>,
            mesh_terms: (profileRow.mesh_terms ?? {}) as Record<string, number>,
            journals: (profileRow.journals ?? {}) as Record<string, number>,
            article_types: (profileRow.article_types ?? {}) as Record<string, number>,
            feedback_count: profileRow.feedback_count ?? 0,
            updated_at: profileRow.updated_at ?? new Date().toISOString(),
          }
        : emptyProfile();

      const updatedProfile = applyFeedbackToProfile(currentProfile, features, target);
      await saveProfile(supabase, user.id, updatedProfile);
    }
  } catch (err) {
    console.warn("[Feedback] profile update failed (non-blocking):", err);
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/feedback/route.ts
git commit -m "feat: update affinity profile on feedback submission"
```

---

### Task 7: Reset API & Papers API Integration

**Files:**
- Modify: `src/app/api/recommendations/reset/route.ts`
- Modify: `src/app/api/papers/route.ts`

- [ ] **Step 1: Add profile deletion to reset endpoint**

In `src/app/api/recommendations/reset/route.ts`, add profile deletion after the feedback delete:

```typescript
  // Also delete the affinity profile
  await supabase
    .from("user_affinity_profiles")
    .delete()
    .eq("user_id", user.id);
```

Insert this between the `paper_feedback` delete and the success response.

- [ ] **Step 2: Update papers route to use new scoring**

In `src/app/api/papers/route.ts`, make these changes:

**2a.** Replace imports — remove old imports, add new:

```typescript
import { loadScoringContext } from "@/lib/recommend/affinity";
import { scorePaper } from "@/lib/recommend/score";
import { classifyPaperTopics } from "@/lib/utils/topic-tags";
```

Remove the old imports of `loadUserAffinity` and `scorePaper`.

**2b.** Add `publication_types` to the select query in `buildPapersQuery`:

In the `.select(...)` call, add `publication_types` after `journal_id`:

```
journal_id, publication_types,
```

**2c.** Replace the personalization block (the `if (personalizedActive && user)` section):

```typescript
  let personalizedTotal: number | null = null;
  if (personalizedActive && user) {
    const context = await loadScoringContext(authClient, user.id);
    const now = new Date();
    const scored = rawRows.map((paper) => {
      const journal = paper.journals;
      const journalSlug = journal?.slug ?? "";
      const keywords = Array.isArray(paper.keywords)
        ? paper.keywords.filter((k): k is string => typeof k === "string").map((k) => k.toLowerCase())
        : [];
      const meshTerms = Array.isArray(paper.mesh_terms)
        ? paper.mesh_terms.filter((t): t is string => typeof t === "string").map((t) => t.toLowerCase())
        : [];
      const publicationTypes = Array.isArray(paper.publication_types)
        ? paper.publication_types.filter((t): t is string => typeof t === "string")
        : [];
      const topicTags = classifyPaperTopics({
        title: String(paper.title ?? ""),
        abstract: typeof paper.abstract === "string" ? paper.abstract : null,
        keywords,
        meshTerms,
      }).filter((t) => t !== "others");
      const authorKeys = (paper.paper_authors ?? []).map(
        (a: { last_name: string; initials: string | null }) =>
          `${a.last_name}_${a.initials ?? ""}`.replace(/\s+/g, "")
      );

      const score = scorePaper(
        {
          pmid: paper.pmid,
          journalSlug,
          publicationDate: paper.epub_date || paper.publication_date,
          citationCount: paper.citation_count,
          keywords,
          meshTerms,
          topicTags,
          authorKeys,
          publicationTypes,
        },
        context,
        now,
      );
      return { paper, score };
    });
    scored.sort((a, b) => b.score - a.score);
    personalizedTotal = scored.length;
    rawRows = scored.slice(offset, offset + limit).map((s) => s.paper);
  }
```

**2d.** Add `publication_types` to the `PaperRow` interface:

```typescript
  publication_types: string[] | null;
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/recommendations/reset/route.ts src/app/api/papers/route.ts
git commit -m "feat: integrate new scoring into papers and reset APIs"
```

---

### Task 8: UI — ThumbsUp Button

**Files:**
- Modify: `src/components/papers/paper-card.tsx`
- Modify: `src/hooks/use-feedback.ts`

- [ ] **Step 1: Update paper-card.tsx with ThumbsUp button**

**1a.** Add `ThumbsUp` to the lucide-react import:

```typescript
import { ExternalLink, MessageCircle, Quote, Users, ThumbsDown, ThumbsUp } from "lucide-react";
```

**1b.** Update the `useFeedback` destructure to include `getFeedback` and `clearFeedback`:

```typescript
const { getFeedback, setFeedback, clearFeedback, isLoggedIn } = useFeedback();
const currentFeedback = getFeedback(paper.pmid);
```

**1c.** Add ThumbsUp handler after `handleNotInterested`:

```typescript
  const handleInterested = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoggedIn) return;
    if (currentFeedback === "interested") {
      void clearFeedback(paper.pmid);
    } else {
      void setFeedback(paper.pmid, "interested");
    }
  };
```

**1d.** Update `handleNotInterested` to support toggle:

```typescript
  const handleNotInterested = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoggedIn) return;
    if (currentFeedback === "not_interested") {
      void clearFeedback(paper.pmid);
    } else {
      setDismissed(true);
      void setFeedback(paper.pmid, "not_interested");
    }
  };
```

**1e.** Replace the existing ThumbsDown button block with both buttons:

```tsx
      {isLoggedIn && (
        <div className="absolute right-3 top-3 flex items-center gap-1">
          <button
            type="button"
            onClick={handleInterested}
            className={`rounded-full p-1.5 transition-colors ${
              currentFeedback === "interested"
                ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
                : "text-gray-400 hover:bg-blue-50 hover:text-blue-500 dark:text-gray-500 dark:hover:bg-blue-900/30 dark:hover:text-blue-400"
            }`}
            aria-label="Interested"
            title="Interested in this paper"
          >
            <ThumbsUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleNotInterested}
            className={`rounded-full p-1.5 transition-colors ${
              currentFeedback === "not_interested"
                ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"
                : "text-gray-400 hover:bg-red-50 hover:text-red-500 dark:text-gray-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
            }`}
            aria-label="Not interested"
            title="Not interested in this paper"
          >
            <ThumbsDown className="h-4 w-4" />
          </button>
        </div>
      )}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/papers/paper-card.tsx
git commit -m "feat: add ThumbsUp button with toggle behavior"
```

---

### Task 9: Supabase Types & Final Verification

**Files:**
- Modify: `src/types/supabase.ts`

- [ ] **Step 1: Add user_affinity_profiles to Database type**

Add the following entry to the `Tables` section of `src/types/supabase.ts` (alongside existing tables):

```typescript
      user_affinity_profiles: {
        Row: {
          user_id: string
          topics: Json
          authors: Json
          keywords: Json
          mesh_terms: Json
          journals: Json
          article_types: Json
          feedback_count: number
          updated_at: string
        }
        Insert: {
          user_id: string
          topics?: Json
          authors?: Json
          keywords?: Json
          mesh_terms?: Json
          journals?: Json
          article_types?: Json
          feedback_count?: number
          updated_at?: string
        }
        Update: {
          user_id?: string
          topics?: Json
          authors?: Json
          keywords?: Json
          mesh_terms?: Json
          journals?: Json
          article_types?: Json
          feedback_count?: number
          updated_at?: string
        }
        Relationships: []
      }
```

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (existing + new profile + new score tests).

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Manual verification**

1. Start dev server: `npm run dev`
2. Log in as a user
3. Verify ThumbsUp button appears on paper cards
4. Click ThumbsUp — button turns blue, card stays visible
5. Click ThumbsDown — card fades out
6. Click ThumbsUp again on already-liked paper — toggles off
7. Enable personalized feed — verify liked-topic papers rank higher
8. Reset recommendations — verify profile is cleared

- [ ] **Step 6: Commit**

```bash
git add src/types/supabase.ts
git commit -m "feat: add user_affinity_profiles to supabase types"
```

---

## File Summary

| File | Action | Task |
|------|--------|------|
| `supabase/migrations/00023_user_affinity_profiles.sql` | Create | 1 |
| `src/lib/recommend/profile.ts` | Create | 2, 3, 5 |
| `src/lib/recommend/__tests__/profile.test.ts` | Create | 3 |
| `src/lib/recommend/score.ts` | Rewrite | 4 |
| `src/lib/recommend/__tests__/score.test.ts` | Rewrite | 4 |
| `src/lib/recommend/affinity.ts` | Rewrite | 5 |
| `src/app/api/feedback/route.ts` | Modify | 6 |
| `src/app/api/recommendations/reset/route.ts` | Modify | 7 |
| `src/app/api/papers/route.ts` | Modify | 7 |
| `src/components/papers/paper-card.tsx` | Modify | 8 |
| `src/types/supabase.ts` | Modify | 9 |
