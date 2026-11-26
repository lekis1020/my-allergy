import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import type { PaperWithJournal, PapersResponse } from "@/types/filters";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => React.createElement("a", { href }, children),
}));

vi.mock("@/components/ads/ad-banner", () => ({
  AdBanner: () => null,
}));

import { HomePageFallback } from "../home-page-fallback";

const mkPaper = (i: number): PaperWithJournal => ({
  id: `id-${i}`,
  pmid: `pmid-${i}`,
  doi: null,
  title: `Allergy Paper ${i}`,
  abstract: "An abstract about allergy research.",
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

function mkInitialData(count: number): PapersResponse {
  return {
    papers: Array.from({ length: count }, (_, i) => mkPaper(i + 1)),
    total: count,
    limit: 10,
    hasMore: false,
    nextCursor: null,
  };
}

describe("HomePageFallback first paint", () => {
  it("includes paper links in SSR HTML when initialData is present", () => {
    const html = renderToStaticMarkup(
      React.createElement(HomePageFallback, { initialData: mkInitialData(3) }),
    );

    const paperLinks = html.match(/href="\/paper\/[^"]+"/g) ?? [];
    expect(paperLinks.length).toBe(3);
    expect(html).toContain('href="/paper/pmid-1"');
    expect(html).toContain("Allergy Paper 1");
    expect(html).not.toContain("animate-pulse");
  });

  it("shows loading skeletons only when initialData is missing", () => {
    const html = renderToStaticMarkup(React.createElement(HomePageFallback, {}));
    expect(html).not.toMatch(/href="\/paper\//);
    expect(html).toContain("animate-pulse");
  });
});
