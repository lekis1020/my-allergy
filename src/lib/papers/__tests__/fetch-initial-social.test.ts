import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const fetchSocialCountsMock = vi.fn();

vi.mock("@/lib/papers/social-counts", () => ({
  fetchSocialCounts: (...args: unknown[]) => fetchSocialCountsMock(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAnonClient: () => ({
    from: () => ({
      select: () => ({
        not: () => ({
          neq: () => ({
            order: () => ({
              order: () => ({
                order: () => ({
                  range: () =>
                    Promise.resolve({
                      data: [
                        {
                          id: "id-1",
                          pmid: "pmid-1",
                          doi: null,
                          title: "Paper 1",
                          abstract: "Abstract",
                          publication_date: "2025-12-01",
                          epub_date: "2025-12-01",
                          volume: null,
                          issue: null,
                          pages: null,
                          keywords: [],
                          mesh_terms: [],
                          citation_count: 1,
                          ai_summary: null,
                          journal_id: "j1",
                          journals: {
                            id: "j1",
                            name: "Journal of Allergy",
                            abbreviation: "J Allergy",
                            color: "#3366ff",
                            slug: "j-allergy",
                          },
                          paper_authors: [],
                        },
                      ],
                      count: 1,
                      error: null,
                    }),
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  }),
  createServiceClient: () => ({ __service: true }),
}));

import { fetchInitialPapers } from "../fetch-initial";

describe("fetchInitialPapers social counts", () => {
  beforeEach(() => {
    fetchSocialCountsMock.mockReset();
    fetchSocialCountsMock.mockResolvedValue(
      new Map([
        [
          "pmid-1",
          { like: 4, bookmark: 1, comment: 3, connection: 0 },
        ],
      ]),
    );
  });

  it("attaches like and comment counts on the SSR payload", async () => {
    const result = await fetchInitialPapers();

    expect(fetchSocialCountsMock).toHaveBeenCalledOnce();
    expect(fetchSocialCountsMock.mock.calls[0][1]).toEqual(["pmid-1"]);
    expect(result.papers).toHaveLength(1);
    expect(result.papers[0].like_count).toBe(4);
    expect(result.papers[0].bookmark_count).toBe(1);
    expect(result.papers[0].comment_count).toBe(3);
    expect(result.papers[0].connection_count).toBe(0);
  });
});
