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
import { emptyProfile } from "../profile";

function makeInputs(
  overrides: Partial<ProfileScoreInputs> = {}
): ProfileScoreInputs {
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
    const expected =
      DIMENSION_WEIGHTS.recency * 1.0 +
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
    profile.authors = { Kim_SH: 0.7 };
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
