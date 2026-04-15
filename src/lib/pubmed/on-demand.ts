import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { JOURNALS } from "@/lib/constants/journals";
import { esearch, efetchAndParse } from "./client";
import { storePapers } from "@/lib/sync/store";
import { createServiceClient } from "@/lib/supabase/server";
import { inngest } from "@/lib/inngest/client";

const DEFAULT_TTL_SECONDS = 30 * 60; // 30 min
const MAX_NEW_PMIDS = 200; // upper bound for a single on-demand fetch

export interface OnDemandInput {
  query: string;
  journals?: string[]; // journal slugs
  dateFrom?: string; // ISO YYYY-MM-DD
  dateTo?: string; // ISO YYYY-MM-DD
}

export interface OnDemandResult {
  pmids: string[];
  cached: boolean;
  fetched: number;
  inserted: number;
  source: "cache" | "pubmed";
}

function toPubmedDate(iso?: string): string | undefined {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  return iso.replace(/-/g, "/");
}

export function computeQueryHash(input: OnDemandInput): string {
  const normalized = {
    q: (input.query ?? "").trim().toLowerCase(),
    j: [...(input.journals ?? [])].sort(),
    f: input.dateFrom ?? "",
    t: input.dateTo ?? "",
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function buildPubmedQuery(input: OnDemandInput): string {
  const parts: string[] = [];
  if (input.query) parts.push(`(${input.query})`);

  const slugs = input.journals ?? [];
  if (slugs.length > 0) {
    const journalFilters = JOURNALS.filter((j) => slugs.includes(j.slug)).map(
      (j) => `(${j.pubmedQuery})`,
    );
    if (journalFilters.length > 0) {
      parts.push(`(${journalFilters.join(" OR ")})`);
    }
  }

  return parts.length > 0 ? parts.join(" AND ") : (input.query || "");
}

interface CacheRow {
  query_hash: string;
  pmids: string[];
  fetched_at: string;
  ttl_seconds: number;
}

async function readCache(
  supabase: SupabaseClient,
  hash: string,
): Promise<string[] | null> {
  const { data, error } = await supabase
    .from("pubmed_query_cache")
    .select("query_hash, pmids, fetched_at, ttl_seconds")
    .eq("query_hash", hash)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as CacheRow;
  const fetchedAt = new Date(row.fetched_at).getTime();
  const expiresAt = fetchedAt + row.ttl_seconds * 1000;
  if (Date.now() > expiresAt) return null;

  return Array.isArray(row.pmids) ? row.pmids : [];
}

async function writeCache(
  supabase: SupabaseClient,
  hash: string,
  pmids: string[],
): Promise<void> {
  const { error } = await supabase.from("pubmed_query_cache").upsert(
    {
      query_hash: hash,
      pmids,
      fetched_at: new Date().toISOString(),
      ttl_seconds: DEFAULT_TTL_SECONDS,
    },
    { onConflict: "query_hash" },
  );
  if (error) {
    console.warn("[OnDemand] Cache write failed:", error.message);
  }
}

async function resolveJournalIdForArticle(
  supabase: SupabaseClient,
  journalAbbreviation: string,
  journalTitle: string,
): Promise<string | null> {
  // Match against known JOURNALS by abbreviation/name first
  const known = JOURNALS.find(
    (j) =>
      j.abbreviation.toLowerCase() === journalAbbreviation.toLowerCase() ||
      j.name.toLowerCase() === journalTitle.toLowerCase(),
  );
  if (!known) return null;

  const { data } = await supabase
    .from("journals")
    .select("id")
    .eq("slug", known.slug)
    .maybeSingle();
  return (data?.id as string) ?? null;
}

/**
 * On-demand PubMed fetch with query cache + async CrossRef enrichment.
 *
 * 1. Cache hit (TTL 30m) → return cached PMIDs.
 * 2. ESearch → diff against existing papers → EFetch+parse new ones.
 * 3. Upsert new papers (service client).
 * 4. Enqueue CrossRef enrichment via Inngest.
 * 5. Refresh cache with full PMID list.
 */
export async function fetchOnDemand(
  input: OnDemandInput,
  options: { signal?: AbortSignal } = {},
): Promise<OnDemandResult> {
  const hash = computeQueryHash(input);
  const supabase = createServiceClient();

  // 1. Cache lookup
  const cached = await readCache(supabase, hash);
  if (cached) {
    return {
      pmids: cached,
      cached: true,
      fetched: 0,
      inserted: 0,
      source: "cache",
    };
  }

  if (options.signal?.aborted) {
    throw new Error("on-demand aborted");
  }

  // 2. ESearch
  const query = buildPubmedQuery(input);
  if (!query) {
    return { pmids: [], cached: false, fetched: 0, inserted: 0, source: "pubmed" };
  }

  const searchResult = await esearch(query, {
    retmax: 200,
    mindate: toPubmedDate(input.dateFrom),
    maxdate: toPubmedDate(input.dateTo),
    fetchAll: false,
  });

  const allPmids = searchResult.idList;

  if (allPmids.length === 0) {
    await writeCache(supabase, hash, []);
    return { pmids: [], cached: false, fetched: 0, inserted: 0, source: "pubmed" };
  }

  // 3. Filter out PMIDs already in DB
  const { data: existing } = await supabase
    .from("papers")
    .select("pmid")
    .in("pmid", allPmids);

  const existingSet = new Set(
    (existing ?? []).map((r: { pmid: string }) => r.pmid),
  );
  const newPmids = allPmids
    .filter((p) => !existingSet.has(p))
    .slice(0, MAX_NEW_PMIDS);

  let inserted = 0;

  if (newPmids.length > 0) {
    if (options.signal?.aborted) {
      throw new Error("on-demand aborted");
    }

    // 4. EFetch only the new PMIDs, parse batches
    const articles = await efetchAndParse(newPmids);

    // Group by journal to reuse storePapers signature
    const byJournal = new Map<string, typeof articles>();
    for (const article of articles) {
      if (!article.abstract || article.abstract.trim().length === 0) continue;
      const journalId = await resolveJournalIdForArticle(
        supabase,
        article.journalAbbreviation,
        article.journalTitle,
      );
      if (!journalId) continue;
      const bucket = byJournal.get(journalId) ?? [];
      bucket.push(article);
      byJournal.set(journalId, bucket);
    }

    for (const [journalId, bucket] of byJournal.entries()) {
      const result = await storePapers(supabase, journalId, bucket);
      inserted += result.inserted;
    }

    // 5. Fire-and-forget CrossRef enrichment
    if (inserted > 0) {
      try {
        await inngest.send({
          name: "pubmed/on-demand.enrich.requested",
          data: { triggered_at: new Date().toISOString() },
        });
      } catch (err) {
        console.warn("[OnDemand] Failed to enqueue enrichment:", err);
      }
    }
  }

  // 6. Refresh cache with full PMID list
  await writeCache(supabase, hash, allPmids);

  return {
    pmids: allPmids,
    cached: false,
    fetched: newPmids.length,
    inserted,
    source: "pubmed",
  };
}
