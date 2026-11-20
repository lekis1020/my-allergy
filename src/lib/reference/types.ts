export type SourceId = string & { readonly __brand: "SourceId" };
export type IsoDate = string & { readonly __brand: "IsoDate" };

export interface Source {
  id: SourceId;
  citation: string;
  url: string;
}

export type Sourced<T> =
  | { status: "placeholder" }
  | ({
      status: "sourced";
      sourceIds: readonly [SourceId, ...SourceId[]];
      reviewedBy?: string;
      reviewedOn: IsoDate;
    } & T);

export interface ScenarioRow {
  id: string;
  label: string;
  answer: Sourced<{ scenario: string; guidance: string }>;
}

export interface ReferenceSheet {
  kind: "scenarios";
  slug: string;
  title: string;
  question: string;
  relatedQuery: string;
  columns: { scenario: string; guidance: string };
  rows: readonly ScenarioRow[];
}

export type CatalogSubject = "tool" | "drug" | "allergen" | "agent";

export type CatalogGrouping = "condition" | "category" | "class";

/**
 * A calculator stays pending until the full instrument is cited.
 * An abstract that sources the description is not a calculator source.
 */
export type CalculatorState = { status: "placeholder" };

export interface CatalogEntry {
  id: string;
  /** Abbreviation, or a neutral placeholder such as "Drug A". */
  label: string;
  /**
   * Condition, category, or class from a source.
   * Null when no source names a group. A placeholder entry keeps this null.
   */
  groupLabel: string | null;
  identity:
    | { status: "placeholder" }
    | {
        status: "sourced";
        name: string;
        aliases: readonly string[];
        sourceIds: readonly [SourceId, ...SourceId[]];
        reviewedBy?: string;
        reviewedOn: IsoDate;
        guidance: string;
        /** Published "Condition · Name" line for scoring tools. */
        scenario?: string;
      };
  calculator?: CalculatorState;
}

export interface CatalogScreen {
  kind: "catalog";
  slug: string;
  title: string;
  question: string;
  relatedQuery: string;
  subject: CatalogSubject;
  grouping: CatalogGrouping;
  entries: readonly CatalogEntry[];
}

export type ReferenceScreen = ReferenceSheet | CatalogScreen;
