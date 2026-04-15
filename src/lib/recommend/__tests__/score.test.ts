import { describe, expect, it } from "vitest";
import {
  RECENCY_HALF_LIFE_DAYS,
  WEIGHTS,
  citationBoost,
  interestedMatch,
  journalAffinity,
  notInterestedPenalty,
  recencyDecay,
  scorePaper,
  topicAffinity,
  type ScoreInputs,
  type UserAffinity,
} from "../score";

function emptyAffinity(overrides: Partial<UserAffinity> = {}): UserAffinity {
  return {
    journalSlugs: new Set(),
    keywordAlerts: [],
    interestedPmids: new Set(),
    notInterestedPmids: new Set(),
    dislikedJournalSlugs: new Set(),
    dislikedTokens: new Set(),
    ...overrides,
  };
}

function paper(overrides: Partial<ScoreInputs> = {}): ScoreInputs {
  return {
    pmid: "1",
    journalSlug: "jaci",
    publicationDate: null,
    citationCount: null,
    keywords: [],
    meshTerms: [],
    title: "",
    abstract: null,
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

  it("decays over the half-life window", () => {
    const now = new Date("2026-04-15T00:00:00Z");
    const pub = new Date(now.getTime() - RECENCY_HALF_LIFE_DAYS * 86400 * 1000);
    const val = recencyDecay(pub.toISOString(), now);
    expect(val).toBeCloseTo(Math.exp(-1), 3);
  });
});

describe("citationBoost", () => {
  it("returns 0 for null/zero citations", () => {
    expect(citationBoost(null)).toBe(0);
    expect(citationBoost(0)).toBe(0);
  });

  it("returns ln(1+n) for positive counts", () => {
    expect(citationBoost(9)).toBeCloseTo(Math.log(10), 5);
  });
});

describe("journalAffinity", () => {
  it("matches on journal slug", () => {
    const aff = emptyAffinity({ journalSlugs: new Set(["jaci"]) });
    expect(journalAffinity(paper({ journalSlug: "jaci" }), aff)).toBe(1);
    expect(journalAffinity(paper({ journalSlug: "allergy" }), aff)).toBe(0);
  });
});

describe("topicAffinity", () => {
  it("zero when no alerts configured", () => {
    expect(topicAffinity(paper({ title: "asthma" }), emptyAffinity())).toBe(0);
  });

  it("hits on title / abstract / keywords / mesh", () => {
    const aff = emptyAffinity({ keywordAlerts: ["dupilumab"] });
    expect(topicAffinity(paper({ title: "Dupilumab trial" }), aff)).toBeGreaterThan(0);
    expect(topicAffinity(paper({ abstract: "treated with dupilumab" }), aff)).toBeGreaterThan(0);
    expect(topicAffinity(paper({ keywords: ["Dupilumab"] }), aff)).toBeGreaterThan(0);
    expect(topicAffinity(paper({ meshTerms: ["dupilumab"] }), aff)).toBeGreaterThan(0);
    expect(topicAffinity(paper({ title: "aspirin" }), aff)).toBe(0);
  });

  it("is capped at 1", () => {
    const aff = emptyAffinity({ keywordAlerts: ["a", "b", "c"] });
    const p = paper({ title: "a b c match" });
    expect(topicAffinity(p, aff)).toBeLessThanOrEqual(1);
  });
});

describe("interestedMatch", () => {
  it("is 1 only when pmid is in the interested set", () => {
    const aff = emptyAffinity({ interestedPmids: new Set(["42"]) });
    expect(interestedMatch(paper({ pmid: "42" }), aff)).toBe(1);
    expect(interestedMatch(paper({ pmid: "99" }), aff)).toBe(0);
  });
});

describe("notInterestedPenalty", () => {
  it("is 1 when the exact paper was 👎ed", () => {
    const aff = emptyAffinity({ notInterestedPmids: new Set(["42"]) });
    expect(notInterestedPenalty(paper({ pmid: "42" }), aff)).toBe(1);
  });

  it("penalises same journal and shared tokens", () => {
    const aff = emptyAffinity({
      dislikedJournalSlugs: new Set(["jaci"]),
      dislikedTokens: new Set(["covid-19"]),
    });
    const p = paper({ journalSlug: "jaci", keywords: ["COVID-19"] });
    expect(notInterestedPenalty(p, aff)).toBeGreaterThan(0);
    expect(notInterestedPenalty(p, aff)).toBeLessThanOrEqual(1);
  });

  it("no penalty when nothing matches", () => {
    const aff = emptyAffinity({
      dislikedJournalSlugs: new Set(["jaci"]),
      dislikedTokens: new Set(["covid"]),
    });
    const p = paper({ journalSlug: "allergy", keywords: ["asthma"] });
    expect(notInterestedPenalty(p, aff)).toBe(0);
  });
});

describe("scorePaper (integration)", () => {
  const now = new Date("2026-04-15T00:00:00Z");

  it("positively boosts a paper matching all signals", () => {
    const aff = emptyAffinity({
      journalSlugs: new Set(["jaci"]),
      keywordAlerts: ["dupilumab"],
      interestedPmids: new Set(["42"]),
    });
    const p = paper({
      pmid: "42",
      journalSlug: "jaci",
      title: "Dupilumab in severe asthma",
      publicationDate: "2026-04-15",
      citationCount: 10,
    });
    const s = scorePaper(p, aff, now);
    // Roughly: 2.0 + >=0.5*1.5 + 1.0 + 0.5*ln(11) + 3.0 with no penalty
    expect(s).toBeGreaterThan(WEIGHTS.journal + WEIGHTS.interested);
  });

  it("heavily penalises a 👎ed paper even with recency", () => {
    const aff = emptyAffinity({
      notInterestedPmids: new Set(["13"]),
    });
    const p = paper({
      pmid: "13",
      publicationDate: "2026-04-15",
      citationCount: 100,
    });
    const s = scorePaper(p, aff, now);
    expect(s).toBeLessThan(0);
  });

  it("ranks a matching paper above a non-matching recent paper", () => {
    const aff = emptyAffinity({
      keywordAlerts: ["atopic dermatitis"],
    });
    const match = paper({
      pmid: "match",
      title: "Atopic dermatitis outcomes",
      publicationDate: "2026-03-15",
    });
    const noMatch = paper({
      pmid: "no",
      title: "Unrelated topic",
      publicationDate: "2026-04-15",
    });
    expect(scorePaper(match, aff, now)).toBeGreaterThan(scorePaper(noMatch, aff, now));
  });
});
