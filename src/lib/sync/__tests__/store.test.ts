import { describe, expect, it } from "vitest";
import { isPaperUnchanged, type ComparablePaper } from "../store";

const base: ComparablePaper = {
  title: "IL-5 in eosinophilic asthma",
  abstract: "Background. Methods. Results.",
  doi: "10.1000/abc",
  publication_date: "2026-01-15",
  epub_date: "2026-01-10",
  volume: "12",
  issue: "3",
  pages: "100-110",
  keywords: ["asthma", "IL-5"],
  mesh_terms: ["Asthma", "Eosinophils"],
  publication_types: ["Journal Article"],
  topic_tags: ["asthma", "biologics"],
};

const clone = (overrides: Partial<ComparablePaper> = {}): ComparablePaper => ({
  ...base,
  keywords: [...(base.keywords ?? [])],
  mesh_terms: [...(base.mesh_terms ?? [])],
  publication_types: [...(base.publication_types ?? [])],
  topic_tags: [...(base.topic_tags ?? [])],
  ...overrides,
});

describe("isPaperUnchanged", () => {
  it("returns true for identical content", () => {
    expect(isPaperUnchanged(clone(), clone())).toBe(true);
  });

  it("treats null and empty array as equivalent (no spurious rewrite)", () => {
    const incoming = clone({ keywords: [] });
    const existing = clone({ keywords: null });
    expect(isPaperUnchanged(incoming, existing)).toBe(true);
  });

  it("detects a changed scalar field", () => {
    expect(isPaperUnchanged(clone({ title: "New title" }), clone())).toBe(false);
  });

  it("detects a changed abstract (the common late-correction case)", () => {
    expect(isPaperUnchanged(clone({ abstract: "Revised." }), clone())).toBe(false);
  });

  it("detects a null/value transition on a scalar", () => {
    expect(isPaperUnchanged(clone({ doi: null }), clone())).toBe(false);
  });

  it("detects array membership changes", () => {
    expect(isPaperUnchanged(clone({ keywords: ["asthma"] }), clone())).toBe(false);
  });

  it("detects array order changes", () => {
    expect(isPaperUnchanged(clone({ keywords: ["IL-5", "asthma"] }), clone())).toBe(false);
  });

  it("detects topic_tags reclassification", () => {
    expect(isPaperUnchanged(clone({ topic_tags: ["asthma"] }), clone())).toBe(false);
  });
});
