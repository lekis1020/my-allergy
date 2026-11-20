import { placeholderEntry } from "@/lib/reference/catalog";
import type { CatalogScreen } from "@/lib/reference/types";

export const CONTRAST_MEDIA: CatalogScreen = {
  kind: "catalog",
  slug: "contrast-media",
  title: "Contrast media",
  question:
    "What do the attached sources say about cross-reaction after a reaction to this contrast agent?",
  relatedQuery: "contrast media",
  subject: "agent",
  grouping: "class",
  entries: [
    placeholderEntry("agent-a", "Agent A"),
    placeholderEntry("agent-b", "Agent B"),
    placeholderEntry("agent-c", "Agent C"),
  ],
};
