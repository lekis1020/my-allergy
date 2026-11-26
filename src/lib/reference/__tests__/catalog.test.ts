import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { CatalogList } from "@/components/reference/catalog-list";
import {
  filterCatalogEntries,
  groupCatalog,
  noMatchMessage,
  searchableFields,
} from "@/lib/reference/catalog";
import { REFERENCE_SCREENS, getScreen, reviewState } from "@/lib/reference";

const LIST_ROUTES = [
  "scoring-tools",
  "drug-cross-reactivity",
  "allergen-cross-reactivity",
  "contrast-media",
] as const;

describe("catalog lists with no query", () => {
  it("ships a list route for each catalog", () => {
    expect(REFERENCE_SCREENS.map((screen) => screen.slug)).toEqual([...LIST_ROUTES]);
  });

  it.each(LIST_ROUTES)("keeps every entry visible on %s when the query is empty", (slug) => {
    const screen = getScreen(slug);
    expect(screen).toBeDefined();
    if (!screen) return;
    const visible = filterCatalogEntries(screen, "", null);
    expect(visible.map((entry) => entry.id)).toEqual(screen.entries.map((entry) => entry.id));
    const html = renderToStaticMarkup(
      React.createElement(CatalogList, { screen, query: "", condition: null }),
    );
    expect(html).toContain('data-catalog-list="results"');
    for (const entry of screen.entries) {
      expect(html).toContain(entry.label);
    }
  });

  it("groups scoring tools by the condition already in the published line", () => {
    const screen = getScreen("scoring-tools");
    expect(screen).toBeDefined();
    if (!screen) return;
    const groups = groupCatalog(screen, screen.entries);
    const atopic = groups.find((group) => group.heading === "Atopic dermatitis");
    expect(atopic?.entries.map((entry) => entry.label)).toEqual([
      "SCORAD",
      "EASI",
      "POEM",
      "vIGA-AD",
      "ADCT",
    ]);
    expect(groups.some((group) => group.headingPending)).toBe(false);
    expect(reviewState(screen)).toEqual({ kind: "cited", checkedOn: "2026-11-19" });
  });

  it("lists placeholder drugs and agents alphabetically, with no invented class", () => {
    for (const slug of ["drug-cross-reactivity", "contrast-media"] as const) {
      const screen = getScreen(slug);
      expect(screen).toBeDefined();
      if (!screen) return;
      const [group] = groupCatalog(screen, screen.entries);
      expect(group?.heading).toBeNull();
      expect(group?.headingPending).toBe(false);
      expect(group?.entries.every((entry) => entry.groupLabel === null)).toBe(true);
      expect(reviewState(screen)).toEqual({ kind: "pending" });
    }
  });

  it("groups placeholder allergens under a pending category", () => {
    const screen = getScreen("allergen-cross-reactivity");
    expect(screen).toBeDefined();
    if (!screen) return;
    const groups = groupCatalog(screen, screen.entries);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.headingPending).toBe(true);
    expect(groups[0]?.entries.map((entry) => entry.label)).toEqual([
      "Allergen X",
      "Allergen Y",
    ]);
  });
});

describe("catalog search filters the list", () => {
  it("matches a scoring tool by abbreviation or name and ignores guidance text", () => {
    const screen = getScreen("scoring-tools");
    expect(screen).toBeDefined();
    if (!screen) return;
    expect(filterCatalogEntries(screen, "scorad", null).map((entry) => entry.id)).toEqual([
      "scorad",
    ]);
    expect(filterCatalogEntries(screen, "Eczema Area", null).map((entry) => entry.id)).toEqual([
      "easi",
    ]);
    const byGuidance = filterCatalogEntries(screen, "EuroSCAR", null);
    expect(byGuidance).toEqual([]);
  });

  it("keeps a condition chip and a query together", () => {
    const screen = getScreen("scoring-tools");
    expect(screen).toBeDefined();
    if (!screen) return;
    expect(
      filterCatalogEntries(screen, "act", "Asthma").map((entry) => entry.label),
    ).toContain("ACT");
    expect(filterCatalogEntries(screen, "uct", "Atopic dermatitis")).toEqual([]);
  });

  it("never returns a placeholder from search", () => {
    const drugs = getScreen("drug-cross-reactivity");
    const agents = getScreen("contrast-media");
    const allergens = getScreen("allergen-cross-reactivity");
    expect(drugs && agents && allergens).toBeTruthy();
    if (!drugs || !agents || !allergens) return;

    for (const screen of [drugs, agents, allergens]) {
      for (const entry of screen.entries) {
        expect(searchableFields(entry)).toBeNull();
        expect(filterCatalogEntries(screen, entry.label, null)).toEqual([]);
      }
    }

    expect(noMatchMessage("drug", "Drug A")).toBe(
      "No drug in the attached sources matches 'Drug A'. This says nothing about that drug.",
    );
    expect(noMatchMessage("agent", "Agent A")).toBe(
      "No agent in the attached sources matches 'Agent A'. This says nothing about that agent.",
    );
    expect(noMatchMessage("allergen", "Allergen X")).toBe(
      "No allergen or component in the attached sources matches 'Allergen X'.",
    );

    const html = renderToStaticMarkup(
      React.createElement(CatalogList, {
        screen: drugs,
        query: "Drug A",
        condition: null,
      }),
    );
    expect(html).toContain("data-catalog-list=\"empty\"");
    expect(html).not.toContain(">Drug A<");
  });

  it("says when no tool matches and still offers the full list", () => {
    const screen = getScreen("scoring-tools");
    expect(screen).toBeDefined();
    if (!screen) return;
    const html = renderToStaticMarkup(
      React.createElement(CatalogList, { screen, query: "zzzz", condition: "Asthma" }),
    );
    expect(html).toContain("No tool matches");
    expect(html).toContain("zzzz");
    expect(html).toContain("Clear search");
    expect(html).toContain("/reference/scoring-tools?condition=Asthma");
  });
});
