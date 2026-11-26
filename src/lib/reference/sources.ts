import type { Source, SourceId } from "@/lib/reference/types";

export const SOURCES: readonly Source[] = [];

export function getSource(id: SourceId): Source | undefined {
  return SOURCES.find((source) => source.id === id);
}
