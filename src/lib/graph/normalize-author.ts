/**
 * Normalize an author for cross-paper matching.
 *
 * Returns a stable key of the form `<last_name lowercased>|<first_initial>`
 * (or `<last_name>|` when no first-name signal exists). Two papers' authors
 * are considered "the same person" when their keys are equal.
 *
 * Using just the first initial is a deliberate trade-off: it merges "Smith J"
 * variants under one key without requiring a disambiguation pass. Common-name
 * collisions are dealt with downstream (see build-snapshots.ts: drop authors
 * whose key maps to > 200 papers).
 */
export function normalizeAuthor(
  lastName: string | null,
  firstName: string | null,
  initials: string | null = null
): string | null {
  const last = (lastName ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (!last) return null;

  const firstSource =
    (firstName ?? "").trim() || (initials ?? "").trim();
  const firstInitial = firstSource
    ? firstSource.replace(/[^a-zA-Z]/g, "").charAt(0).toLowerCase()
    : "";

  return `${last}|${firstInitial}`;
}
