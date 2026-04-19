import { describe, expect, it } from "vitest";
import {
  updateWeights,
  pruneWeights,
  applyDecay,
  applyFeedbackToProfile,
  emptyProfile,
  LEARNING_RATE,
  DECAY_RATE,
  MIN_WEIGHT_THRESHOLD,
} from "../profile";

describe("updateWeights", () => {
  it("creates new entries from zero for positive feedback", () => {
    const weights: Record<string, number> = {};
    const features = ["dupilumab", "asthma"];
    const result = updateWeights(weights, features, 1);
    const alpha = LEARNING_RATE / Math.sqrt(2);
    expect(result["dupilumab"]).toBeCloseTo(alpha, 4);
    expect(result["asthma"]).toBeCloseTo(alpha, 4);
  });

  it("strengthens existing positive weights on positive feedback", () => {
    const weights: Record<string, number> = { dupilumab: 0.3 };
    const result = updateWeights(weights, ["dupilumab"], 1);
    // α = 0.15 / sqrt(1) = 0.15
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
    const w25 = updateWeights(
      {},
      Array.from({ length: 25 }, (_, i) => `k${i}`),
      1
    );
    expect(w1["a"]).toBeCloseTo(0.15, 4);
    expect(w25["k0"]).toBeCloseTo(0.03, 4);
  });
});

describe("pruneWeights", () => {
  it("removes entries below maxK by |weight|", () => {
    const weights: Record<string, number> = {};
    for (let i = 0; i < 10; i++) {
      weights[`k${i}`] = (i + 1) * 0.1;
    }
    const result = pruneWeights(weights, 5);
    expect(Object.keys(result).length).toBe(5);
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
    expect(result["a"]).toBeDefined();
    const result2 = applyDecay(weights, 200);
    // 0.02 * 0.995^200 ≈ 0.007 → below threshold
    expect(result2["a"]).toBeUndefined();
  });
});

describe("applyFeedbackToProfile", () => {
  it("updates all dimensions present in features", () => {
    const profile = emptyProfile();
    const features = {
      topics: ["asthma"],
      authors: ["Kim_SH"],
      keywords: ["dupilumab"],
      mesh_terms: ["asthma/drug therapy"],
      journals: ["jaci"],
      article_types: ["Journal Article"],
    };
    const updated = applyFeedbackToProfile(profile, features, 1);
    expect(updated.topics["asthma"]).toBeGreaterThan(0);
    expect(updated.authors["Kim_SH"]).toBeGreaterThan(0);
    expect(updated.keywords["dupilumab"]).toBeGreaterThan(0);
    expect(updated.journals["jaci"]).toBeGreaterThan(0);
    expect(updated.feedback_count).toBe(1);
  });

  it("increments feedback_count", () => {
    const profile = emptyProfile();
    const features = { topics: ["a"], authors: [], keywords: [], mesh_terms: [], journals: [], article_types: [] };
    const updated = applyFeedbackToProfile(profile, features, 1);
    expect(updated.feedback_count).toBe(1);
    const updated2 = applyFeedbackToProfile(updated, features, -1);
    expect(updated2.feedback_count).toBe(2);
  });

  it("skips empty feature dimensions", () => {
    const profile = emptyProfile();
    profile.keywords = { existing: 0.5 };
    const features = { topics: ["a"], authors: [], keywords: [], mesh_terms: [], journals: [], article_types: [] };
    const updated = applyFeedbackToProfile(profile, features, 1);
    expect(updated.keywords["existing"]).toBe(0.5);
  });
});
