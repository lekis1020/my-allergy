import { describe, it, expect } from "vitest";
import { buildGraphSnapshots, type SourceData } from "@/lib/graph/build-snapshots";

function emptySource(overrides: Partial<SourceData> = {}): SourceData {
  return {
    papers: [],
    citations: [],
    authors: [],
    mentions: [],
    journals: [],
    ...overrides,
  };
}

describe("buildGraphSnapshots — node build", () => {
  it("produces an empty galaxy and zero topics when there are no papers", () => {
    const out = buildGraphSnapshots(emptySource());
    expect(out.galaxy.nodes).toHaveLength(0);
    expect(out.galaxy.edges).toHaveLength(0);
    expect(out.topics.size).toBe(0);
  });

  it("assigns primary_topic from classifyPaperTopics on title+abstract", () => {
    const out = buildGraphSnapshots(emptySource({
      papers: [
        {
          pmid: "1",
          title: "Severe asthma management with biologics",
          abstract: "Asthma treatment review.",
          publication_date: "2025-01-01",
          epub_date: "2025-01-01",
          citation_count: 5,
          journal_id: "j1",
        },
      ],
      journals: [{ id: "j1", abbreviation: "JACI", color: "#123456" }],
    }));
    const asthma = out.topics.get("asthma");
    expect(asthma).toBeDefined();
    expect(asthma!.nodes[0].primary_topic).toBe("asthma");
    expect(asthma!.nodes[0].journal_abbreviation).toBe("JACI");
  });
});

describe("buildGraphSnapshots — citation and mention edges", () => {
  function withTwoPapers(extra: Partial<SourceData> = {}) {
    return emptySource({
      papers: [
        { pmid: "A", title: "Asthma biologics", abstract: "asthma asthma", publication_date: "2025-01-01", epub_date: null, citation_count: 0, journal_id: "j1" },
        { pmid: "B", title: "Severe asthma trial", abstract: "asthma", publication_date: "2025-02-01", epub_date: null, citation_count: 0, journal_id: "j1" },
      ],
      journals: [{ id: "j1", abbreviation: "JACI", color: "#000000" }],
      ...extra,
    });
  }

  it("creates a citation edge with weight 3 between A and B", () => {
    const out = buildGraphSnapshots(withTwoPapers({ citations: [{ source_pmid: "A", target_pmid: "B" }] }));
    const asthma = out.topics.get("asthma")!;
    expect(asthma.edges).toHaveLength(1);
    expect(asthma.edges[0].types).toContain("citation");
    expect(asthma.edges[0].weight).toBeCloseTo(3, 5);
  });

  it("creates a mention edge with weight 1.5", () => {
    const out = buildGraphSnapshots(withTwoPapers({ mentions: [{ source_pmid: "A", mentioned_pmid: "B" }] }));
    const asthma = out.topics.get("asthma")!;
    expect(asthma.edges).toHaveLength(1);
    expect(asthma.edges[0].types).toEqual(["mention"]);
    expect(asthma.edges[0].weight).toBeCloseTo(1.5, 5);
  });

  it("merges citation and mention on the same pair", () => {
    const out = buildGraphSnapshots(withTwoPapers({
      citations: [{ source_pmid: "A", target_pmid: "B" }],
      mentions: [{ source_pmid: "B", mentioned_pmid: "A" }],
    }));
    const e = out.topics.get("asthma")!.edges[0];
    expect(new Set(e.types)).toEqual(new Set(["citation", "mention"]));
    expect(e.weight).toBeCloseTo(3 + 1.5, 5);
  });

  it("ignores self-loops and unknown endpoints", () => {
    const out = buildGraphSnapshots(withTwoPapers({
      citations: [
        { source_pmid: "A", target_pmid: "A" },
        { source_pmid: "A", target_pmid: "Z" },
      ],
    }));
    expect(out.topics.get("asthma")!.edges).toHaveLength(0);
  });
});
