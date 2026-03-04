import type { PaperWithJournal } from "@/types/filters";

export interface LocationCoordinates {
  lat: number;
  lon: number;
}

export interface AuthorLocationPoint {
  location: string;
  count: number;
  lat: number;
  lon: number;
  latestPublicationDate?: string;
}

const COUNTRY_COORDINATES: Record<string, LocationCoordinates> = {
  "South Korea": { lat: 36.5, lon: 127.9 },
  Japan: { lat: 36.2, lon: 138.3 },
  China: { lat: 35.9, lon: 104.2 },
  Taiwan: { lat: 23.7, lon: 121.0 },
  Singapore: { lat: 1.35, lon: 103.82 },
  India: { lat: 20.6, lon: 78.9 },
  Australia: { lat: -25.3, lon: 133.8 },
  Canada: { lat: 56.1, lon: -106.3 },
  "United States": { lat: 39.8, lon: -98.6 },
  "United Kingdom": { lat: 55.0, lon: -3.4 },
  Germany: { lat: 51.2, lon: 10.4 },
  France: { lat: 46.2, lon: 2.2 },
  Italy: { lat: 41.9, lon: 12.6 },
  Spain: { lat: 40.4, lon: -3.7 },
  Netherlands: { lat: 52.1, lon: 5.3 },
  Sweden: { lat: 60.1, lon: 18.6 },
  Brazil: { lat: -14.2, lon: -51.9 },
  Turkey: { lat: 38.9, lon: 35.2 },
  Switzerland: { lat: 46.8, lon: 8.2 },
  Austria: { lat: 47.5, lon: 14.5 },
  Belgium: { lat: 50.8, lon: 4.4 },
};

const CITY_COORDINATES: Record<string, LocationCoordinates> = {
  Seoul: { lat: 37.57, lon: 126.98 },
  Tokyo: { lat: 35.68, lon: 139.76 },
  Beijing: { lat: 39.9, lon: 116.4 },
  Shanghai: { lat: 31.23, lon: 121.47 },
  Taipei: { lat: 25.03, lon: 121.56 },
  Singapore: { lat: 1.29, lon: 103.85 },
  London: { lat: 51.51, lon: -0.13 },
  Paris: { lat: 48.86, lon: 2.35 },
  Berlin: { lat: 52.52, lon: 13.4 },
  Madrid: { lat: 40.42, lon: -3.7 },
  Rome: { lat: 41.9, lon: 12.49 },
  Amsterdam: { lat: 52.37, lon: 4.9 },
  Stockholm: { lat: 59.33, lon: 18.07 },
  Zurich: { lat: 47.37, lon: 8.54 },
  Vienna: { lat: 48.21, lon: 16.37 },
  Brussels: { lat: 50.85, lon: 4.35 },
  Sydney: { lat: -33.87, lon: 151.21 },
  Melbourne: { lat: -37.81, lon: 144.96 },
  Toronto: { lat: 43.65, lon: -79.38 },
  Montreal: { lat: 45.5, lon: -73.57 },
  "New York": { lat: 40.71, lon: -74.01 },
  Boston: { lat: 42.36, lon: -71.06 },
  Chicago: { lat: 41.88, lon: -87.63 },
  Houston: { lat: 29.76, lon: -95.37 },
  "Los Angeles": { lat: 34.05, lon: -118.24 },
  Istanbul: { lat: 41.01, lon: 28.98 },
  Ankara: { lat: 39.93, lon: 32.86 },
};

const COUNTRY_REGEX: Array<{ regex: RegExp; label: string }> = [
  { regex: /\b(korea|south korea|republic of korea)\b/i, label: "South Korea" },
  { regex: /\bjapan\b/i, label: "Japan" },
  { regex: /\bchina\b/i, label: "China" },
  { regex: /\btaiwan\b/i, label: "Taiwan" },
  { regex: /\bsingapore\b/i, label: "Singapore" },
  { regex: /\bindia\b/i, label: "India" },
  { regex: /\baustralia\b/i, label: "Australia" },
  { regex: /\bcanada\b/i, label: "Canada" },
  { regex: /\bunited states\b|\busa\b|\bu\.s\.\b/i, label: "United States" },
  { regex: /\bunited kingdom\b|\buk\b|\bu\.k\.\b/i, label: "United Kingdom" },
  { regex: /\bgermany\b/i, label: "Germany" },
  { regex: /\bfrance\b/i, label: "France" },
  { regex: /\bitaly\b/i, label: "Italy" },
  { regex: /\bspain\b/i, label: "Spain" },
  { regex: /\bnetherlands\b/i, label: "Netherlands" },
  { regex: /\bsweden\b/i, label: "Sweden" },
  { regex: /\bbrazil\b/i, label: "Brazil" },
  { regex: /\bturkey\b/i, label: "Turkey" },
  { regex: /\bswitzerland\b/i, label: "Switzerland" },
  { regex: /\baustria\b/i, label: "Austria" },
  { regex: /\bbelgium\b/i, label: "Belgium" },
];

export function inferLocationFromAffiliation(affiliation: string | null): string {
  if (!affiliation) return "Unknown location";

  const text = affiliation.trim();
  if (!text) return "Unknown location";

  for (const rule of COUNTRY_REGEX) {
    if (rule.regex.test(text)) {
      return rule.label;
    }
  }

  const parts = text
    .replace(/\s+/g, " ")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const clean = parts[index]
      .replace(/\b\d{3,}\b/g, "")
      .replace(/[.;]/g, "")
      .trim();
    if (!clean) continue;

    const city = Object.keys(CITY_COORDINATES).find(
      (candidate) => candidate.toLowerCase() === clean.toLowerCase()
    );
    if (city) return city;
  }

  const fallback = parts[parts.length - 1]
    ?.replace(/\b\d{3,}\b/g, "")
    .replace(/[.;]/g, "")
    .trim();

  return fallback || "Unknown location";
}

export function getCoordinatesForLocation(location: string): LocationCoordinates | null {
  if (!location || location === "Unknown location") return null;

  const country = COUNTRY_COORDINATES[location];
  if (country) return country;

  const city = CITY_COORDINATES[location];
  if (city) return city;

  return null;
}

export function aggregateFirstAuthorLocations(papers: PaperWithJournal[]): AuthorLocationPoint[] {
  const counter = new Map<string, { count: number; latestPublicationDate: string }>();

  for (const paper of papers) {
    const firstAuthor = [...paper.authors]
      .sort((a, b) => a.position - b.position)[0];

    if (!firstAuthor) continue;

    const location = inferLocationFromAffiliation(firstAuthor.affiliation);
    const current = counter.get(location);
    if (!current) {
      counter.set(location, {
        count: 1,
        latestPublicationDate: paper.publication_date,
      });
      continue;
    }

    current.count += 1;
    if (paper.publication_date > current.latestPublicationDate) {
      current.latestPublicationDate = paper.publication_date;
    }
  }

  return [...counter.entries()]
    .map(([location, value]) => {
      const coords = getCoordinatesForLocation(location);
      return {
        location,
        count: value.count,
        latestPublicationDate: value.latestPublicationDate,
        lat: coords?.lat ?? 0,
        lon: coords?.lon ?? 0,
        hasCoordinates: Boolean(coords),
      };
    })
    .filter((entry) => entry.hasCoordinates)
    .map(({ hasCoordinates: _, ...entry }) => entry)
    .sort((a, b) => b.count - a.count || a.location.localeCompare(b.location))
    .slice(0, 12);
}
