import { NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/server";
import { classifyPaperTopics } from "@/lib/utils/topic-tags";
import { decodeHtmlEntities } from "@/lib/utils/html-entities";

export async function GET() {
  const supabase = createAnonClient();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fromDate = sevenDaysAgo.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("papers")
    .select(
      `
      id, pmid, doi, title, abstract, publication_date,
      volume, issue, pages, keywords, mesh_terms, citation_count, journal_id,
      journals!inner (id, name, abbreviation, color, slug),
      paper_authors (last_name, first_name, initials, affiliation, position)
    `
    )
    .not("abstract", "is", null)
    .neq("abstract", "")
    .gte("publication_date", fromDate)
    .order("citation_count", { ascending: false, nullsFirst: false })
    .order("publication_date", { ascending: false })
    .order("position", { referencedTable: "paper_authors", ascending: true })
    .limit(50);

  if (error) {
    console.error("Trending query error:", error);
    return NextResponse.json(
      { error: "Failed to fetch trending papers" },
      { status: 500 }
    );
  }

  const papers = (data || []).map((paper) => {
    const journal = paper.journals;
    const authors = paper.paper_authors || [];
    const keywords = Array.isArray(paper.keywords)
      ? paper.keywords
          .filter((keyword): keyword is string => typeof keyword === "string")
          .map((keyword) => decodeHtmlEntities(keyword))
      : [];
    const meshTerms = Array.isArray(paper.mesh_terms)
      ? paper.mesh_terms
          .filter((term): term is string => typeof term === "string")
          .map((term) => decodeHtmlEntities(term))
      : [];
    const decodedTitle = decodeHtmlEntities(String(paper.title ?? ""));
    const decodedAbstract =
      typeof paper.abstract === "string"
        ? decodeHtmlEntities(paper.abstract)
        : null;
    const topicTags = classifyPaperTopics({
      title: decodedTitle,
      abstract: decodedAbstract,
      keywords,
      meshTerms,
    });

    return {
      id: paper.id,
      pmid: paper.pmid,
      doi: paper.doi,
      title: decodedTitle,
      abstract: decodedAbstract,
      publication_date: paper.publication_date,
      volume: paper.volume,
      issue: paper.issue,
      pages: paper.pages,
      keywords,
      mesh_terms: meshTerms,
      citation_count: paper.citation_count,
      journal_id: paper.journal_id,
      journal_name: journal.name,
      journal_abbreviation: journal.abbreviation,
      journal_color: journal.color,
      journal_slug: journal.slug,
      topic_tags: topicTags,
      authors: authors.map((a) => ({
        last_name: a.last_name,
        first_name: a.first_name,
        initials: a.initials,
        affiliation: a.affiliation,
        position: a.position,
      })),
    };
  });

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
