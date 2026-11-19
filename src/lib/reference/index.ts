import { CONTRAST_MEDIA } from "@/lib/reference/contrast-media";
import type { IsoDate, ReferenceSheet } from "@/lib/reference/types";

export const REFERENCE_SHEETS: readonly ReferenceSheet[] = [CONTRAST_MEDIA];

export function getSheet(slug: string): ReferenceSheet | undefined {
  return REFERENCE_SHEETS.find((sheet) => sheet.slug === slug);
}

export type ReviewState =
  | { kind: "pending" }
  | { kind: "cited"; checkedOn: IsoDate }
  | { kind: "reviewed"; reviewedOn: IsoDate };

export function reviewState(sheet: ReferenceSheet): ReviewState {
  let checkedOn: IsoDate | null = null;
  let reviewedOn: IsoDate | null = null;
  for (const { answer } of sheet.rows) {
    if (answer.status !== "sourced") continue;
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

export function isPublished(sheet: ReferenceSheet): boolean {
  return reviewState(sheet).kind === "reviewed";
}
