import { NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/server";
import { toPaperDto, type PaperRow } from "@/lib/papers/transform";

const POOL_SIZE = 50;
const RESULT_LIMIT = 10;

export async function GET() {
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
    console.error("Trending query error:", error);
    return NextResponse.json(
      { error: "Failed to fetch trending papers" },
      { status: 500 }
    );
  }

  const allPapers = (data || []).map((row) => toPaperDto(row as unknown as PaperRow));

  // Keep only papers with at least one allergy-related topic tag
  const papers = allPapers
    .filter((p) => p.topic_tags.some((tag) => tag !== "others"))
    .slice(0, RESULT_LIMIT);

  const response = NextResponse.json({
    papers,
    generatedAt: new Date().toISOString(),
  });

  response.headers.set(
    "Cache-Control",
    "public, s-maxage=300, stale-while-revalidate=600"
  );

  return response;
}
