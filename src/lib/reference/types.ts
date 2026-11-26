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
