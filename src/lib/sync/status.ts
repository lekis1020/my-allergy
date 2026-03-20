export const SUCCESSFUL_SYNC_STATUSES = ["success", "completed"] as const;

export function isSuccessfulSyncStatus(status: string | null | undefined): boolean {
  return SUCCESSFUL_SYNC_STATUSES.includes(
    status as (typeof SUCCESSFUL_SYNC_STATUSES)[number],
  );
}

export function isSyncHealthOk(
  databaseStatus: "ok" | "error",
  lastSyncStatus: "ok" | "stale" | "error",
): boolean {
  return databaseStatus === "ok" && lastSyncStatus === "ok";
}
