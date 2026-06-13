import { inngest } from "./client";
import { enrichPapersWithCrossRef } from "@/lib/sync/enricher";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Background CrossRef enrichment triggered after on-demand PubMed fetch.
 */
export const onDemandEnrichFn = inngest.createFunction(
  { id: "on-demand-enrich", retries: 2 },
  { event: "pubmed/on-demand.enrich.requested" },
  async ({ step }) => {
    const enrichResult = await step.run("on-demand-crossref", async () => {
      const supabase = createServiceClient();
      return enrichPapersWithCrossRef(supabase, 50);
    });
    return enrichResult;
  },
);
