import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { syncJournalFn, syncAllFn, sendNotificationsFn } from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncJournalFn, syncAllFn, sendNotificationsFn],
});
