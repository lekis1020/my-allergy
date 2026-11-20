import { ALLERGEN_CROSS_REACTIVITY } from "@/lib/reference/allergen-cross-reactivity";
import { CONTRAST_MEDIA } from "@/lib/reference/contrast-media";
import { DRUG_CROSS_REACTIVITY } from "@/lib/reference/drug-cross-reactivity";
import { SCORING_TOOLS } from "@/lib/reference/scoring-tools";
import type {
  CatalogScreen,
  IsoDate,
  ReferenceScreen,
  ReferenceSheet,
} from "@/lib/reference/types";

export const REFERENCE_SCREENS: readonly CatalogScreen[] = [
  SCORING_TOOLS,
  DRUG_CROSS_REACTIVITY,
  ALLERGEN_CROSS_REACTIVITY,
  CONTRAST_MEDIA,
];

export function getScreen(slug: string): CatalogScreen | undefined {
  return REFERENCE_SCREENS.find((screen) => screen.slug === slug);
}

export function getEntry(slug: string, id: string) {
  const screen = getScreen(slug);
  const entry = screen?.entries.find((item) => item.id === id);
  if (!screen || !entry) return undefined;
  return { screen, entry };
}

export type ReviewState =
  | { kind: "pending" }
  | { kind: "cited"; checkedOn: IsoDate }
  | { kind: "reviewed"; reviewedOn: IsoDate };

function sourcedReviews(
  screen: ReferenceScreen,
): readonly { reviewedBy?: string; reviewedOn: IsoDate }[] {
  if (screen.kind === "scenarios") {
    return screen.rows.flatMap((row) =>
      row.answer.status === "sourced" ? [row.answer] : [],
    );
  }
  return screen.entries.flatMap((entry) =>
    entry.identity.status === "sourced" ? [entry.identity] : [],
  );
}

export function reviewState(screen: ReferenceScreen): ReviewState {
  let checkedOn: IsoDate | null = null;
  let reviewedOn: IsoDate | null = null;
  for (const answer of sourcedReviews(screen)) {
    if (checkedOn === null || answer.reviewedOn > checkedOn) {
      checkedOn = answer.reviewedOn;
    }
    if (
      answer.reviewedBy !== undefined &&
      (reviewedOn === null || answer.reviewedOn > reviewedOn)
    ) {
      reviewedOn = answer.reviewedOn;
    }
  }
  if (reviewedOn !== null) return { kind: "reviewed", reviewedOn };
  if (checkedOn !== null) return { kind: "cited", checkedOn };
  return { kind: "pending" };
}

export function isPublished(screen: ReferenceScreen): boolean {
  return reviewState(screen).kind === "reviewed";
}

export type { ReferenceSheet };
