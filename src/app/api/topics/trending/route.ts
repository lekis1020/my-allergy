import { NextRequest, NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/server";
import { TRENDING_CATEGORIES } from "@/lib/constants/trending-categories";
import { decodeHtmlEntities } from "@/lib/utils/html-entities";

const GLOBAL_EXCLUDE = new Set([
  "humans", "male", "female", "adult", "child", "children",
  "adolescent", "infant", "aged", "middle aged", "young adult",
  "animals", "mice", "rats", "mouse", "rat",
  "prospective studies", "retrospective studies", "cohort studies",
  "cross-sectional studies", "randomized controlled trials",
  "treatment outcome", "risk factors", "prevalence", "incidence",
  "diagnosis", "therapy", "prognosis", "epidemiology",
  "review", "meta-analysis", "systematic review",
  "surveys and questionnaires", "follow-up studies",
  "case reports", "clinical trials", "double-blind method",
  "quality of life", "severity of illness index",
  "immunoglobulin e", "ige", "skin tests",
  "allergens", "immunotherapy", "inflammation", "cytokines",
  "biomarkers", "antibodies", "antigens", "phenotype",
  "genotype", "polymorphism", "mutation", "gene expression",
  "cell line", "cells", "serum", "blood", "plasma",
  "sensitivity and specificity", "predictive value of tests",
  "disease progression", "comorbidity", "age factors",
  "time factors", "dose-response relationship",
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

  const now = new Date();
  const sixMonthsAgo = new Date(
    now.getFullYear(),
    now.getMonth() - 6,
    now.getDate(),
  );
  const fromDate = sixMonthsAgo.toISOString().split("T")[0];

  const supabase = createAnonClient();

  const { data, error } = await supabase
    .from("papers")
    .select("keywords, mesh_terms")
    .not("abstract", "is", null)
    .neq("abstract", "")
    .textSearch("search_vector", category.searchQuery, { type: "websearch" })
    .gte("publication_date", fromDate)
    .order("publication_date", { ascending: false })
    .limit(500);

  if (error) {
    console.error("Trending topics query error:", error);
    return NextResponse.json(
      { error: "Failed to fetch trending topics" },
      { status: 500 },
    );
  }

  const excludeSet = new Set(
    category.excludeTerms.map((t) => t.toLowerCase()),
  );

  const keywordScores = new Map<string, { score: number; rawCount: number; source: "author" | "mesh" }>();

  for (const paper of data || []) {
    const rawKeywords = Array.isArray(paper.keywords)
      ? paper.keywords.filter((k): k is string => typeof k === "string")
      : [];
    const rawMesh = Array.isArray(paper.mesh_terms)
      ? paper.mesh_terms.filter((t): t is string => typeof t === "string")
      : [];

    const seen = new Set<string>();

    // Author keywords get 1.5x weight
    for (const raw of rawKeywords) {
      const kw = decodeHtmlEntities(raw).toLowerCase().trim();
      if (kw.length < 3 || excludeSet.has(kw) || GLOBAL_EXCLUDE.has(kw) || seen.has(kw)) continue;
      seen.add(kw);
      const existing = keywordScores.get(kw);
      if (existing) {
        existing.score += 1.5;
        existing.rawCount += 1;
      } else {
        keywordScores.set(kw, { score: 1.5, rawCount: 1, source: "author" });
      }
    }

    // MeSH terms get 1x weight
    for (const raw of rawMesh) {
      const kw = decodeHtmlEntities(raw).toLowerCase().trim();
      if (kw.length < 3 || excludeSet.has(kw) || GLOBAL_EXCLUDE.has(kw) || seen.has(kw)) continue;
      seen.add(kw);
      const existing = keywordScores.get(kw);
      if (existing) {
        existing.score += 1;
        existing.rawCount += 1;
      } else {
        keywordScores.set(kw, { score: 1, rawCount: 1, source: "mesh" });
      }
    }
  }

  // Apply word-count bonuses and single-word penalty
  const scored = [...keywordScores.entries()].map(([keyword, { score, rawCount }]) => {
    const wordCount = keyword.split(/\s+/).length;
    let finalScore = score;
    if (wordCount >= 3) finalScore += 5;
    else if (wordCount === 2) finalScore += 3;
    else finalScore *= 0.7; // single-word 30% penalty
    return { keyword, score: finalScore, rawCount, wordCount };
  });

  // Deduplicate similar keywords (60%+ word overlap)
  const deduped = deduplicateSimilar(scored);

  // Filter: single-word keywords need score >= 10
  const filtered = deduped.filter(
    (entry) => entry.wordCount >= 2 || entry.score >= 10,
  );

  // Sort by score descending, take top 8
  const trending = filtered
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ keyword, rawCount }) => ({
      keyword: capitalizePhrase(keyword),
      count: rawCount,
    }));

  const response = NextResponse.json({
    category: category.id,
    label: category.label,
    topics: trending,
    totalPapers: (data || []).length,
    period: { from: fromDate, to: now.toISOString().split("T")[0] },
  });

  response.headers.set(
    "Cache-Control",
    "public, s-maxage=3600, stale-while-revalidate=7200",
  );

  return response;
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
