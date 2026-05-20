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
