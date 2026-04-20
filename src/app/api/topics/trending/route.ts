import { NextRequest, NextResponse } from "next/server";
import { ONGOING_STATUSES } from "@/lib/clinical-trials/monitor";
import { TRENDING_CATEGORIES } from "@/lib/constants/trending-categories";

const OUTCOME_EXCLUDE = new Set([
  "safety",
  "efficacy",
  "tolerability",
  "adverse events",
  "serious adverse events",
  "pharmacokinetics",
  "pharmacodynamics",
  "quality of life",
  "patient reported outcomes",
  "biomarker",
  "biomarkers",
  "placebo",
]);

const LOWERCASE_WORDS = new Set([
  "a", "an", "the", "in", "of", "and", "or", "for", "to", "with", "by", "on", "at",
]);

export async function GET(request: NextRequest) {
  const categoryId = request.nextUrl.searchParams.get("category");

  if (!categoryId) {
    return NextResponse.json(
      { error: "category parameter required" },
      { status: 400 },
    );
  }

  const category = TRENDING_CATEGORIES.find((c) => c.id === categoryId);
  if (!category) {
    return NextResponse.json(
      { error: "Invalid category" },
      { status: 400 },
    );
  }

  try {
    const { studies, totalStudies } = await fetchTrialOutcomes(category.searchQuery);
    const excludeSet = new Set(category.excludeTerms.map((t) => t.toLowerCase()));
    const outcomeScores = new Map<string, { score: number; rawCount: number }>();

    for (const study of studies) {
      const seen = new Set<string>();

      for (const outcome of study.primary) {
        const normalized = normalizeOutcome(outcome, excludeSet);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        const existing = outcomeScores.get(normalized);
        if (existing) {
          existing.score += 2;
          existing.rawCount += 1;
        } else {
          outcomeScores.set(normalized, { score: 2, rawCount: 1 });
        }
      }

      // Secondary outcomes excluded — primary only for clarity
    }

    const ranked = [...outcomeScores.entries()].map(([keyword, { score, rawCount }]) => ({
      keyword,
      score,
      rawCount,
      wordCount: keyword.split(/\s+/).length,
    }));

    const deduped = deduplicateSimilar(ranked);

    const trending = deduped
      .sort((a, b) => b.score - a.score || b.rawCount - a.rawCount)
      .slice(0, 8)
      .map(({ keyword, rawCount }) => ({
        keyword: capitalizePhrase(keyword),
        count: rawCount,
      }));

    const response = NextResponse.json({
      category: category.id,
      label: category.label,
      topics: trending,
      totalStudies,
      source: "clinicaltrials.gov-outcomes",
    });

    response.headers.set(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=7200",
    );

    return response;
  } catch (error) {
    console.error("Trending topics outcome query error:", error);
    return NextResponse.json(
      { error: "Failed to fetch trending outcome topics" },
      { status: 500 },
    );
  }
}

function deduplicateSimilar(
  entries: Array<{ keyword: string; score: number; rawCount: number; wordCount: number }>,
): Array<{ keyword: string; score: number; rawCount: number; wordCount: number }> {
  const sorted = [...entries].sort((a, b) => b.score - a.score);
  const kept: typeof sorted = [];

  for (const entry of sorted) {
    const entryWords = new Set(entry.keyword.split(/\s+/));
    const isDuplicate = kept.some((existing) => {
      const existingWords = new Set(existing.keyword.split(/\s+/));
      const smaller = Math.min(entryWords.size, existingWords.size);
      if (smaller === 0) return false;
      let overlap = 0;
      for (const word of entryWords) {
        if (existingWords.has(word)) overlap++;
      }
      return overlap / smaller >= 0.6;
    });
    if (!isDuplicate) kept.push(entry);
  }

  return kept;
}

function capitalizePhrase(phrase: string): string {
  return phrase
    .split(" ")
    .map((word, i) => {
      if (i > 0 && LOWERCASE_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

interface ClinicalTrialsOutcomeResponse {
  totalCount?: number;
  nextPageToken?: string;
  studies?: Array<{
    protocolSection?: {
      outcomesModule?: {
        primaryOutcomes?: Array<{ measure?: string; description?: string }>;
        secondaryOutcomes?: Array<{ measure?: string; description?: string }>;
      };
    };
  }>;
}

interface ParsedStudyOutcomes {
  primary: string[];
  secondary: string[];
}

async function fetchTrialOutcomes(query: string): Promise<{
  studies: ParsedStudyOutcomes[];
  totalStudies: number;
}> {
  const studies: ParsedStudyOutcomes[] = [];
  let totalStudies = 0;
  let pageToken: string | null = null;

  for (let page = 0; page < 3; page++) {
    const url = buildClinicalTrialsOutcomesUrl(query, pageToken);
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate: 3_600 },
    });

    if (!response.ok) {
      throw new Error(`clinicaltrials.gov outcomes request failed (${response.status})`);
    }

    const payload = (await response.json()) as ClinicalTrialsOutcomeResponse;
    if (page === 0) {
      totalStudies = payload.totalCount ?? 0;
    }

    for (const study of payload.studies ?? []) {
      const primary = extractOutcomeTexts(
        study.protocolSection?.outcomesModule?.primaryOutcomes,
      );
      const secondary = extractOutcomeTexts(
        study.protocolSection?.outcomesModule?.secondaryOutcomes,
      );
      if (primary.length === 0 && secondary.length === 0) continue;
      studies.push({ primary, secondary });
    }

    if (!payload.nextPageToken) break;
    pageToken = payload.nextPageToken;
  }

  return { studies, totalStudies: totalStudies || studies.length };
}

function buildClinicalTrialsOutcomesUrl(query: string, pageToken?: string | null): string {
  const url = new URL("https://clinicaltrials.gov/api/v2/studies");
  url.searchParams.set("query.cond", query);
  url.searchParams.set("filter.overallStatus", ONGOING_STATUSES.join(","));
  url.searchParams.set("countTotal", "true");
  url.searchParams.set("pageSize", "100");
  url.searchParams.set("format", "json");
  if (pageToken) {
    url.searchParams.set("pageToken", pageToken);
  }
  return url.toString();
}

function extractOutcomeTexts(
  outcomes?: Array<{ measure?: string; description?: string }>,
): string[] {
  if (!Array.isArray(outcomes)) return [];
  return outcomes
    .map((outcome) => outcome.measure?.trim() || outcome.description?.trim() || "")
    .filter((text): text is string => text.length > 0);
}

function normalizeOutcome(raw: string, categoryExclude: Set<string>): string | null {
  const lowered = raw
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9%/+ -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!lowered || lowered.length < 6) return null;

  const stripped = stripGenericPrefixes(lowered);
  if (!stripped || stripped.length < 6) return null;
  if (categoryExclude.has(stripped)) return null;
  if (stripped.includes("placebo")) return null;
  if (OUTCOME_EXCLUDE.has(stripped)) return null;
  if (stripped.split(/\s+/).length < 2) return null;

  return stripped;
}

function stripGenericPrefixes(text: string): string {
  return text
    .replace(
      /^(change|mean change|percent change|difference|improvement|reduction)\s+(from baseline\s+)?(in|of)\s+/,
      "",
    )
    .replace(
      /^(proportion|percentage|number|rate)\s+(of\s+)?(participants|patients|subjects)\s+(with|who)\s+/,
      "",
    )
    .replace(/^(time to|incidence of|frequency of)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}
