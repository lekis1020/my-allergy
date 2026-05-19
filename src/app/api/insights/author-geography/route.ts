import { NextRequest, NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/utils/rate-limit";
import {
  getCoordinatesForLocation,
  inferLocationFromAffiliation,
} from "@/lib/utils/author-location";

// Safety cap on first-author rows scanned. 180 days of the tracked journals is
// realistically well under this; it only guards against pathological volume.
const ROW_LIMIT = 20000;

interface JoinedAuthorRow {
  affiliation: string | null;
  papers:
    | { publication_date: string }
    | { publication_date: string }[]
    | null;
}

const limiter = rateLimit({ windowMs: 60_000, maxRequests: 10 });

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function publicationDateOf(row: JoinedAuthorRow): string {
  const paper = Array.isArray(row.papers) ? row.papers[0] : row.papers;
  return paper?.publication_date ?? "1970-01-01";
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const { success } = limiter.check(ip);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

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

  const supabase = createAnonClient();

  // Single join query: first authors (position 1) of papers published within
  // the window. Previously this fetched up to 20k papers and then issued ~50
  // sequential chunked paper_authors queries — that waterfall blew past the
  // Postgres statement timeout. The inner join does it in one round-trip.
  const { data: rows, error } = await supabase
    .from("paper_authors")
    .select("affiliation, papers!inner(publication_date)")
    .eq("position", 1)
    .gte("papers.publication_date", fromDate)
    .limit(ROW_LIMIT);

  if (error) {
    console.error("[author-geography] query error:", error);
    return NextResponse.json(
      { error: "Failed to fetch first-author affiliations." },
      { status: 500 }
    );
  }

  const authorRows = (rows ?? []) as unknown as JoinedAuthorRow[];

  const locationCounter = new Map<
    string,
    { count: number; latestPublicationDate: string }
  >();

  for (const row of authorRows) {
    const location = inferLocationFromAffiliation(row.affiliation);
    const publicationDate = publicationDateOf(row);

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

  const response = NextResponse.json({
    source: "database",
    days,
    asOf: asOf.toISOString(),
    fromDate,
    totalFirstAuthors: authorRows.length,
    locations,
  });

  // Geography shifts at most once per daily sync, so allow the CDN/browser to
  // serve a cached copy for an hour and revalidate in the background for a day.
  response.headers.set(
    "Cache-Control",
    "public, s-maxage=3600, stale-while-revalidate=86400"
  );

  return response;
}
