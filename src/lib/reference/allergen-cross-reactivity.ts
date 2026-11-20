import { placeholderEntry } from "@/lib/reference/catalog";
import type { CatalogScreen } from "@/lib/reference/types";

export const ALLERGEN_CROSS_REACTIVITY: CatalogScreen = {
  kind: "catalog",
  slug: "allergen-cross-reactivity",
  title: "Allergen cross-reactivity",
  question:
    "Which components and cross-reactive allergens do the attached sources list for this allergen?",
  relatedQuery: "allergy diagnostics",
  subject: "allergen",
  grouping: "category",
  entries: [
    placeholderEntry("allergen-x", "Allergen X"),
    placeholderEntry("allergen-y", "Allergen Y"),
  ],
};
