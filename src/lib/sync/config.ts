const SYNC_ENV_PLACEHOLDERS = {
  CRON_SECRET: "your_random_secret",
  INNGEST_EVENT_KEY: "your_inngest_event_key",
  INNGEST_SIGNING_KEY: "your_inngest_signing_key",
} as const;

export const REQUIRED_SYNC_ENV_VARS = Object.keys(
  SYNC_ENV_PLACEHOLDERS
) as Array<keyof typeof SYNC_ENV_PLACEHOLDERS>;

export function getMissingSyncEnvVars(
  env: Record<string, string | undefined>,
  requiredVars: readonly string[] = REQUIRED_SYNC_ENV_VARS,
): string[] {
  return requiredVars.filter((key) => {
    const value = env[key];

    if (typeof value !== "string") {
      return true;
    }

    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return true;
    }

    const placeholder = SYNC_ENV_PLACEHOLDERS[key as keyof typeof SYNC_ENV_PLACEHOLDERS];
    return typeof placeholder === "string" && trimmedValue === placeholder;
  });
}

export function parseSyncDays(
  rawValue: string | number | undefined,
  options: { fallback?: number; max?: number } = {},
): number {
  const { fallback = 180, max = 180 } = options;
  const parsed = typeof rawValue === "number" ? rawValue : Number(rawValue ?? fallback);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), max);
}
