import { describe, it, expect } from "vitest";
import { encodeCursor, decodeCursor, type FeedCursor } from "../cursor";

describe("feed cursor", () => {
  it("round-trips a keyset cursor", () => {
    const c: FeedCursor = { m: "k", v: "2026-05-01", id: "abc-123" };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });

  it("round-trips a keyset cursor with a null sort value", () => {
    const c: FeedCursor = { m: "k", v: null, id: "abc-123" };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });

  it("round-trips an offset cursor", () => {
    const c: FeedCursor = { m: "o", o: 40 };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });

  it("treats missing input as the first page", () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor("")).toBeNull();
  });

  it("rejects malformed or corrupt cursors", () => {
    expect(decodeCursor("not-base64-$$$")).toBeNull();
    expect(decodeCursor(Buffer.from("{}", "utf8").toString("base64url"))).toBeNull();
    expect(
      decodeCursor(Buffer.from('{"m":"k"}', "utf8").toString("base64url")),
    ).toBeNull();
    expect(
      decodeCursor(Buffer.from('{"m":"o","o":-1}', "utf8").toString("base64url")),
    ).toBeNull();
    expect(
      decodeCursor(Buffer.from('{"m":"o","o":1.5}', "utf8").toString("base64url")),
    ).toBeNull();
  });
});
