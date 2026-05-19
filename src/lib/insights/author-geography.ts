import "server-only";
import { createAnonClient } from "@/lib/supabase/server";
import {
  getCoordinatesForLocation,
  inferLocationFromAffiliation,
} from "@/lib/utils/author-location";

// Both createAnonClient and createServiceClient return this type.
type SupabaseClientType = ReturnType<typeof createAnonClient>;

// Safety cap on first-author rows scanned. 180 days of the tracked journals is
// realistically well under this; it only guards against pathological volume.
const ROW_LIMIT = 20000;

// PostgREST caps a single response at db-max-rows (1000 on this project), so
// the full window is fetched by paging at this size until a short page lands.
const PAGE_SIZE = 1000;

export interface GeographyLocation {
  location: string;
  count: number;
  latestPublicationDate: string;
  lat: number | null;
  lon: number | null;
}

export interface AuthorGeographyResult {
  days: number;
  fromDate: string;
  totalFirstAuthors: number;
  locations: GeographyLocation[];
}

interface JoinedAuthorRow {
  paper_id: string;
  affiliation: string | null;
  papers:
    | { publication_date: string }
    | { publication_date: string }[]
    | null;
}

function publicationDateOf(row: JoinedAuthorRow): string {
  const paper = Array.isArray(row.papers) ? row.papers[0] : row.papers;
  return paper?.publication_date ?? "1970-01-01";
}

/**
 * Aggregate first-author (position 1) affiliations into geocoded location
 * counts for papers published within the trailing `days` window.
 *
 * Shared by the daily Inngest precompute job and the live fallback in the
 * /api/insights/author-geography route. Throws on a query error so callers
 * can decide how to surface it.
 */
export async function computeAuthorGeography(
  supabase: SupabaseClientType,
  days: number,
): Promise<AuthorGeographyResult> {
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // Page through the full window. A single query would be silently truncated
  // at db-max-rows (1000), so geography would only reflect a 1000-row sample.
  // Keyset pagination on paper_id rides the idx_paper_authors_first_author
  // partial index (paper_id WHERE position = 1) — ordering by an unindexed
  // column instead forces a sort of the join and hits the statement timeout.
  const rows: JoinedAuthorRow[] = [];
  let afterPaperId: string | null = null;
  for (let page = 0; page < ROW_LIMIT / PAGE_SIZE; page++) {
    let query = supabase
      .from("paper_authors")
      .select("paper_id, affiliation, papers!inner(publication_date)")
      .eq("position", 1)
      .gte("papers.publication_date", fromDate)
      .order("paper_id", { ascending: true })
      .limit(PAGE_SIZE);

    if (afterPaperId) {
      query = query.gt("paper_id", afterPaperId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`author-geography query failed: ${error.message}`);
    }

    const pageRows = (data ?? []) as unknown as JoinedAuthorRow[];
    rows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) break;
    afterPaperId = pageRows[pageRows.length - 1].paper_id;
  }

  const locationCounter = new Map<
    string,
    { count: number; latestPublicationDate: string }
  >();

  for (const row of rows) {
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

  const locations: GeographyLocation[] = [...locationCounter.entries()]
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

  return {
    days,
    fromDate,
    totalFirstAuthors: rows.length,
    locations,
  };
}
