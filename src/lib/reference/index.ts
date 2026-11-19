import { CONTRAST_MEDIA } from "@/lib/reference/contrast-media";
import type { IsoDate, ReferenceSheet } from "@/lib/reference/types";

export const REFERENCE_SHEETS: readonly ReferenceSheet[] = [CONTRAST_MEDIA];

export function getSheet(slug: string): ReferenceSheet | undefined {
  return REFERENCE_SHEETS.find((sheet) => sheet.slug === slug);
}

export function lastReviewedOn(sheet: ReferenceSheet): IsoDate | null {
  let latest: IsoDate | null = null;
  for (const row of sheet.rows) {
    if (row.answer.status !== "sourced") continue;
    if (latest === null || row.answer.reviewedOn > latest) {
      latest = row.answer.reviewedOn;
    }
  }
  return latest;
}

export function isPublished(sheet: ReferenceSheet): boolean {
  return lastReviewedOn(sheet) !== null;
}
