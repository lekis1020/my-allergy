import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---- Mocks for supabase, pubmed client, store, inngest ----

type CacheRow = {
  query_hash: string;
  pmids: string[];
  fetched_at: string;
  ttl_seconds: number;
};

const cacheStore = new Map<string, CacheRow>();
const papersStore = new Set<string>(); // existing pmids
const journalIdBySlug = new Map<string, string>([
  ["jaci", "jrnl-jaci-id"],
]);

const esearchMock =
  vi.fn<(...args: unknown[]) => Promise<{ count: number; idList: string[] }>>();
const efetchMock = vi.fn<(pmids: string[]) => Promise<unknown[]>>();
const storePapersMock =
  vi.fn<
    (
      client: unknown,
      journalId: string,
      articles: unknown[],
    ) => Promise<{ inserted: number; updated: number; errors: number }>
  >();
const inngestSendMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();

// Minimal query-builder returning thenable — emulates Supabase chain.
function makeQueryBuilder(table: string) {
  const state: {
    table: string;
    eqCol?: string;
    eqVal?: string;
    inCol?: string;
    inVals?: string[];
    upsertRow?: CacheRow;
    single?: boolean;
    maybeSingle?: boolean;
  } = { table };

  const api: {
    select: () => typeof api;
    eq: (col: string, val: string) => typeof api;
    in: (col: string, vals: string[]) => typeof api;
    maybeSingle: () => Promise<{ data: unknown; error: null }>;
    single: () => Promise<{ data: unknown; error: null }>;
    upsert: (row: CacheRow) => { then: (cb: (v: { error: null }) => unknown) => Promise<unknown> };
    then: (cb: (v: { data: unknown; error: null }) => unknown) => Promise<unknown>;
  } = {
    select() {
      return api;
    },
    eq(col: string, val: string) {
      state.eqCol = col;
      state.eqVal = val;
      return api;
    },
    in(col: string, vals: string[]) {
      state.inCol = col;
      state.inVals = vals;
      return api;
    },
    maybeSingle() {
      state.maybeSingle = true;
      return resolve();
    },
    single() {
      state.single = true;
      return resolve();
    },
    upsert(row: CacheRow) {
      state.upsertRow = row;
      return {
        then(onFulfilled: (value: { error: null }) => unknown) {
          if (row.query_hash) {
            cacheStore.set(row.query_hash, row);
          }
          return Promise.resolve(onFulfilled({ error: null }));
        },
      };
    },
    then(onFulfilled: (value: { data: unknown; error: null }) => unknown) {
      return resolve().then(onFulfilled);
    },
  };

  function resolve(): Promise<{ data: unknown; error: null }> {
    if (table === "pubmed_query_cache" && state.eqCol === "query_hash" && state.eqVal) {
      const row = cacheStore.get(state.eqVal) ?? null;
      return Promise.resolve({ data: row, error: null });
    }
    if (table === "papers" && state.inCol === "pmid" && state.inVals) {
      const data = state.inVals
        .filter((p) => papersStore.has(p))
        .map((pmid) => ({ pmid }));
      return Promise.resolve({ data, error: null });
    }
    if (table === "journals" && state.eqCol === "slug" && state.eqVal) {
      const id = journalIdBySlug.get(state.eqVal);
      return Promise.resolve({
        data: id ? { id } : null,
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: null });
  }

  return api;
}

const supabaseMock = {
  from: (table: string) => makeQueryBuilder(table),
};

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => supabaseMock,
  createAnonClient: () => supabaseMock,
}));

vi.mock("@/lib/pubmed/client", () => ({
  esearch: (q: string, opts?: unknown) => esearchMock(q, opts),
  efetchAndParse: (pmids: string[]) => efetchMock(pmids),
}));

vi.mock("@/lib/sync/store", () => ({
  storePapers: (client: unknown, journalId: string, articles: unknown[]) =>
    storePapersMock(client, journalId, articles),
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: (payload: unknown) => inngestSendMock(payload),
  },
}));

vi.mock("@/lib/constants/journals", () => ({
  JOURNALS: [
    {
      slug: "jaci",
      name: "Journal of Allergy and Clinical Immunology",
      abbreviation: "J Allergy Clin Immunol",
      issn: null,
      eIssn: null,
      impactFactor: null,
      color: "#000",
      pubmedQuery: "J Allergy Clin Immunol[ta]",
    },
  ],
}));

// Import after mocks are set up.
import { fetchOnDemand, computeQueryHash } from "../on-demand";

function makeArticle(pmid: string) {
  return {
    pmid,
    title: `Title ${pmid}`,
    abstract: "An abstract here.",
    authors: [],
    journalTitle: "Journal of Allergy and Clinical Immunology",
    journalAbbreviation: "J Allergy Clin Immunol",
    volume: null,
    issue: null,
    pages: null,
    publicationDate: "2026-01-01",
    epubDate: "2026-01-01",
    doi: null,
    keywords: [],
    meshTerms: [],
  };
}

describe("fetchOnDemand", () => {
  beforeEach(() => {
    cacheStore.clear();
    papersStore.clear();
    esearchMock.mockReset();
    efetchMock.mockReset();
    storePapersMock.mockReset();
    storePapersMock.mockImplementation(async (_client, _jid, articles) => ({
      inserted: articles.length,
      updated: 0,
      errors: 0,
    }));
    inngestSendMock.mockReset();
    inngestSendMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("computes a stable hash regardless of journal ordering", () => {
    const a = computeQueryHash({ query: "asthma", journals: ["jaci", "aci"] });
    const b = computeQueryHash({ query: "asthma", journals: ["aci", "jaci"] });
    expect(a).toBe(b);
  });

  it("returns cached PMIDs when TTL is still valid", async () => {
    const input = { query: "asthma" };
    const hash = computeQueryHash(input);
    cacheStore.set(hash, {
      query_hash: hash,
      pmids: ["111", "222"],
      fetched_at: new Date().toISOString(),
      ttl_seconds: 1800,
    });

    const result = await fetchOnDemand(input);

    expect(result.source).toBe("cache");
    expect(result.cached).toBe(true);
    expect(result.pmids).toEqual(["111", "222"]);
    expect(esearchMock).not.toHaveBeenCalled();
    expect(efetchMock).not.toHaveBeenCalled();
  });

  it("filters out PMIDs already present and only fetches the new ones", async () => {
    papersStore.add("111"); // already in DB
    esearchMock.mockResolvedValue({
      count: 2,
      idList: ["111", "222"],
    });
    efetchMock.mockResolvedValue([makeArticle("222")]);

    const result = await fetchOnDemand({ query: "asthma" });

    expect(esearchMock).toHaveBeenCalledOnce();
    expect(efetchMock).toHaveBeenCalledWith(["222"]);
    expect(storePapersMock).toHaveBeenCalledOnce();
    expect(result.source).toBe("pubmed");
    expect(result.cached).toBe(false);
    expect(result.pmids).toEqual(["111", "222"]);
    expect(result.fetched).toBe(1);
    expect(inngestSendMock).toHaveBeenCalledOnce();
  });

  it("treats expired cache rows as a miss", async () => {
    const input = { query: "asthma" };
    const hash = computeQueryHash(input);
    cacheStore.set(hash, {
      query_hash: hash,
      pmids: ["old"],
      fetched_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1h ago
      ttl_seconds: 30 * 60,
    });
    esearchMock.mockResolvedValue({ count: 0, idList: [] });

    const result = await fetchOnDemand(input);

    expect(result.source).toBe("pubmed");
    expect(result.pmids).toEqual([]);
    expect(esearchMock).toHaveBeenCalledOnce();
  });

  it("propagates abort via AbortSignal before PubMed call", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      fetchOnDemand({ query: "asthma" }, { signal: controller.signal }),
    ).rejects.toThrow(/aborted/);
    expect(esearchMock).not.toHaveBeenCalled();
  });

  it("does not enqueue enrichment when nothing was inserted", async () => {
    papersStore.add("111");
    papersStore.add("222");
    esearchMock.mockResolvedValue({
      count: 2,
      idList: ["111", "222"],
    });

    const result = await fetchOnDemand({ query: "asthma" });

    expect(efetchMock).not.toHaveBeenCalled();
    expect(result.inserted).toBe(0);
    expect(inngestSendMock).not.toHaveBeenCalled();
  });
});
