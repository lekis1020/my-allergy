import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  getCoordinatesForLocation,
  inferLocationFromAffiliation,
} from "@/lib/utils/author-location";

interface PaperRow {
  id: string;
  publication_date: string;
}

interface AuthorRow {
  paper_id: string;
  affiliation: string | null;
}

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const requestedDays = Number(searchParams.get("days") || process.env.CRON_SYNC_DAYS || "180");
  const days =
    Number.isFinite(requestedDays) && requestedDays >= 1
      ? Math.min(Math.floor(requestedDays), 365)
      : 180;

  const asOf = new Date();
  const fromDate = new Date(asOf.getTime() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const supabase = createServiceClient();

  const { data: paperRows, error: paperError } = await supabase
    .from("papers")
    .select("id, publication_date")
    .gte("publication_date", fromDate)
    .order("publication_date", { ascending: false })
    .limit(20000);

  if (paperError) {
    return NextResponse.json(
      { error: "Failed to fetch papers for geography insights." },
      { status: 500 }
    );
  }

  const papers = (paperRows ?? []) as PaperRow[];
  if (papers.length === 0) {
    return NextResponse.json({
      source: "database",
      days,
      asOf: asOf.toISOString(),
      fromDate,
      totalFirstAuthors: 0,
      locations: [],
    });
  }

  const paperDateMap = new Map<string, string>(papers.map((paper) => [paper.id, paper.publication_date]));
  const paperIds = papers.map((paper) => paper.id);

  const authorRows: AuthorRow[] = [];
  for (let index = 0; index < paperIds.length; index += 400) {
    const chunk = paperIds.slice(index, index + 400);
    const { data: chunkRows, error: authorError } = await supabase
      .from("paper_authors")
      .select("paper_id, affiliation")
      .eq("position", 1)
      .in("paper_id", chunk);

    if (authorError) {
      return NextResponse.json(
        { error: "Failed to fetch first-author affiliations." },
        { status: 500 }
      );
    }

    authorRows.push(...((chunkRows ?? []) as AuthorRow[]));
  }

  const locationCounter = new Map<
    string,
    {
      count: number;
      latestPublicationDate: string;
    }
  >();

  for (const row of authorRows) {
    const location = inferLocationFromAffiliation(row.affiliation);
    const publicationDate = paperDateMap.get(row.paper_id) ?? "1970-01-01";

    const current = locationCounter.get(location);
    if (!current) {
      locationCounter.set(location, {
        count: 1,
        latestPublicationDate: publicationDate,
      });
      continue;
    }

    current.count += 1;
    if (publicationDate > current.latestPublicationDate) {
      current.latestPublicationDate = publicationDate;
    }
  }

  const locations = [...locationCounter.entries()]
    .map(([location, value]) => {
      const coordinates = getCoordinatesForLocation(location);
      return {
        location,
        count: value.count,
        latestPublicationDate: value.latestPublicationDate,
        lat: coordinates?.lat ?? null,
        lon: coordinates?.lon ?? null,
      };
    })
    .filter((entry) => entry.lat !== null && entry.lon !== null)
    .sort((a, b) => b.count - a.count || a.location.localeCompare(b.location))
    .slice(0, 30);

  return NextResponse.json({
    source: "database",
    days,
    asOf: asOf.toISOString(),
    fromDate,
    totalFirstAuthors: authorRows.length,
    locations,
  });
}
