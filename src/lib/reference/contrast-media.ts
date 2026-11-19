import type { ReferenceSheet } from "@/lib/reference/types";

export const CONTRAST_MEDIA: ReferenceSheet = {
  kind: "scenarios",
  slug: "contrast-media",
  title: "Contrast media",
  question:
    "Which contrast agent should be used after an adverse reaction to contrast?",
  relatedQuery: "contrast media",
  rows: [
    { id: "scenario-1", label: "Scenario 1", answer: { status: "placeholder" } },
    { id: "scenario-2", label: "Scenario 2", answer: { status: "placeholder" } },
    { id: "scenario-3", label: "Scenario 3", answer: { status: "placeholder" } },
  ],
};
