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
    expect(asthma.edges[0].types).toContain("topic"); // topic reinforcement adds "topic"
    expect(asthma.edges[0].weight).toBeCloseTo(3 + 1, 5); // citation + topic overlap=1
  });

  it("creates a mention edge with weight 1.5", () => {
    const out = buildGraphSnapshots(withTwoPapers({ mentions: [{ source_pmid: "A", mentioned_pmid: "B" }] }));
    const asthma = out.topics.get("asthma")!;
    expect(asthma.edges).toHaveLength(1);
    expect(asthma.edges[0].types).toContain("mention");
    expect(asthma.edges[0].types).toContain("topic"); // topic reinforcement adds "topic"
    expect(asthma.edges[0].weight).toBeCloseTo(1.5 + 1, 5); // mention + topic overlap=1
  });

  it("merges citation and mention on the same pair", () => {
    const out = buildGraphSnapshots(withTwoPapers({
      citations: [{ source_pmid: "A", target_pmid: "B" }],
      mentions: [{ source_pmid: "B", mentioned_pmid: "A" }],
    }));
    const e = out.topics.get("asthma")!.edges[0];
    expect(new Set(e.types)).toEqual(new Set(["citation", "mention", "topic"]));
    expect(e.weight).toBeCloseTo(3 + 1.5 + 1, 5); // citation + mention + topic overlap=1
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

describe("buildGraphSnapshots — coauthor pass", () => {
  it("links two papers that share first author", () => {
    const out = buildGraphSnapshots(emptySource({
      papers: [
        { pmid: "A", title: "Asthma study", abstract: "asthma", publication_date: "2025-01-01", epub_date: null, citation_count: 0, journal_id: "j1" },
        { pmid: "B", title: "Asthma cohort", abstract: "asthma", publication_date: "2025-02-01", epub_date: null, citation_count: 0, journal_id: "j1" },
      ],
      authors: [
        { pmid: "A", last_name: "Kim", first_name: "Soo", initials: null, position: 1, is_last: false },
        { pmid: "A", last_name: "Park", first_name: "Min", initials: null, position: 5, is_last: true },
        { pmid: "B", last_name: "Kim", first_name: "Soo", initials: null, position: 1, is_last: false },
        { pmid: "B", last_name: "Lee", first_name: "J", initials: null, position: 4, is_last: true },
      ],
      journals: [{ id: "j1", abbreviation: "JACI", color: "#000" }],
    }));
    const asthma = out.topics.get("asthma")!;
    expect(asthma.edges).toHaveLength(1);
    expect(asthma.edges[0].types).toContain("coauthor");
    expect(asthma.edges[0].weight).toBeCloseTo(2 + 1, 5); // coauthor + topic reinforcement
  });

  it("links two papers across first ↔ last author position", () => {
    const out = buildGraphSnapshots(emptySource({
      papers: [
        { pmid: "A", title: "Asthma 1", abstract: "asthma", publication_date: "2025-01-01", epub_date: null, citation_count: 0, journal_id: "j1" },
        { pmid: "B", title: "Asthma 2", abstract: "asthma", publication_date: "2025-02-01", epub_date: null, citation_count: 0, journal_id: "j1" },
      ],
      authors: [
        { pmid: "A", last_name: "Park", first_name: "M", initials: null, position: 1, is_last: false },
        { pmid: "B", last_name: "Park", first_name: "M", initials: null, position: 6, is_last: true },
      ],
      journals: [{ id: "j1", abbreviation: "JACI", color: "#000" }],
    }));
    const e = out.topics.get("asthma")!.edges[0];
    expect(e.types).toContain("coauthor");
  });

  it("drops authors above the common-name guard", () => {
    const papers = Array.from({ length: 250 }, (_, i) => ({
      pmid: `p${i}`, title: "Asthma", abstract: "asthma", publication_date: "2025-01-01", epub_date: null, citation_count: 0, journal_id: "j1",
    }));
    const authors = papers.map((p) => ({
      pmid: p.pmid, last_name: "Smith", first_name: "J", initials: null, position: 1, is_last: false,
    }));
    const out = buildGraphSnapshots(emptySource({
      papers, authors, journals: [{ id: "j1", abbreviation: "JACI", color: "#000" }],
    }));
    // No coauthor edges should be created because "smith|j" exceeds the guard.
    const totalEdges = [...out.topics.values()].reduce((n, t) => n + t.edges.length, 0);
    expect(totalEdges).toBe(0);
  });
});

describe("buildGraphSnapshots — topic reinforcement", () => {
  it("adds 'topic' to types and 1.0 per shared topic, only on existing edges", () => {
    const out = buildGraphSnapshots(emptySource({
      papers: [
        { pmid: "A", title: "Severe asthma in urticaria patients", abstract: "asthma urticaria", publication_date: "2025-01-01", epub_date: null, citation_count: 0, journal_id: "j1" },
        { pmid: "B", title: "Asthma trial", abstract: "asthma", publication_date: "2025-02-01", epub_date: null, citation_count: 0, journal_id: "j1" },
      ],
      citations: [{ source_pmid: "A", target_pmid: "B" }],
      journals: [{ id: "j1", abbreviation: "JACI", color: "#000" }],
    }));
    const edges = [...out.topics.values()].flatMap((t) => t.edges);
    expect(edges).toHaveLength(1);
    expect(new Set(edges[0].types)).toEqual(new Set(["citation", "topic"]));
    expect(edges[0].weight).toBeGreaterThanOrEqual(3 + 1);
  });

  it("does not create topic-only edges", () => {
    const out = buildGraphSnapshots(emptySource({
      papers: [
        { pmid: "A", title: "Asthma", abstract: "asthma", publication_date: "2025-01-01", epub_date: null, citation_count: 0, journal_id: "j1" },
        { pmid: "B", title: "Asthma", abstract: "asthma", publication_date: "2025-02-01", epub_date: null, citation_count: 0, journal_id: "j1" },
      ],
      journals: [{ id: "j1", abbreviation: "JACI", color: "#000" }],
    }));
    const edges = [...out.topics.values()].flatMap((t) => t.edges);
    expect(edges).toHaveLength(0);
  });
});
