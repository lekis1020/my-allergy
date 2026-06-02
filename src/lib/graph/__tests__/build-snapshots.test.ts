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
