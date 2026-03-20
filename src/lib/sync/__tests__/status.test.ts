import { describe, expect, it } from "vitest";
import {
  SUCCESSFUL_SYNC_STATUSES,
  isSuccessfulSyncStatus,
  isSyncHealthOk,
} from "../status";

describe("sync status helpers", () => {
  it("treats legacy and current success statuses as successful", () => {
    expect(SUCCESSFUL_SYNC_STATUSES).toEqual(["success", "completed"]);
    expect(isSuccessfulSyncStatus("success")).toBe(true);
    expect(isSuccessfulSyncStatus("completed")).toBe(true);
    expect(isSuccessfulSyncStatus("error")).toBe(false);
  });

  it("marks stale sync state as unhealthy", () => {
    expect(isSyncHealthOk("ok", "ok")).toBe(true);
    expect(isSyncHealthOk("ok", "stale")).toBe(false);
    expect(isSyncHealthOk("error", "ok")).toBe(false);
  });
});
