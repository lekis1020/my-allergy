import { placeholderEntry } from "@/lib/reference/catalog";
import type { CatalogScreen } from "@/lib/reference/types";

export const DRUG_CROSS_REACTIVITY: CatalogScreen = {
  kind: "catalog",
  slug: "drug-cross-reactivity",
  title: "Drug cross-reactivity",
  question:
    "What do the attached sources say about cross-reaction after a reaction to this drug?",
  relatedQuery: "drug allergy",
  subject: "drug",
  grouping: "class",
  entries: [
    placeholderEntry("drug-a", "Drug A"),
    placeholderEntry("drug-b", "Drug B"),
    placeholderEntry("drug-c", "Drug C"),
  ],
};
