import type { Metadata } from "next";
import { Suspense } from "react";
import { createAnonClient } from "@/lib/supabase/server";
import { toPaperDto, type PaperRow } from "@/lib/papers/transform";
import { TrendingFeed } from "@/components/papers/trending-feed";
import { PaperCardSkeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Trending | My Allergy",
};

export const dynamic = "force-dynamic";

const POOL_SIZE = 50;
const RESULT_LIMIT = 10;

async function fetchTrendingPapers() {
  const supabase = createAnonClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 180);
  const fromDate = cutoff.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("papers")
    .select(
      `
      id, pmid, doi, title, abstract, publication_date, epub_date,
      volume, issue, pages, keywords, mesh_terms, citation_count, journal_id, publication_types,
      journals!inner (id, name, abbreviation, color, slug),
      paper_authors (last_name, first_name, initials, affiliation, position)
    `
    )
    .not("abstract", "is", null)
    .neq("abstract", "")
    .gte("epub_date", fromDate)
    .not("citation_count", "is", null)
    .gt("citation_count", 0)
    .order("citation_count", { ascending: false, nullsFirst: false })
    .order("epub_date", { ascending: false })
    .order("position", { referencedTable: "paper_authors", ascending: true })
    .limit(POOL_SIZE);

  if (error) {
    console.error("[fetchTrendingPapers] error:", error);
    return [];
  }

  const allPapers = (data || []).map((row) => toPaperDto(row as unknown as PaperRow));

  // Keep only papers with at least one allergy-related topic tag
  return allPapers
    .filter((p) => p.topic_tags.some((tag) => tag !== "others"))
    .slice(0, RESULT_LIMIT);
}

export default async function TrendingPage() {
  const papers = await fetchTrendingPapers();

  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-[1280px] px-0 sm:px-4 sm:py-4">
          <div className="mx-auto max-w-2xl border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {Array.from({ length: 5 }).map((_, i) => (
                <PaperCardSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <TrendingFeed initialPapers={papers} />
    </Suspense>
  );
}
