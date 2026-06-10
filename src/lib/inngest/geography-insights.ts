import { inngest } from "./client";
import { createServiceClient } from "@/lib/supabase/server";
import { computeAuthorGeography } from "@/lib/insights/author-geography";
import type { Json } from "@/types/supabase";

/**
 * Daily cron job that precomputes the First Author Geography insight.
 * Runs at 07:00 UTC — an hour after the paper sync — so the snapshot reflects
 * the freshly synced papers. The /api/insights/author-geography route then
 * just reads the stored row instead of aggregating per request.
 */
const GEOGRAPHY_INSIGHT_DAYS = 180;

export const generateGeographyInsightsFn = inngest.createFunction(
  { id: "generate-geography-insights", retries: 2 },
  { cron: "0 7 * * *" },
  async ({ step }) => {
    const result = await step.run("compute-geography", async () => {
      const supabase = createServiceClient();
      return computeAuthorGeography(supabase, GEOGRAPHY_INSIGHT_DAYS);
    });

    await step.run("save-geography", async () => {
      const supabase = createServiceClient();
      await supabase
        .from("geography_insights")
        .upsert(
          {
            days: result.days,
            from_date: result.fromDate,
            total_first_authors: result.totalFirstAuthors,
            locations: result.locations as unknown as Json,
            computed_at: new Date().toISOString(),
          },
          { onConflict: "days" },
        );
    });

    return { days: result.days, totalFirstAuthors: result.totalFirstAuthors };
  },
);
