import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import type { JournalConfig } from "@/lib/constants/journals";
import { JournalFilterPanel, sortJournals } from "../journal-filter-panel";

const mk = (
  abbreviation: string,
  impactFactor: number | null,
  slug = abbreviation.toLowerCase().replace(/\s+/g, "-"),
): JournalConfig => ({
  name: abbreviation,
  abbreviation,
  issn: null,
  eIssn: null,
  impactFactor,
  color: "#000",
  slug,
  pubmedQuery: "",
});

describe("sortJournals", () => {
  const journals: JournalConfig[] = [
    mk("Allergy", 12.0),
    mk("Lancet", 88.5),
    mk("Int Arch Allergy", null),
    mk("Contact Derm", 4.6),
    mk("Curr Allergy", 4.6), // IF tie with Contact Derm
    mk("BMJ", 42.7),
  ];

  it("alpha order sorts by abbreviation ascending", () => {
    const sorted = sortJournals(journals, "alpha").map((j) => j.abbreviation);
    expect(sorted).toEqual([
      "Allergy",
      "BMJ",
      "Contact Derm",
      "Curr Allergy",
      "Int Arch Allergy",
      "Lancet",
    ]);
  });

  it("if order sorts by impactFactor descending, nulls last, ties alphabetical", () => {
    const sorted = sortJournals(journals, "if").map((j) => j.abbreviation);
    expect(sorted).toEqual([
      "Lancet",         // 88.5
      "BMJ",            // 42.7
      "Allergy",        // 12.0
      "Contact Derm",   // 4.6 (tied; alpha first)
      "Curr Allergy",   // 4.6 (tied)
      "Int Arch Allergy", // null → last
    ]);
  });

  it("does not mutate the input array", () => {
    const original = [...journals];
    sortJournals(journals, "if");
    expect(journals).toEqual(original);
  });

  it("handles empty input", () => {
    expect(sortJournals([], "alpha")).toEqual([]);
    expect(sortJournals([], "if")).toEqual([]);
  });

  it("places multiple null IFs at end, alphabetised among themselves", () => {
    const list = [mk("Z journal", null), mk("A journal", null), mk("Mid", 5)];
    const sorted = sortJournals(list, "if").map((j) => j.abbreviation);
    expect(sorted).toEqual(["Mid", "A journal", "Z journal"]);
  });
});

describe("JournalFilterPanel SSR", () => {
  const journals: JournalConfig[] = [
    mk("Zeta", 5.0),
    mk("Alpha", 10.0),
    mk("Mid", 7.0),
  ];

  it("renders journals in alpha order on first paint (SSR default)", () => {
    const html = renderToStaticMarkup(
      React.createElement(JournalFilterPanel, {
        journals,
        activeJournals: [],
        onToggle: () => {},
        onClearAll: () => {},
      }),
    );
    const alphaIdx = html.indexOf(">Alpha<");
    const midIdx = html.indexOf(">Mid<");
    const zetaIdx = html.indexOf(">Zeta<");
    expect(alphaIdx).toBeGreaterThan(-1);
    expect(midIdx).toBeGreaterThan(alphaIdx);
    expect(zetaIdx).toBeGreaterThan(midIdx);
  });

  it("renders the sort toggle controls", () => {
    const html = renderToStaticMarkup(
      React.createElement(JournalFilterPanel, {
        journals,
        activeJournals: [],
        onToggle: () => {},
        onClearAll: () => {},
      }),
    );
    expect(html).toContain("A→Z");
    expect(html).toContain("IF ↓");
  });
});
