import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { inferLocationFromAffiliation } from "@/lib/utils/author-location";

interface AuthorRow {
  paper_id: string;
  last_name: string;
  first_name: string | null;
  initials: string | null;
  affiliation: string | null;
  position: number;
}

interface AuthorLeader {
  name: string;
  count: number;
  location: string;
}

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function formatName(lastName: string, firstName: string | null, initials: string | null): string {
  if (initials) return `${lastName} ${initials}`;
  if (firstName) return `${lastName} ${firstName.charAt(0)}`;
  return lastName;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const requestedDays = Number(searchParams.get("days") || "180");
  const days =
    Number.isFinite(requestedDays) && requestedDays >= 1
      ? Math.min(Math.floor(requestedDays), 365)
      : 180;

  const asOf = new Date();
  const fromDate = new Date(asOf.getTime() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const supabase = createServiceClient();

  // Get all paper IDs in date range
  const { data: paperRows, error: paperError } = await supabase
    .from("papers")
    .select("id")
    .gte("publication_date", fromDate)
    .not("abstract", "is", null)
    .neq("abstract", "")
    .limit(20000);

  if (paperError) {
    return NextResponse.json(
      { error: "Failed to fetch papers." },
      { status: 500 }
    );
  }

  const paperIds = (paperRows ?? []).map((p: { id: string }) => p.id);

  if (paperIds.length === 0) {
    return NextResponse.json({
      source: "database",
      days,
      asOf: asOf.toISOString(),
      fromDate,
      firstAuthors: [],
      correspondingAuthors: [],
    });
  }

  // Fetch all authors for these papers (need position to determine first/last)
  const allAuthors: AuthorRow[] = [];
  for (let i = 0; i < paperIds.length; i += 400) {
    const chunk = paperIds.slice(i, i + 400);
    const { data: rows, error } = await supabase
      .from("paper_authors")
      .select("paper_id, last_name, first_name, initials, affiliation, position")
      .in("paper_id", chunk);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch authors." },
        { status: 500 }
      );
    }

    allAuthors.push(...((rows ?? []) as AuthorRow[]));
  }

  // Group authors by paper_id
  const paperAuthorsMap = new Map<string, AuthorRow[]>();
  for (const a of allAuthors) {
    const list = paperAuthorsMap.get(a.paper_id);
    if (list) {
      list.push(a);
    } else {
      paperAuthorsMap.set(a.paper_id, [a]);
    }
  }

  const firstCounter = new Map<string, { count: number; locations: Map<string, number> }>();
  const corrCounter = new Map<string, { count: number; locations: Map<string, number> }>();

  for (const [, authors] of paperAuthorsMap) {
    const sorted = authors.sort((a, b) => a.position - b.position);
    if (sorted.length === 0) continue;

    // First author
    const first = sorted[0];
    const firstName = formatName(first.last_name, first.first_name, first.initials);
    const firstLoc = inferLocationFromAffiliation(first.affiliation);
    accumulateAuthor(firstCounter, firstName, firstLoc);

    // Corresponding author: explicit match or last author
    const explicit = sorted.find((a) =>
      /@|correspond/i.test(a.affiliation ?? "")
    );
    const corr = explicit ?? sorted[sorted.length - 1];
    const corrName = formatName(corr.last_name, corr.first_name, corr.initials);
    const corrLoc = inferLocationFromAffiliation(corr.affiliation);
    accumulateAuthor(corrCounter, corrName, corrLoc);
  }

  const firstAuthors = buildLeaderboard(firstCounter);
  const correspondingAuthors = buildLeaderboard(corrCounter);

  const response = NextResponse.json({
    source: "database",
    days,
    asOf: asOf.toISOString(),
    fromDate,
    totalPapers: paperIds.length,
    firstAuthors,
    correspondingAuthors,
  });

  response.headers.set(
    "Cache-Control",
    "public, s-maxage=3600, stale-while-revalidate=7200"
  );

  return response;
}

function accumulateAuthor(
  counter: Map<string, { count: number; locations: Map<string, number> }>,
  name: string,
  location: string
) {
  const current = counter.get(name);
  if (!current) {
    counter.set(name, {
      count: 1,
      locations: new Map([[location, 1]]),
    });
  } else {
    current.count += 1;
    current.locations.set(location, (current.locations.get(location) ?? 0) + 1);
  }
}

function buildLeaderboard(
  counter: Map<string, { count: number; locations: Map<string, number> }>
): AuthorLeader[] {
  return [...counter.entries()]
    .map(([name, data]) => {
      const location =
        [...data.locations.entries()]
          .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown location";
      return { name, count: data.count, location };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 10);
}
