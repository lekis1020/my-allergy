// Opaque pagination cursor for the papers feed.
//
// The timeline feed uses keyset pagination: each cursor carries the sort-column
// value and id of the last returned row, so the next page is a fast indexed
// range scan with no OFFSET and no COUNT. The personalized feed re-ranks an
// in-memory pool, so it cannot keyset — its cursor is a plain offset into that
// pool. Both shapes are base64url-encoded JSON; the client treats them as
// opaque strings and only passes them back.

export type FeedCursor =
  | { m: "k"; v: string | null; id: string } // keyset: sort value + id tiebreaker
  | { m: "o"; o: number }; // offset into the personalized pool

export function encodeCursor(cursor: FeedCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

// Returns null for missing or malformed input — callers treat that as "first
// page", so a stale or corrupt cursor degrades gracefully instead of erroring.
export function decodeCursor(raw: string | null | undefined): FeedCursor | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    );
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    if (
      obj.m === "k" &&
      typeof obj.id === "string" &&
      (obj.v === null || typeof obj.v === "string")
    ) {
      return { m: "k", v: obj.v as string | null, id: obj.id };
    }
    if (
      obj.m === "o" &&
      typeof obj.o === "number" &&
      Number.isInteger(obj.o) &&
      obj.o >= 0
    ) {
      return { m: "o", o: obj.o };
    }
    return null;
  } catch {
    return null;
  }
}
