import { describe, expect, it } from "vitest";
import { buildInducedSubgraph } from "../induced-subgraph";

describe("buildInducedSubgraph", () => {
  it("keeps only edges with both endpoints in the pmid set", () => {
    const pmids = new Set(["1", "2", "3"]);
    const { edges } = buildInducedSubgraph(
      pmids,
      [
        { source_pmid: "1", target_pmid: "2" }, // both in set
        { source_pmid: "1", target_pmid: "99" }, // 99 not in set
      ],
      []
    );
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ type: "citation" });
  });

  it("labels an edge 'mention' when only a mention row connects the pair", () => {
    const { edges } = buildInducedSubgraph(
      new Set(["1", "2"]),
      [],
      [{ source_pmid: "1", mentioned_pmid: "2" }]
    );
    expect(edges).toEqual([{ source: "1", target: "2", type: "mention" }]);
  });

  it("labels an edge 'both' when citation and mention connect the same pair", () => {
    const { edges } = buildInducedSubgraph(
      new Set(["1", "2"]),
      [{ source_pmid: "1", target_pmid: "2" }],
      [{ source_pmid: "2", mentioned_pmid: "1" }] // reverse direction, same pair
    );
    expect(edges).toHaveLength(1);
    expect(edges[0].type).toBe("both");
  });

  it("collapses reciprocal citations into a single edge", () => {
    const { edges } = buildInducedSubgraph(
      new Set(["1", "2"]),
      [
        { source_pmid: "1", target_pmid: "2" },
        { source_pmid: "2", target_pmid: "1" },
      ],
      []
    );
    expect(edges).toHaveLength(1);
  });

  it("ignores self-loops", () => {
    const { edges } = buildInducedSubgraph(
      new Set(["1"]),
      [{ source_pmid: "1", target_pmid: "1" }],
      []
    );
    expect(edges).toHaveLength(0);
  });

  it("returns connectedPmids covering exactly the pmids that have an edge", () => {
    const { connectedPmids } = buildInducedSubgraph(
      new Set(["1", "2", "3"]), // 3 has no edge → dropped
      [{ source_pmid: "1", target_pmid: "2" }],
      []
    );
    expect([...connectedPmids].sort()).toEqual(["1", "2"]);
  });

  it("returns no edges and no connected pmids for an empty set", () => {
    const result = buildInducedSubgraph(new Set(), [], []);
    expect(result.edges).toEqual([]);
    expect(result.connectedPmids).toEqual([]);
  });
});
