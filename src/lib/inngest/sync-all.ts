import { inngest } from "./client";
import { JOURNALS } from "@/lib/constants/journals";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Fans out sync to all journals by emitting per-journal events.
 */
export const syncAllFn = inngest.createFunction(
  { id: "sync-all-journals" },
  { event: "sync/all.requested" },
  async ({ event, step }) => {
    const { fullSync = false, days = 365 } = event.data as {
      fullSync?: boolean;
      days?: number;
    };

    const supabase = createServiceClient();

    // Clean up stale sync logs and check for running syncs
    await step.run("check-sync-lock", async () => {
      await supabase
        .from("sync_logs")
        .update({
          status: "error",
          error_message: "Timed out (stale lock)",
          completed_at: new Date().toISOString(),
        })
        .eq("status", "running")
        .lt("started_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());

      const { data: runningSyncs } = await supabase
        .from("sync_logs")
        .select("id")
        .eq("status", "running")
        .limit(1);

      if (runningSyncs && runningSyncs.length > 0) {
        throw new Error("A sync is already in progress");
      }
    });

    // Fan out: send one event per journal
    const events = JOURNALS.map((journal) => ({
      name: "sync/journal.requested" as const,
      data: { journalSlug: journal.slug, fullSync, days },
    }));

    await step.sendEvent("fan-out-journals", events);

    return {
      message: `Dispatched sync for ${JOURNALS.length} journals`,
      journalCount: JOURNALS.length,
      fullSync,
      days,
    };
  }
);
