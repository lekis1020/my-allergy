import { beforeEach, describe, expect, it } from "vitest";
import { generateAnonId } from "../anon-id";
import { formatAnonId } from "../anon-id-client";

describe("generateAnonId", () => {
  beforeEach(() => {
    process.env.COMMUNITY_SALT = "test-salt-abc";
  });

  it("returns a 6-character hex string", () => {
    const id = generateAnonId("12345", "00000000-0000-0000-0000-000000000001");
    expect(id).toMatch(/^[0-9a-f]{6}$/);
  });

  it("is stable for the same (pmid, user, salt)", () => {
    const a = generateAnonId("12345", "u1");
    const b = generateAnonId("12345", "u1");
    expect(a).toBe(b);
  });

  it("differs for the same user across papers", () => {
    const a = generateAnonId("111", "u1");
    const b = generateAnonId("222", "u1");
    expect(a).not.toBe(b);
  });

  it("differs for different users on the same paper", () => {
    const a = generateAnonId("111", "u1");
    const b = generateAnonId("111", "u2");
    expect(a).not.toBe(b);
  });

  it("changes when the salt changes", () => {
    const a = generateAnonId("111", "u1");
    process.env.COMMUNITY_SALT = "different-salt";
    const b = generateAnonId("111", "u1");
    expect(a).not.toBe(b);
  });

  it("throws when salt is missing", () => {
    delete process.env.COMMUNITY_SALT;
    expect(() => generateAnonId("111", "u1")).toThrow(/COMMUNITY_SALT/);
  });
});

describe("formatAnonId", () => {
  it("prefixes with 익명 #", () => {
    expect(formatAnonId("abc123")).toBe("익명 #abc123");
  });
});
