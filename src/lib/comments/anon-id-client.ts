// Client-safe helpers for the community feature.
// The salt and the actual hash computation live in anon-id.ts (server only);
// only presentational helpers belong here.

export function formatAnonId(anonId: string): string {
  return `익명 #${anonId}`;
}
