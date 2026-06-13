/**
 * Barrel for every Inngest function this app serves.
 *
 * Each function lives in its own module (one file per pipeline); the
 * serve handler at src/app/api/inngest/route.ts imports them all from
 * here. Add new functions to their own file and re-export them below.
 */
export { syncJournalFn } from "./sync-journal";
export { syncAllFn } from "./sync-all";
export { backfillJournalFn, backfillAllFn } from "./backfill-papers";
export { onDemandEnrichFn } from "./on-demand-enrich";
export { generateTrendingAnalysisFn } from "./trending-analysis";
export { generateGeographyInsightsFn } from "./geography-insights";
export { recomputeGraphFn } from "./recompute-graph";
export { backfillCitationsFn } from "./backfill-citations";
export { embedPapersFn } from "./embed-papers";
