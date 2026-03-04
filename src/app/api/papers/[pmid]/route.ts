import { NextRequest, NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/server";
import { decodeHtmlEntities } from "@/lib/utils/html-entities";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pmid: string }> }
) {
  const { pmid } = await params;
  const supabase = createAnonClient();

  const { data, error } = await supabase
    .from("papers")
    .select(
      `
      *,
      journals!inner (id, name, abbreviation, color, slug, impact_factor),
      paper_authors (last_name, first_name, initials, affiliation, position)
    `
    )
    .eq("pmid", pmid)
    .order("position", { referencedTable: "paper_authors", ascending: true })
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  const journal = data.journals as Record<string, unknown>;
  const authors = (data.paper_authors as Record<string, unknown>[]) || [];
  const keywords = Array.isArray(data.keywords)
    ? (data.keywords as unknown[])
        .filter((keyword): keyword is string => typeof keyword === "string")
        .map((keyword) => decodeHtmlEntities(keyword))
    : [];
  const meshTerms = Array.isArray(data.mesh_terms)
    ? (data.mesh_terms as unknown[])
        .filter((term): term is string => typeof term === "string")
        .map((term) => decodeHtmlEntities(term))
    : [];

  return NextResponse.json({
    ...data,
    title: decodeHtmlEntities(String(data.title ?? "")),
    abstract:
      typeof data.abstract === "string" ? decodeHtmlEntities(data.abstract) : null,
    keywords,
    mesh_terms: meshTerms,
    journals: undefined,
    paper_authors: undefined,
    journal: {
      id: journal.id,
      name: journal.name,
      abbreviation: journal.abbreviation,
      color: journal.color,
      slug: journal.slug,
      impact_factor: journal.impact_factor,
    },
    authors: authors.map((a) => ({
      last_name: a.last_name,
      first_name: a.first_name,
      initials: a.initials,
      affiliation:
        typeof a.affiliation === "string"
          ? decodeHtmlEntities(a.affiliation)
          : a.affiliation,
      position: a.position,
    })),
  });
}
