import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import type { PaperWithJournal } from "@/types/filters";

// TrendingFeed pulls its data through useTrending; mock it so each test can
// drive the papers/error/loading combination directly.
vi.mock("@/hooks/use-trending", () => ({ useTrending: vi.fn() }));

import { TrendingFeed } from "../trending-feed";
import { useTrending } from "@/hooks/use-trending";

const mockUseTrending = vi.mocked(useTrending);

const mkPaper = (i: number): PaperWithJournal => ({
  id: `id-${i}`,
  pmid: `pmid-${i}`,
  doi: null,
  title: `Trending Paper ${i} on asthma`,
  abstract: "An abstract about allergy and asthma research.",
  publication_date: "2025-12-01",
  volume: null,
  issue: null,
  pages: null,
  keywords: [],
  mesh_terms: [],
  citation_count: 10 + i,
  journal_id: "j1",
  journal_name: "Journal of Allergy",
  journal_abbreviation: "J Allergy",
  journal_color: "#3366ff",
  journal_slug: "j-allergy",
  topic_tags: ["asthma"],
  authors: [
    { last_name: "Kim", first_name: "A", initials: "A", affiliation: null, position: 1 },
  ],
});

const render = () => renderToStaticMarkup(React.createElement(TrendingFeed));

describe("TrendingFeed", () => {
  beforeEach(() => mockUseTrending.mockReset());

  it("keeps showing papers when a revalidation error occurs", () => {
    // The bug: a failed /api/trending revalidation discarded valid papers.
    mockUseTrending.mockReturnValue({
      window: "default",
      papers: [mkPaper(1), mkPaper(2)],
      weekPapers: [],
      weekStartsOn: null,
      hasPreviousWeek: false,
      isLoading: false,
      error: new Error("Trending API error: 500"),
    });
    const html = render();
    expect(html).toContain("Trending Paper 1 on asthma");
    expect(html).not.toContain("Failed to load trending papers");
  });

  it("shows the error UI only when there are no papers to show", () => {
    mockUseTrending.mockReturnValue({
      window: "default",
      papers: [],
      weekPapers: [],
      weekStartsOn: null,
      hasPreviousWeek: false,
      isLoading: false,
      error: new Error("Trending API error: 500"),
    });
    expect(render()).toContain("Failed to load trending papers");
  });

  it("shows the empty state when there is no data and no error", () => {
    mockUseTrending.mockReturnValue({
      window: "default",
      papers: [],
      weekPapers: [],
      weekStartsOn: null,
      hasPreviousWeek: false,
      isLoading: false,
      error: undefined,
    });
    expect(render()).toContain("No trending papers yet");
  });

  it("renders the paper list on success", () => {
    mockUseTrending.mockReturnValue({
      window: "default",
      papers: [mkPaper(1)],
      weekPapers: [],
      weekStartsOn: null,
      hasPreviousWeek: false,
      isLoading: false,
      error: undefined,
    });
    const html = render();
    expect(html).toContain("Trending Paper 1 on asthma");
    expect(html).not.toContain("No trending papers yet");
  });
});
