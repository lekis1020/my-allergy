import { describe, expect, it } from "vitest";
import { getMissingSyncEnvVars, parseSyncDays } from "../config";

describe("sync config helpers", () => {
  it("reports missing or placeholder sync env vars", () => {
    expect(
      getMissingSyncEnvVars({
        CRON_SECRET: "your_random_secret",
        INNGEST_EVENT_KEY: "real-event-key",
        INNGEST_SIGNING_KEY: "",
      }),
    ).toEqual(["CRON_SECRET", "INNGEST_SIGNING_KEY"]);
  });

  it("accepts configured sync env vars", () => {
    expect(
      getMissingSyncEnvVars({
        CRON_SECRET: "real-secret",
        INNGEST_EVENT_KEY: "evt_123",
        INNGEST_SIGNING_KEY: "sign_123",
      }),
    ).toEqual([]);
  });

  it("parses sync days with bounds and fallback", () => {
    expect(parseSyncDays("90")).toBe(90);
    expect(parseSyncDays("999")).toBe(365);
    expect(parseSyncDays(365, { max: 365 })).toBe(365);
    expect(parseSyncDays("0", { fallback: 30, max: 365 })).toBe(30);
  });
});
