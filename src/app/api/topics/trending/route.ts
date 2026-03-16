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
    .limit(300);

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

  const keywordCounts = new Map<string, number>();

  for (const paper of data || []) {
    const rawKeywords = Array.isArray(paper.keywords)
      ? paper.keywords.filter((k): k is string => typeof k === "string")
      : [];
    const rawMesh = Array.isArray(paper.mesh_terms)
      ? paper.mesh_terms.filter((t): t is string => typeof t === "string")
      : [];

    const allTerms = [
      ...rawKeywords.map((k) => decodeHtmlEntities(k)),
      ...rawMesh.map((t) => decodeHtmlEntities(t)),
    ];

    const seen = new Set<string>();
    for (const raw of allTerms) {
      const kw = raw.toLowerCase().trim();
      if (kw.length < 3) continue;
      if (excludeSet.has(kw)) continue;
      if (GLOBAL_EXCLUDE.has(kw)) continue;
      if (seen.has(kw)) continue;
      seen.add(kw);
      keywordCounts.set(kw, (keywordCounts.get(kw) || 0) + 1);
    }
  }

  const trending = [...keywordCounts.entries()]
    .map(([keyword, count]) => ({
      keyword,
      count,
      wordCount: keyword.split(/\s+/).length,
    }))
    .sort((a, b) => {
      const scoreA = a.count + (a.wordCount >= 2 ? 2 : 0);
      const scoreB = b.count + (b.wordCount >= 2 ? 2 : 0);
      return scoreB - scoreA;
    })
    .slice(0, 5)
    .map(({ keyword, count }) => ({
      keyword: capitalizePhrase(keyword),
      count,
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

function capitalizePhrase(phrase: string): string {
  return phrase
    .split(" ")
    .map((word, i) => {
      if (i > 0 && LOWERCASE_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}
