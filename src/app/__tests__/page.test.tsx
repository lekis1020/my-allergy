import { beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import type { PapersResponse } from "@/types/filters";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/papers/fetch-initial", () => ({
  fetchInitialPapers: vi.fn(),
}));
vi.mock("@/components/papers/home-page", () => ({
  HomePage: vi.fn(),
}));

import Page, { TimelineFeed } from "../page";
import { fetchInitialPapers } from "@/lib/papers/fetch-initial";
import { HomePage } from "@/components/papers/home-page";

const mockFetchInitialPapers = vi.mocked(fetchInitialPapers);

const initialData: PapersResponse = {
  papers: [],
  total: 0,
  limit: 10,
  hasMore: false,
  nextCursor: null,
};

describe("home page initial feed", () => {
  beforeEach(() => {
    mockFetchInitialPapers.mockReset();
    mockFetchInitialPapers.mockResolvedValue(initialData);
  });

  it("returns the Suspense boundary synchronously without fetching", () => {
    const result = Page();

    expect(result).not.toBeInstanceOf(Promise);
    expect(result.type).toBe(Suspense);
    expect(result.props.children.type).toBe(TimelineFeed);
    expect(mockFetchInitialPapers).not.toHaveBeenCalled();
  });

  it("fetches and passes initial data from TimelineFeed", async () => {
    const result = await TimelineFeed();

    expect(mockFetchInitialPapers).toHaveBeenCalledOnce();
    expect(result.type).toBe(HomePage);
    expect(result.props.initialData).toBe(initialData);
  });
});
