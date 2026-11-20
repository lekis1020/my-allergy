import { describe, it, expect } from "vitest";
import { publishedNameLine } from "@/lib/reference/catalog";
import {
  REFERENCE_SCREENS,
  getScreen,
  isPublished,
  reviewState,
} from "@/lib/reference";
import { SOURCES, getSource } from "@/lib/reference/sources";
import type {
  CatalogScreen,
  IsoDate,
  ReferenceScreen,
  ReferenceSheet,
  ScenarioRow,
  Source,
  SourceId,
} from "@/lib/reference/types";

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function checkReviewedOn(
  where: string,
  reviewedOn: string,
  today: string,
  problems: string[],
) {
  if (!isCalendarDate(reviewedOn)) {
    problems.push(
      `${where}: reviewedOn "${reviewedOn}" is not a real YYYY-MM-DD date`,
    );
  } else if (reviewedOn > today) {
    problems.push(`${where}: reviewedOn ${reviewedOn} is after ${today}`);
  }
}

function checkSheet(
  sheet: ReferenceSheet,
  sourceIds: ReadonlySet<string>,
  today: string,
  problems: string[],
) {
  const rowIds = new Set<string>();
  for (const row of sheet.rows) {
    const where = `sheet ${sheet.slug} row ${row.id}`;
    if (rowIds.has(row.id)) {
      problems.push(`${where}: duplicate row id`);
    }
    rowIds.add(row.id);

    const { answer } = row;
    if (answer.status === "placeholder") continue;

    for (const id of answer.sourceIds) {
      if (!sourceIds.has(id)) {
        problems.push(`${where}: source id ${id} is not in SOURCES`);
      }
    }
    if (answer.reviewedBy !== undefined && answer.reviewedBy.trim() === "") {
      problems.push(`${where}: reviewedBy is empty`);
    }
    checkReviewedOn(where, answer.reviewedOn, today, problems);
    if (answer.scenario.trim() === "") {
      problems.push(`${where}: scenario is empty`);
    }
    if (answer.guidance.trim() === "") {
      problems.push(`${where}: guidance is empty`);
    }
  }
}

function checkCatalog(
  screen: CatalogScreen,
  sourceIds: ReadonlySet<string>,
  today: string,
  problems: string[],
) {
  const entryIds = new Set<string>();
  for (const entry of screen.entries) {
    const where = `screen ${screen.slug} entry ${entry.id}`;
    if (entryIds.has(entry.id)) {
      problems.push(`${where}: duplicate entry id`);
    }
    entryIds.add(entry.id);

    if (entry.identity.status === "placeholder") {
      if (entry.groupLabel !== null) {
        problems.push(`${where}: placeholder entry has a group label`);
      }
      continue;
    }

    for (const id of entry.identity.sourceIds) {
      if (!sourceIds.has(id)) {
        problems.push(`${where}: source id ${id} is not in SOURCES`);
      }
    }
    if (
      entry.identity.reviewedBy !== undefined &&
      entry.identity.reviewedBy.trim() === ""
    ) {
      problems.push(`${where}: reviewedBy is empty`);
    }
    checkReviewedOn(where, entry.identity.reviewedOn, today, problems);
    if (entry.identity.name.trim() === "") {
      problems.push(`${where}: name is empty`);
    }
    if (entry.identity.guidance.trim() === "") {
      problems.push(`${where}: guidance is empty`);
    }
    for (const alias of entry.identity.aliases) {
      if (alias.trim() === "") {
        problems.push(`${where}: alias is empty`);
      }
    }
    if (screen.grouping === "condition") {
      if (entry.groupLabel === null || entry.groupLabel.trim() === "") {
        problems.push(`${where}: condition is empty`);
      } else if (
        entry.identity.scenario !==
        publishedNameLine(entry.groupLabel, entry.identity.name)
      ) {
        problems.push(
          `${where}: condition and name do not match the published scenario line`,
        );
      }
    }
  }
}

function findSourcingProblems(
  screens: readonly ReferenceScreen[],
  sources: readonly Source[],
  today: string,
): string[] {
  const problems: string[] = [];

  const sourceIds = new Set<string>();
  for (const source of sources) {
    if (sourceIds.has(source.id)) {
      problems.push(`source ${source.id}: duplicate source id`);
    }
    sourceIds.add(source.id);
    if (!isHttpsUrl(source.url)) {
      problems.push(`source ${source.id}: url "${source.url}" is not an https URL`);
    }
  }

  const slugs = new Set<string>();
  for (const screen of screens) {
    if (slugs.has(screen.slug)) {
      problems.push(`screen ${screen.slug}: duplicate slug`);
    }
    slugs.add(screen.slug);
    if (screen.kind === "scenarios") {
      checkSheet(screen, sourceIds, today, problems);
    } else {
      checkCatalog(screen, sourceIds, today, problems);
    }
  }

  return problems;
}

type SourcedAnswer = Extract<ScenarioRow["answer"], { status: "sourced" }>;

const TODAY = "2026-11-19";

const FIXTURE_SOURCE: Source = {
  id: "fixture-source" as SourceId,
  citation: "Fixture citation",
  url: "https://example.org/fixture",
};

function placeholderRow(id: string): ScenarioRow {
  return { id, label: id, answer: { status: "placeholder" } };
}

function citedRow(id: string, overrides: Partial<SourcedAnswer> = {}): ScenarioRow {
  return {
    id,
    label: id,
    answer: {
      status: "sourced",
      sourceIds: [FIXTURE_SOURCE.id],
      reviewedOn: "2026-11-01" as IsoDate,
      scenario: "Fixture scenario",
      guidance: "Fixture guidance",
      ...overrides,
    },
  };
}

function sourcedRow(id: string, overrides: Partial<SourcedAnswer> = {}): ScenarioRow {
  return citedRow(id, { reviewedBy: "Fixture reviewer", ...overrides });
}

function sheet(slug: string, rows: readonly ScenarioRow[]): ReferenceSheet {
  return {
    kind: "scenarios",
    slug,
    title: slug,
    question: slug,
    relatedQuery: slug,
    columns: { scenario: "Scenario", guidance: "Guidance" },
    rows,
  };
}

function expectOneProblemNaming(problems: string[], ...names: string[]) {
  expect(problems).toHaveLength(1);
  for (const name of names) {
    expect(problems[0]).toContain(name);
  }
}

describe("reference sheet sourcing", () => {
  it("passes for the screens and sources the site ships", () => {
    const todayUtc = new Date().toISOString().slice(0, 10);
    expect(findSourcingProblems(REFERENCE_SCREENS, SOURCES, todayUtc)).toEqual([]);
  });

  it("links every scoring-tools source to PubMed or a DOI with a publication year", () => {
    const scoringTools = getScreen("scoring-tools");
    const citedIds = new Set(
      scoringTools?.entries.flatMap((entry) =>
        entry.identity.status === "sourced" ? entry.identity.sourceIds : [],
      ),
    );
    expect(citedIds.size).toBeGreaterThan(0);

    const unlinked = [...citedIds].filter((id) => {
      const source = getSource(id);
      return (
        !source ||
        !/^https:\/\/(pubmed\.ncbi\.nlm\.nih\.gov|doi\.org)\//.test(source.url) ||
        !/\b(19|20)\d{2}\b/.test(source.citation)
      );
    });
    expect(unlinked).toEqual([]);
  });

  it("accepts a fully sourced sheet", () => {
    const sheets = [
      sheet("valid", [sourcedRow("row-1"), placeholderRow("row-2")]),
    ];
    expect(findSourcingProblems(sheets, [FIXTURE_SOURCE], TODAY)).toEqual([]);
  });

  it("reports a slug used by two sheets", () => {
    const sheets = [
      sheet("shared-slug", [placeholderRow("row-1")]),
      sheet("shared-slug", [placeholderRow("row-1")]),
    ];
    expectOneProblemNaming(
      findSourcingProblems(sheets, [FIXTURE_SOURCE], TODAY),
      "shared-slug",
      "duplicate slug",
    );
  });

  it("reports a row id used twice within a sheet", () => {
    const sheets = [
      sheet("dup-rows", [placeholderRow("row-1"), placeholderRow("row-1")]),
    ];
    expectOneProblemNaming(
      findSourcingProblems(sheets, [FIXTURE_SOURCE], TODAY),
      "dup-rows",
      "row-1",
    );
  });

  it("reports a source id registered twice", () => {
    expectOneProblemNaming(
      findSourcingProblems([], [FIXTURE_SOURCE, { ...FIXTURE_SOURCE }], TODAY),
      FIXTURE_SOURCE.id,
    );
  });

  it.each(["http://example.org/fixture", "not a url"])(
    "reports a source url that is not https: %s",
    (url) => {
      expectOneProblemNaming(
        findSourcingProblems([], [{ ...FIXTURE_SOURCE, url }], TODAY),
        FIXTURE_SOURCE.id,
      );
    },
  );

  it("reports a sourced row that cites an unregistered source", () => {
    const sheets = [
      sheet("unknown-source", [
        sourcedRow("row-1", { sourceIds: ["missing-source" as SourceId] }),
      ]),
    ];
    expectOneProblemNaming(
      findSourcingProblems(sheets, [FIXTURE_SOURCE], TODAY),
      "unknown-source",
      "row-1",
      "missing-source",
    );
  });

  it("reports a sourced row with a blank reviewer", () => {
    const sheets = [
      sheet("no-reviewer", [sourcedRow("row-1", { reviewedBy: "   " })]),
    ];
    expectOneProblemNaming(
      findSourcingProblems(sheets, [FIXTURE_SOURCE], TODAY),
      "no-reviewer",
      "row-1",
    );
  });

  it("accepts a sourced row with a checked citation and no reviewer", () => {
    const sheets = [sheet("cited-only", [citedRow("row-1")])];
    expect(findSourcingProblems(sheets, [FIXTURE_SOURCE], TODAY)).toEqual([]);
  });

  it.each(["2026/11/01", "2026-02-30", "2026-13-01", "2026-11-20"])(
    "reports a sourced row reviewed on %s",
    (reviewedOn) => {
      const sheets = [
        sheet("bad-date", [
          sourcedRow("row-1", { reviewedOn: reviewedOn as IsoDate }),
        ]),
      ];
      expectOneProblemNaming(
        findSourcingProblems(sheets, [FIXTURE_SOURCE], TODAY),
        "bad-date",
        "row-1",
      );
    },
  );

  it.each([{ scenario: " " }, { guidance: "" }])(
    "reports a sourced row with blank clinical text: %o",
    (blank) => {
      const sheets = [sheet("blank-text", [sourcedRow("row-1", blank)])];
      expectOneProblemNaming(
        findSourcingProblems(sheets, [FIXTURE_SOURCE], TODAY),
        "blank-text",
        "row-1",
      );
    },
  );
});

describe("sheet review state", () => {
  it("leaves a placeholder-only sheet pending and unpublished", () => {
    const draft = sheet("draft", [placeholderRow("row-1"), placeholderRow("row-2")]);
    expect(reviewState(draft)).toEqual({ kind: "pending" });
    expect(isPublished(draft)).toBe(false);
  });

  it("marks a sheet with only checked citations as cited on the latest date, unpublished", () => {
    const cited = sheet("cited", [
      citedRow("row-1", { reviewedOn: "2026-10-15" as IsoDate }),
      citedRow("row-2", { reviewedOn: "2026-03-01" as IsoDate }),
      placeholderRow("row-3"),
    ]);
    expect(reviewState(cited)).toEqual({ kind: "cited", checkedOn: "2026-10-15" });
    expect(isPublished(cited)).toBe(false);
  });

  it("publishes a sheet with a reviewed row, dated by reviewed rows only", () => {
    const reviewed = sheet("reviewed", [
      sourcedRow("row-1", { reviewedOn: "2026-03-01" as IsoDate }),
      citedRow("row-2", { reviewedOn: "2026-10-15" as IsoDate }),
    ]);
    expect(reviewState(reviewed)).toEqual({
      kind: "reviewed",
      reviewedOn: "2026-03-01",
    });
    expect(isPublished(reviewed)).toBe(true);
  });
});
