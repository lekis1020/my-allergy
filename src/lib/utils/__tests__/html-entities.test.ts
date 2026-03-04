import { describe, expect, it } from "vitest";
import { decodeHtmlEntities } from "../html-entities";

describe("decodeHtmlEntities", () => {
  it("decodes hex numeric entities", () => {
    expect(decodeHtmlEntities("FEV1 &#x2265; 80%")).toBe("FEV1 ≥ 80%");
  });

  it("decodes decimal numeric entities", () => {
    expect(decodeHtmlEntities("p &#8805; 0.05")).toBe("p ≥ 0.05");
  });

  it("decodes common named entities", () => {
    expect(decodeHtmlEntities("A &amp; B &lt; C")).toBe("A & B < C");
  });

  it("keeps unknown entities unchanged", () => {
    expect(decodeHtmlEntities("value &unknown; test")).toBe("value &unknown; test");
  });
});
