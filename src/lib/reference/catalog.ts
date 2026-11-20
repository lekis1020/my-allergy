import type {
  CatalogEntry,
  CatalogScreen,
  CatalogSubject,
  IsoDate,
} from "@/lib/reference/types";

const NAME_SEPARATOR = " · ";

export function placeholderEntry(id: string, label: string): CatalogEntry {
  return {
    id,
    label,
    groupLabel: null,
    identity: { status: "placeholder" },
  };
}

export function splitPublishedName(scenario: string): {
  condition: string;
  name: string;
} {
  const splitAt = scenario.indexOf(NAME_SEPARATOR);
  if (splitAt === -1) return { condition: "", name: scenario };
  return {
    condition: scenario.slice(0, splitAt),
    name: scenario.slice(splitAt + NAME_SEPARATOR.length),
  };
}

export function publishedNameLine(condition: string, name: string): string {
  return `${condition}${NAME_SEPARATOR}${name}`;
}

const PLURAL: Record<CatalogSubject, string> = {
  tool: "tools",
  drug: "drugs",
  allergen: "allergens",
  agent: "agents",
};

export function entryCountLabel(screen: Pick<CatalogScreen, "subject" | "entries">): string {
  const count = screen.entries.length;
  const noun = count === 1 ? screen.subject : PLURAL[screen.subject];
  return `${count} ${noun}`;
}

export function searchableFields(entry: CatalogEntry): readonly string[] | null {
  if (entry.identity.status !== "sourced") return null;
  return [entry.label, entry.identity.name, ...entry.identity.aliases];
}

export function matchesQuery(entry: CatalogEntry, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const fields = searchableFields(entry);
  if (!fields) return false;
  return fields.some((field) => field.toLowerCase().includes(needle));
}

export function conditionChips(screen: CatalogScreen): string[] {
  if (screen.grouping !== "condition") return [];
  const labels = new Set<string>();
  for (const entry of screen.entries) {
    if (entry.identity.status === "sourced" && entry.groupLabel) {
      labels.add(entry.groupLabel);
    }
  }
  return [...labels].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

export function activeCondition(screen: CatalogScreen, condition: string): string | null {
  const trimmed = condition.trim();
  if (!trimmed) return null;
  return conditionChips(screen).includes(trimmed) ? trimmed : null;
}

export function filterCatalogEntries(
  screen: CatalogScreen,
  query: string,
  condition: string | null,
): CatalogEntry[] {
  return screen.entries.filter((entry) => {
    if (condition && entry.groupLabel !== condition) return false;
    return matchesQuery(entry, query);
  });
}

export interface CatalogGroup {
  id: string;
  heading: string | null;
  headingPending: boolean;
  entries: readonly CatalogEntry[];
}

function byLabel(a: CatalogEntry, b: CatalogEntry): number {
  return a.label.localeCompare(b.label, "en", { sensitivity: "base" });
}

export function groupCatalog(
  screen: Pick<CatalogScreen, "grouping">,
  entries: readonly CatalogEntry[],
): CatalogGroup[] {
  const hasSourcedGroup = entries.some(
    (entry) => entry.identity.status === "sourced" && entry.groupLabel !== null,
  );
  if (screen.grouping === "class" && !hasSourcedGroup) {
    return [
      {
        id: "all",
        heading: null,
        headingPending: false,
        entries: [...entries].sort(byLabel),
      },
    ];
  }

  const order: string[] = [];
  const buckets = new Map<string, CatalogEntry[]>();
  const pending: CatalogEntry[] = [];
  for (const entry of entries) {
    if (entry.identity.status !== "sourced" || entry.groupLabel === null) {
      pending.push(entry);
      continue;
    }
    const bucket = buckets.get(entry.groupLabel);
    if (bucket) {
      bucket.push(entry);
    } else {
      buckets.set(entry.groupLabel, [entry]);
      order.push(entry.groupLabel);
    }
  }

  const groups: CatalogGroup[] = [...order]
    .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))
    .map((heading) => ({
      id: heading,
      heading,
      headingPending: false,
      entries: buckets.get(heading) ?? [],
    }));

  if (pending.length > 0) {
    groups.push({
      id: "pending",
      heading: null,
      headingPending: true,
      entries: [...pending].sort(byLabel),
    });
  }

  return groups;
}

export function noMatchMessage(subject: CatalogSubject, query: string): string {
  const quoted = `'${query.trim()}'`;
  switch (subject) {
    case "tool":
      return `No tool matches ${quoted}`;
    case "drug":
      return `No drug in the attached sources matches ${quoted}. This says nothing about that drug.`;
    case "allergen":
      return `No allergen or component in the attached sources matches ${quoted}.`;
    case "agent":
      return `No agent in the attached sources matches ${quoted}. This says nothing about that agent.`;
  }
}

export function catalogHref(
  slug: string,
  query: string,
  condition: string | null,
  entryId?: string,
): string {
  const params = new URLSearchParams();
  const trimmed = query.trim();
  if (trimmed) params.set("q", trimmed);
  if (condition) params.set("condition", condition);
  const path = entryId ? `/reference/${slug}/${entryId}` : `/reference/${slug}`;
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export type EntryReviewLine =
  | { kind: "pending" }
  | { kind: "cited"; line: string }
  | { kind: "reviewed"; line: string };

export function entryReviewLine(entry: CatalogEntry): EntryReviewLine {
  if (entry.identity.status !== "sourced") return { kind: "pending" };
  if (entry.identity.reviewedBy !== undefined) {
    return {
      kind: "reviewed",
      line: `Reviewed by ${entry.identity.reviewedBy} on ${entry.identity.reviewedOn}`,
    };
  }
  return {
    kind: "cited",
    line: `Citation checked on ${entry.identity.reviewedOn}`,
  };
}

export function entryStatusLabel(entry: CatalogEntry): string {
  if (entry.identity.status !== "sourced") return "Source pending";
  if (entry.identity.reviewedBy !== undefined) {
    return `Last reviewed ${entry.identity.reviewedOn}`;
  }
  return `Citations checked ${entry.identity.reviewedOn} · not yet clinically reviewed`;
}

export function reviewStatusLabel(state: {
  kind: "pending" | "cited" | "reviewed";
  checkedOn?: IsoDate;
  reviewedOn?: IsoDate;
}): string {
  switch (state.kind) {
    case "pending":
      return "Source pending";
    case "cited":
      return `Citations checked ${state.checkedOn} · not yet clinically reviewed`;
    case "reviewed":
      return `Last reviewed ${state.reviewedOn}`;
  }
}

export function searchLabel(subject: CatalogSubject): string {
  switch (subject) {
    case "tool":
      return "Search scoring tools";
    case "drug":
      return "Search drugs";
    case "allergen":
      return "Search allergens and components";
    case "agent":
      return "Search contrast agents";
  }
}
