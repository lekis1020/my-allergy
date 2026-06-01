import { describe, it, expect } from "vitest";
import { normalizeAuthor } from "@/lib/graph/normalize-author";

describe("normalizeAuthor", () => {
  it("returns null for empty inputs", () => {
    expect(normalizeAuthor(null, null)).toBeNull();
    expect(normalizeAuthor("", "")).toBeNull();
  });

  it("uses last_name + first_initial when both present", () => {
    expect(normalizeAuthor("Smith", "John")).toBe("smith|j");
    expect(normalizeAuthor("Bousquet", "Jean")).toBe("bousquet|j");
  });

  it("uses last_name + initials when first_name missing", () => {
    expect(normalizeAuthor("Lee", null, "JK")).toBe("lee|j");
    expect(normalizeAuthor("Kim", "", "S")).toBe("kim|s");
  });

  it("falls back to last_name only when no first name or initials", () => {
    expect(normalizeAuthor("Singh", null, null)).toBe("singh|");
  });

  it("lowercases and trims punctuation", () => {
    expect(normalizeAuthor("  O'Connor ", "  Mary-Anne ")).toBe("o'connor|m");
    expect(normalizeAuthor("Smith.", "J.")).toBe("smith|j");
  });
});
