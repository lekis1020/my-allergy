import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { AuthorsList } from "../authors-list";
import { CitationGraph } from "../citation-graph";
import type { LinkedPaper } from "../paper-list-section";

const mkAuthor = (i: number) => ({
  last_name: `Smith${i}`,
  first_name: `John${i}`,
  initials: "JS",
  affiliation: `Inst of Medicine ${i}`,
  position: i,
});

const mkPaper = (i: number): LinkedPaper => ({
  pmid: `p${i}`,
  title: `Paper ${i} with allergy and asthma`,
  publication_date: "2025-01-01",
  epub_date: "2025-01-01",
  citation_count: 5,
  journal_abbreviation: "Allergy",
  journal_color: "#ff0000",
});

describe("AuthorsList", () => {
  it("renders 3 authors uncollapsed", () => {
    const html = renderToStaticMarkup(
      React.createElement(AuthorsList, {
        authors: [mkAuthor(1), mkAuthor(2), mkAuthor(3)],
      })
    );
    expect(html).toContain("Smith1");
    expect(html).toContain("Smith3");
    expect(html).not.toContain("Show all");
  });

  it("renders 15 authors collapsed with toggle", () => {
    const authors = Array.from({ length: 15 }, (_, i) => mkAuthor(i));
    const html = renderToStaticMarkup(
      React.createElement(AuthorsList, { authors })
    );
    expect(html).toContain("Show all");
    expect(html).toContain("15 authors");
    expect(html).toContain("Smith14"); // last author shown in preview
  });

  it("handles empty authors", () => {
    const html = renderToStaticMarkup(
      React.createElement(AuthorsList, { authors: [] })
    );
    expect(html).toContain("Authors");
  });

  it("handles author with null first_name / affiliation", () => {
    const html = renderToStaticMarkup(
      React.createElement(AuthorsList, {
        authors: [
          {
            last_name: "Solo",
            first_name: null,
            initials: null,
            affiliation: null,
            position: 1,
          },
        ],
      })
    );
    expect(html).toContain("Solo");
  });

  it("handles HTML entities in affiliation", () => {
    const html = renderToStaticMarkup(
      React.createElement(AuthorsList, {
        authors: [
          {
            last_name: "Test",
            first_name: null,
            initials: null,
            affiliation: "Université &amp; Hospital",
            position: 1,
          },
        ],
      })
    );
    expect(html).toContain("Test");
  });
});

describe("CitationGraph", () => {
  const thisPaper = {
    title: "The current paper on allergies",
    journalAbbreviation: "JACI",
    journalColor: "#0066cc",
    publicationDate: "2026-04-01",
  };

  it("renders with empty references and citations", () => {
    const html = renderToStaticMarkup(
      React.createElement(CitationGraph, {
        thisPaper,
        references: [],
        citations: [],
      })
    );
    expect(html).toContain("THIS PAPER");
    expect(html).toContain("No references indexed");
    expect(html).toContain("No citations yet");
  });

  it("renders with some references and citations", () => {
    const html = renderToStaticMarkup(
      React.createElement(CitationGraph, {
        thisPaper,
        references: [mkPaper(1), mkPaper(2)],
        citations: [mkPaper(3)],
      })
    );
    expect(html).toContain("Paper 1");
    expect(html).toContain("Paper 2");
    expect(html).toContain("Paper 3");
    expect(html).toContain("This paper cites (2)");
    expect(html).toContain("Cited by (1)");
  });

  it("truncates to maxPerSide and shows +N more", () => {
    const refs = Array.from({ length: 8 }, (_, i) => mkPaper(i));
    const html = renderToStaticMarkup(
      React.createElement(CitationGraph, {
        thisPaper,
        references: refs,
        citations: [],
        maxPerSide: 5,
      })
    );
    expect(html).toContain("+3 more references");
  });

  it("handles null epub_date", () => {
    const paper: LinkedPaper = {
      pmid: "p99",
      title: "No epub",
      publication_date: "2024-06-15",
      epub_date: null,
      citation_count: null,
      journal_abbreviation: "NEJM",
      journal_color: "#333",
    };
    const html = renderToStaticMarkup(
      React.createElement(CitationGraph, {
        thisPaper,
        references: [paper],
        citations: [],
      })
    );
    expect(html).toContain("2024"); // year extracted from publication_date
  });

  it("handles HTML entities in title", () => {
    const html = renderToStaticMarkup(
      React.createElement(CitationGraph, {
        thisPaper: { ...thisPaper, title: "IL-4 &amp; IgE response" },
        references: [],
        citations: [],
      })
    );
    expect(html).toContain("THIS PAPER");
  });
});
