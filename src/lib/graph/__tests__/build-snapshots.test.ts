import { describe, it, expect } from "vitest";
import { buildGraphSnapshots, type SourceData } from "@/lib/graph/build-snapshots";
import type { GalaxyNode, GalaxyEdge } from "@/lib/graph/types";

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

  it("uses persisted topic_tags when present, without needing an abstract", () => {
    const out = buildGraphSnapshots(emptySource({
      papers: [
        {
          pmid: "1",
          title: "Severe asthma management with biologics",
          // No abstract supplied — recompute no longer fetches it.
          topic_tags: ["urticaria"],
          publication_date: "2025-01-01",
          epub_date: "2025-01-01",
          citation_count: 5,
          journal_id: "j1",
        },
      ],
      journals: [{ id: "j1", abbreviation: "JACI", color: "#123456" }],
    }));
    // Stored tag wins over what title-classification ("asthma") would produce.
    expect(out.topics.get("asthma")).toBeUndefined();
    const urticaria = out.topics.get("urticaria");
    expect(urticaria).toBeDefined();
    expect(urticaria!.nodes[0].primary_topic).toBe("urticaria");
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

describe("buildGraphSnapshots — per-topic cap", () => {
  it("caps a topic at PER_TOPIC_CAP nodes by (degree desc, citation desc)", () => {
    // 100 papers all tagged asthma; pmids that have citations should win.
    const papers = Array.from({ length: 100 }, (_, i) => ({
      pmid: `p${i}`,
      title: "Asthma",
      abstract: "asthma asthma",
      publication_date: `2024-01-${(i % 28) + 1}`,
      epub_date: null,
      citation_count: i, // higher i → higher tiebreaker
      journal_id: "j1",
    }));
    // Give p99 a single citation edge so it has degree 1.
    const citations = [{ source_pmid: "p99", target_pmid: "p98" }];
    const out = buildGraphSnapshots(emptySource({
      papers,
      citations,
      journals: [{ id: "j1", abbreviation: "JACI", color: "#000" }],
    }));
    const asthma = out.topics.get("asthma")!;
    expect(asthma.nodes.length).toBe(80);
    expect(asthma.truncated.total).toBe(100);
    expect(asthma.truncated.dropped).toBe(20);
    // p99 and p98 (degree 1) should be in the slice.
    const pmids = asthma.nodes.map((n) => n.pmid);
    expect(pmids).toContain("p99");
    expect(pmids).toContain("p98");
    // Edges should only include endpoints in the slice.
    for (const e of asthma.edges) {
      expect(pmids).toContain(e.source);
      expect(pmids).toContain(e.target);
    }
  });
});

describe("buildGraphSnapshots — galaxy aggregation", () => {
  it("aggregates cross-topic edges into galaxy edges with summed weights", () => {
    const out = buildGraphSnapshots(emptySource({
      papers: [
        { pmid: "A", title: "Asthma study", abstract: "asthma", publication_date: "2025-01-01", epub_date: null, citation_count: 0, journal_id: "j1" },
        { pmid: "B", title: "Urticaria study", abstract: "urticaria", publication_date: "2025-02-01", epub_date: null, citation_count: 0, journal_id: "j1" },
      ],
      citations: [{ source_pmid: "A", target_pmid: "B" }],
      journals: [{ id: "j1", abbreviation: "JACI", color: "#000" }],
    }));
    expect(out.galaxy.nodes.find((n: GalaxyNode) => n.topic_slug === "asthma")?.paper_count).toBe(1);
    expect(out.galaxy.nodes.find((n: GalaxyNode) => n.topic_slug === "urticaria")?.paper_count).toBe(1);
    const cross = out.galaxy.edges.find(
      (e: GalaxyEdge) =>
        (e.source === "asthma" && e.target === "urticaria") ||
        (e.source === "urticaria" && e.target === "asthma")
    );
    expect(cross).toBeDefined();
    expect(cross!.weight).toBeCloseTo(3, 5);
    expect(cross!.paper_pair_count).toBe(1);
  });

  it("does not include same-topic edges in the galaxy", () => {
    const out = buildGraphSnapshots(emptySource({
      papers: [
        { pmid: "A", title: "Asthma 1", abstract: "asthma", publication_date: "2025-01-01", epub_date: null, citation_count: 0, journal_id: "j1" },
        { pmid: "B", title: "Asthma 2", abstract: "asthma", publication_date: "2025-02-01", epub_date: null, citation_count: 0, journal_id: "j1" },
      ],
      citations: [{ source_pmid: "A", target_pmid: "B" }],
      journals: [{ id: "j1", abbreviation: "JACI", color: "#000" }],
    }));
    expect(out.galaxy.edges).toHaveLength(0);
  });
});

describe("buildGraphSnapshots — similarity pass", () => {
  it("creates a similarity edge weighted by the similarity score", () => {
    const out = buildGraphSnapshots(emptySource({
      papers: [
        { pmid: "A", title: "Asthma study", abstract: "asthma", publication_date: "2025-01-01", epub_date: null, citation_count: 0, journal_id: "j1" },
        { pmid: "B", title: "Asthma cohort", abstract: "asthma", publication_date: "2025-02-01", epub_date: null, citation_count: 0, journal_id: "j1" },
      ],
      similarities: [{ source_pmid: "A", target_pmid: "B", similarity: 0.8 }],
      journals: [{ id: "j1", abbreviation: "JACI", color: "#000" }],
    }));
    const asthma = out.topics.get("asthma")!;
    expect(asthma.edges).toHaveLength(1);
    expect(asthma.edges[0].types).toContain("similarity");
    // W_SIMILARITY (1.5) * similarity (0.8) + topic reinforcement (1.0)
    expect(asthma.edges[0].weight).toBeCloseTo(1.5 * 0.8 + 1, 5);
  });

  it("merges with citation on the same pair regardless of direction", () => {
    const out = buildGraphSnapshots(emptySource({
      papers: [
        { pmid: "A", title: "Asthma study", abstract: "asthma", publication_date: "2025-01-01", epub_date: null, citation_count: 0, journal_id: "j1" },
        { pmid: "B", title: "Asthma cohort", abstract: "asthma", publication_date: "2025-02-01", epub_date: null, citation_count: 0, journal_id: "j1" },
      ],
      citations: [{ source_pmid: "A", target_pmid: "B" }],
      similarities: [{ source_pmid: "B", target_pmid: "A", similarity: 0.5 }],
      journals: [{ id: "j1", abbreviation: "JACI", color: "#000" }],
    }));
    const e = out.topics.get("asthma")!.edges[0];
    expect(new Set(e.types)).toEqual(new Set(["citation", "similarity", "topic"]));
    // citation 3 + similarity (1.5 * 0.5) + topic 1
    expect(e.weight).toBeCloseTo(3 + 1.5 * 0.5 + 1, 5);
  });

  it("dedupes per pair: a second similarity row never bumps the weight twice", () => {
    const out = buildGraphSnapshots(emptySource({
      papers: [
        { pmid: "A", title: "Asthma study", abstract: "asthma", publication_date: "2025-01-01", epub_date: null, citation_count: 0, journal_id: "j1" },
        { pmid: "B", title: "Asthma cohort", abstract: "asthma", publication_date: "2025-02-01", epub_date: null, citation_count: 0, journal_id: "j1" },
      ],
      similarities: [
        { source_pmid: "A", target_pmid: "B", similarity: 0.9 },
        { source_pmid: "B", target_pmid: "A", similarity: 0.4 },
      ],
      journals: [{ id: "j1", abbreviation: "JACI", color: "#000" }],
    }));
    const e = out.topics.get("asthma")!.edges[0];
    // Only the first encountered row contributes; deduped to a single similarity contribution.
    expect(e.weight).toBeCloseTo(1.5 * 0.9 + 1, 5);
  });

  it("ignores self-loops and unknown endpoints", () => {
    const out = buildGraphSnapshots(emptySource({
      papers: [
        { pmid: "A", title: "Asthma", abstract: "asthma", publication_date: "2025-01-01", epub_date: null, citation_count: 0, journal_id: "j1" },
        { pmid: "B", title: "Asthma", abstract: "asthma", publication_date: "2025-02-01", epub_date: null, citation_count: 0, journal_id: "j1" },
      ],
      similarities: [
        { source_pmid: "A", target_pmid: "A", similarity: 0.9 },
        { source_pmid: "A", target_pmid: "Z", similarity: 0.9 },
      ],
      journals: [{ id: "j1", abbreviation: "JACI", color: "#000" }],
    }));
    expect(out.topics.get("asthma")!.edges).toHaveLength(0);
  });
});
