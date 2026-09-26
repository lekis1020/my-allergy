import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PaperWithJournal } from "@/types/filters";
import { PaperAuthors } from "../paper-authors";
import { PaperCard } from "../paper-card";

const authors = [
  { last_name: "Kim", first_name: null, initials: "SK", affiliation: null, position: 1 },
  { last_name: "Lee", first_name: null, initials: "JL", affiliation: null, position: 2 },
  { last_name: "Park", first_name: null, initials: "HP", affiliation: null, position: 3 },
];

const paper: PaperWithJournal = {
  id: "paper-1",
  pmid: "12345678",
  doi: null,
  title: "A paper about allergy",
  abstract: null,
  publication_date: "2025-01-01",
  volume: null,
  issue: null,
  pages: null,
  keywords: [],
  mesh_terms: [],
  citation_count: 0,
  journal_id: "journal-1",
  journal_name: "Journal of Allergy",
  journal_abbreviation: "J Allergy",
  journal_color: "#3366ff",
  journal_slug: "j-allergy",
  topic_tags: [],
  authors,
  author_count: 8,
};

describe("PaperAuthors", () => {
  it("renders remaining authors from the total count", () => {
    const html = renderToStaticMarkup(
      React.createElement(PaperAuthors, { authors, total: 8 }),
    );

    expect(html).toContain("+5 more");
  });
});

describe("PaperCard", () => {
  it("renders the total author count when only some authors are loaded", () => {
    const html = renderToStaticMarkup(React.createElement(PaperCard, { paper }));

    expect(html).toContain("8 authors");
  });
});
