import { describe, it, expect } from "vitest";
import { parseGraphViewFromQuery, serializeGraphView } from "@/hooks/use-graph-view";

describe("parseGraphViewFromQuery", () => {
  it("defaults to galaxy when no map param", () => {
    expect(parseGraphViewFromQuery(new URLSearchParams(""))).toEqual({ kind: "galaxy" });
  });
  it("parses topic:<slug>", () => {
    const q = new URLSearchParams("map=topic:asthma");
    expect(parseGraphViewFromQuery(q)).toEqual({ kind: "topic", slug: "asthma" });
  });
  it("parses topic + focus into highlight", () => {
    const q = new URLSearchParams("map=topic:asthma&focus=12345");
    expect(parseGraphViewFromQuery(q)).toEqual({
      kind: "highlight",
      slug: "asthma",
      focusedPmid: "12345",
    });
  });
  it("ignores focus without a topic", () => {
    const q = new URLSearchParams("focus=12345");
    expect(parseGraphViewFromQuery(q)).toEqual({ kind: "galaxy" });
  });
});

describe("serializeGraphView", () => {
  it("returns an empty querystring for galaxy", () => {
    expect(serializeGraphView({ kind: "galaxy" })).toBe("");
  });
  it("returns map=topic:<slug> for topic", () => {
    expect(serializeGraphView({ kind: "topic", slug: "asthma" })).toBe("map=topic%3Aasthma");
  });
  it("returns map + focus for highlight", () => {
    expect(serializeGraphView({ kind: "highlight", slug: "asthma", focusedPmid: "12345" }))
      .toBe("map=topic%3Aasthma&focus=12345");
  });
});
