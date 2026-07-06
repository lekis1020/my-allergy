import { inngest } from "./client";
import { createServiceClient } from "@/lib/supabase/server";
import {
  computeWeeklyTrending,
  isoWeekStart,
  writeWeeklySnapshot,
} from "@/lib/trending/weekly";

/**
 * Weekly cron: Monday 03:00 UTC → snapshot the ISO week's top allergy papers
 * ranked by (bookmark + like + comment + IF + citation + recency). Idempotent
 * — reruns for the same week upsert the same rows.
 *
 * The route at /api/sync/backfill-weekly-trending exposes the same work as
 * an admin-triggered POST so we don't have to wait for the next Monday to
 * populate the very first snapshot.
 */
export const buildWeeklyTrendingFn = inngest.createFunction(
  { id: "build-weekly-trending", retries: 2 },
  [
    { cron: "0 3 * * 1" },
    { event: "app/weekly-trending.recompute" },
  ],
  async ({ step }) => {
    const weekStartsOn = isoWeekStart(new Date());

    const ranked = await step.run("compute", async () => {
      const service = createServiceClient();
      return computeWeeklyTrending(service, service);
    });

    const written = await step.run("write-snapshot", async () => {
      const service = createServiceClient();
      await writeWeeklySnapshot(service, weekStartsOn, ranked);
      return { rows: ranked.length };
    });

    return { weekStartsOn, ...written };
  }
);
