import { describe, expect, it } from "vitest";
import { toPaperDto, type PaperRow } from "../transform";

const authors = [
  { last_name: "Kim", initials: "SK", position: 1 },
  { last_name: "Lee", initials: "JL", position: 2 },
  { last_name: "Park", initials: null, position: 3 },
];

const makePaperRow = (authorCount?: number): PaperRow => ({
  id: "paper-1",
  pmid: "12345678",
  doi: null,
  title: "A paper about allergy",
  abstract: "An abstract about asthma.",
  publication_date: "2025-01-01",
  epub_date: "2025-01-02",
  volume: null,
  issue: null,
  pages: null,
  keywords: [],
  mesh_terms: [],
  ai_summary: null,
  citation_count: 0,
  journal_id: "journal-1",
  publication_types: ["Journal Article"],
  journals: {
    id: "journal-1",
    name: "Journal of Allergy",
    abbreviation: "J Allergy",
    color: "#3366ff",
    slug: "j-allergy",
  },
  paper_authors: authors,
  author_count: authorCount === undefined ? undefined : [{ count: authorCount }],
});

describe("toPaperDto", () => {
  it("uses the author aggregate and normalizes omitted author details", () => {
    const dto = toPaperDto(makePaperRow(8));

    expect(dto.author_count).toBe(8);
    expect(dto.authors).toEqual([
      { last_name: "Kim", first_name: null, initials: "SK", affiliation: null, position: 1 },
      { last_name: "Lee", first_name: null, initials: "JL", affiliation: null, position: 2 },
      { last_name: "Park", first_name: null, initials: null, affiliation: null, position: 3 },
    ]);
  });

  it("falls back to the loaded author count when the aggregate is missing", () => {
    expect(toPaperDto(makePaperRow()).author_count).toBe(3);
  });
});
