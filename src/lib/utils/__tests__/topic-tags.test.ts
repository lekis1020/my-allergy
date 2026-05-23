import { describe, expect, it } from "vitest";
import { classifyPaperTopics, TOPIC_META } from "../topic-tags";

describe("classifyPaperTopics — allergen_immunotherapy", () => {
  it("tags venom (hymenoptera) immunotherapy papers", () => {
    const tags = classifyPaperTopics({
      title: "Venom immunotherapy for hymenoptera anaphylaxis",
      abstract: "Bee venom immunotherapy reduced systemic reactions.",
      keywords: ["venom immunotherapy"],
      meshTerms: ["Desensitization, Immunologic"],
    });
    expect(tags).toContain("allergen_immunotherapy");
  });

  it("tags grass-pollen SLIT papers", () => {
    const tags = classifyPaperTopics({
      title: "Sublingual immunotherapy with grass pollen tablets",
      abstract: "SLIT improved seasonal allergic rhinitis symptoms.",
      keywords: ["grass pollen immunotherapy"],
      meshTerms: [],
    });
    expect(tags).toContain("allergen_immunotherapy");
  });

  it("tags house dust mite immunotherapy papers", () => {
    const tags = classifyPaperTopics({
      title: "House dust mite immunotherapy in adult asthma",
      abstract: "Subcutaneous immunotherapy with HDM extract.",
      keywords: ["house dust mite immunotherapy", "subcutaneous immunotherapy"],
      meshTerms: [],
    });
    expect(tags).toContain("allergen_immunotherapy");
  });

  it("tags cat-allergen immunotherapy papers", () => {
    const tags = classifyPaperTopics({
      title: "Cat allergen immunotherapy with Fel d 1 peptides",
      abstract: null,
      keywords: ["cat allergen immunotherapy"],
      meshTerms: [],
    });
    expect(tags).toContain("allergen_immunotherapy");
  });

  it("does NOT tag cancer/checkpoint immunotherapy papers", () => {
    const tags = classifyPaperTopics({
      title: "Checkpoint immunotherapy in non-small-cell lung cancer",
      abstract: "PD-1 inhibitors and immune-related adverse events.",
      keywords: [],
      meshTerms: [],
    });
    expect(tags).not.toContain("allergen_immunotherapy");
  });

  it("tags oral immunotherapy (OIT) as BOTH food_allergy and allergen_immunotherapy", () => {
    // OIT is allergen-specific immunotherapy delivered orally — it belongs in
    // both the food-allergy and immunotherapy buckets.
    const tags = classifyPaperTopics({
      title: "Oral immunotherapy for peanut allergy",
      abstract: "OIT achieved sustained unresponsiveness.",
      keywords: ["peanut allergy", "oral immunotherapy"],
      meshTerms: [],
    });
    expect(tags).toContain("food_allergy");
    expect(tags).toContain("allergen_immunotherapy");
  });

  it("exposes a TOPIC_META entry for the new tag", () => {
    expect(TOPIC_META.allergen_immunotherapy).toBeDefined();
    expect(TOPIC_META.allergen_immunotherapy.label).toBe("Immunotherapy");
  });
});

describe("classifyPaperTopics — angioedema", () => {
  it("tags hereditary angioedema papers as angioedema, not urticaria", () => {
    const tags = classifyPaperTopics({
      title: "Hereditary angioedema: a review of pathophysiology and treatment",
      abstract: "C1 inhibitor deficiency leads to bradykinin mediated swelling.",
      keywords: ["hereditary angioedema", "C1 inhibitor"],
      meshTerms: ["Angioedemas, Hereditary"],
    });
    expect(tags).toContain("angioedema");
    expect(tags).not.toContain("urticaria");
  });

  it("tags ACE-inhibitor induced angioedema as angioedema", () => {
    const tags = classifyPaperTopics({
      title: "ACE inhibitor induced angioedema in hypertensive patients",
      abstract: "Bradykinin angioedema after enalapril.",
      keywords: ["ACE inhibitor angioedema"],
      meshTerms: ["Angioedema"],
    });
    expect(tags).toContain("angioedema");
    expect(tags).not.toContain("urticaria");
  });

  it("tags HAE therapeutics (lanadelumab, icatibant) as angioedema", () => {
    const tags = classifyPaperTopics({
      title: "Lanadelumab for long-term prophylaxis of hereditary angioedema",
      abstract: "Icatibant rescues acute attacks via bradykinin B2 antagonism.",
      keywords: ["lanadelumab", "icatibant"],
      meshTerms: [],
    });
    expect(tags).toContain("angioedema");
  });

  it("keeps CSU papers in urticaria even when angioedema is mentioned", () => {
    // CSU patients can present with concurrent angioedema. The urticaria
    // signal should still dominate the classification.
    const tags = classifyPaperTopics({
      title: "Omalizumab in chronic spontaneous urticaria with angioedema",
      abstract: "CSU patients with comorbid angioedema responded to omalizumab.",
      keywords: ["chronic spontaneous urticaria", "omalizumab"],
      meshTerms: ["Urticaria", "Chronic Urticaria"],
    });
    expect(tags).toContain("urticaria");
  });

  it("exposes a TOPIC_META entry for angioedema", () => {
    expect(TOPIC_META.angioedema).toBeDefined();
    expect(TOPIC_META.angioedema.label).toBe("Angioedema");
  });
});
