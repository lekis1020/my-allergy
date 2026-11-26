/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { SWRConfig } from "swr";
import type { PapersResponse, PaperWithJournal } from "@/types/filters";
import { usePapers, buildPapersKey } from "../use-papers";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function mkPaper(i: number): PaperWithJournal {
  return {
    id: `id-${i}`,
    pmid: `pmid-${i}`,
    doi: null,
    title: `Paper ${i}`,
    abstract: "Abstract",
    publication_date: "2025-12-01",
    volume: null,
    issue: null,
    pages: null,
    keywords: [],
    mesh_terms: [],
    citation_count: i,
    journal_id: "j1",
    journal_name: "Journal of Allergy",
    journal_abbreviation: "J Allergy",
    journal_color: "#3366ff",
    journal_slug: "j-allergy",
    topic_tags: ["asthma"],
    authors: [],
    like_count: i,
    bookmark_count: 0,
    comment_count: i,
  };
}

function mkPage(start: number, count: number, hasMore: boolean): PapersResponse {
  const papers = Array.from({ length: count }, (_, i) => mkPaper(start + i));
  return {
    papers,
    total: hasMore ? count * 2 : count,
    limit: count,
    hasMore,
    nextCursor: hasMore ? "cursor-page-2" : null,
  };
}

function HookProbe({
  initialData,
  onReady,
}: {
  initialData: PapersResponse;
  onReady: (api: ReturnType<typeof usePapers>) => void;
}) {
  const api = usePapers({}, initialData, { skipMountRevalidation: true });
  useEffect(() => {
    onReady(api);
  }, [api, onReady]);
  return null;
}

describe("usePapers seeded anon cache", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;
  let cache: Map<string, { data?: unknown }>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    cache = new Map();
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("cursor=")) {
        return new Response(JSON.stringify(mkPage(11, 10, false)), {
          status: 200,
          headers: { "X-Data-Source": "db" },
        });
      }
      return new Response(JSON.stringify(mkPage(1, 10, true)), {
        status: 200,
        headers: { "X-Data-Source": "db" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not refetch page 1 when SSR data is seeded and loadMore runs", async () => {
    const initialData = mkPage(1, 10, true);
    const page1Key = buildPapersKey({}, 0, null);
    expect(page1Key).toBe("/api/papers?limit=10");

    let api: ReturnType<typeof usePapers> | null = null;
    await act(async () => {
      root.render(
        <SWRConfig value={{ provider: () => cache }}>
          <HookProbe
            initialData={initialData}
            onReady={(next) => {
              api = next;
            }}
          />
        </SWRConfig>,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(api).not.toBeNull();
    expect(api!.papers).toHaveLength(10);
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      api!.loadMore();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls).toContain("/api/papers?cursor=cursor-page-2&limit=10");
    expect(urls).not.toContain(page1Key);
  });

  it("keeps SSR social counts on the seeded first page", async () => {
    const initialData = mkPage(1, 3, false);
    initialData.papers[0].like_count = 7;
    initialData.papers[0].comment_count = 2;

    let api: ReturnType<typeof usePapers> | null = null;
    await act(async () => {
      root.render(
        <SWRConfig value={{ provider: () => cache }}>
          <HookProbe
            initialData={initialData}
            onReady={(next) => {
              api = next;
            }}
          />
        </SWRConfig>,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(api!.papers[0].like_count).toBe(7);
    expect(api!.papers[0].comment_count).toBe(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
