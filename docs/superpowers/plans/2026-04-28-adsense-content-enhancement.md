# AdSense 콘텐츠 강화 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AdSense 정책 준수를 위해 광고 빈도를 줄이고, AI 한줄 요약·소셜 인터랙션·트렌드 분석 등 고유 콘텐츠를 추가한다.

**Architecture:** Gemini 2.5 Flash로 논문 요약과 트렌드 분석을 생성하여 DB에 저장하고 SSR로 렌더링한다. 소셜 인터랙션(추천)은 신규 테이블로 구현하며, 기존 북마크·댓글 카운트와 함께 피드 카드에 표시한다.

**Tech Stack:** Next.js 16 (App Router), Supabase (PostgreSQL + RLS), Inngest (queue), Gemini 2.5 Flash, SWR, Tailwind CSS v4

---

## 파일 구조

### 신규 파일

| 파일 | 용도 |
|------|------|
| `supabase/migrations/00029_add_ai_summary.sql` | papers.ai_summary 컬럼 |
| `supabase/migrations/00030_paper_likes.sql` | paper_likes 테이블 + RLS |
| `supabase/migrations/00031_trending_analysis.sql` | trending_analysis 테이블 |
| `src/lib/gemini/summarize.ts` | AI 요약 생성 함수 |
| `src/hooks/use-paper-like.ts` | 추천 토글 훅 |
| `src/app/api/papers/[pmid]/like/route.ts` | 추천 API |
| `src/app/api/sync/backfill-summaries/route.ts` | 기존 논문 요약 백필 |

### 수정 파일

| 파일 | 변경 |
|------|------|
| `src/components/papers/paper-feed.tsx` | AD_INTERVAL 5→12 |
| `src/types/filters.ts` | PaperWithJournal에 ai_summary, like_count 추가 |
| `src/app/api/papers/route.ts` | 응답에 like_count, bookmark_count 포함 |
| `src/components/papers/paper-card.tsx` | AI 요약 표시, PubMed/DOI 제거, 소셜 버튼 |
| `src/app/paper/[pmid]/page.tsx` | AI 핵심 요약 SSR 섹션 |
| `src/lib/inngest/functions.ts` | 동기화 시 AI 요약 생성 + 트렌드 cron |
| `src/app/trending/page.tsx` | 트렌드 분석 섹션 추가 |
| `src/components/insights/insights-view.tsx` | 통계 요약 텍스트 |

---

### Task 1: 광고 빈도 조정

**Files:**
- Modify: `src/components/papers/paper-feed.tsx:13`

- [ ] **Step 1: AD_INTERVAL 상수 변경**

`src/components/papers/paper-feed.tsx` 13행:

```typescript
// 변경 전
const AD_INTERVAL = 5;

// 변경 후
const AD_INTERVAL = 12;
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/components/papers/paper-feed.tsx
git commit -m "chore: 타임라인 광고 빈도 축소 (5→12개 간격)"
```

---

### Task 2: DB 마이그레이션 — ai_summary 컬럼

**Files:**
- Create: `supabase/migrations/00029_add_ai_summary.sql`

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- 00029_add_ai_summary.sql
ALTER TABLE papers ADD COLUMN IF NOT EXISTS ai_summary text;

COMMENT ON COLUMN papers.ai_summary IS 'AI-generated 2-3 sentence summary in Korean, created by Gemini from abstract';
```

- [ ] **Step 2: 로컬 DB 적용**

Run: `npx supabase db push` 또는 Supabase 대시보드에서 SQL 실행
Expected: 컬럼 추가 성공

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/00029_add_ai_summary.sql
git commit -m "feat: papers 테이블에 ai_summary 컬럼 추가"
```

---

### Task 3: DB 마이그레이션 — paper_likes 테이블

**Files:**
- Create: `supabase/migrations/00030_paper_likes.sql`

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- 00030_paper_likes.sql
CREATE TABLE paper_likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  paper_pmid text REFERENCES papers(pmid) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, paper_pmid)
);

ALTER TABLE paper_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read likes"
  ON paper_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own likes"
  ON paper_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes"
  ON paper_likes FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_paper_likes_pmid ON paper_likes(paper_pmid);
CREATE INDEX idx_paper_likes_user ON paper_likes(user_id);
```

- [ ] **Step 2: 로컬 DB 적용**

Run: `npx supabase db push` 또는 Supabase 대시보드에서 SQL 실행
Expected: 테이블 생성 성공

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/00030_paper_likes.sql
git commit -m "feat: paper_likes 테이블 추가 (추천 기능)"
```

---

### Task 4: DB 마이그레이션 — trending_analysis 테이블

**Files:**
- Create: `supabase/migrations/00031_trending_analysis.sql`

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- 00031_trending_analysis.sql
CREATE TABLE trending_analysis (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL UNIQUE,
  ai_summary text NOT NULL,
  stats_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE trending_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read trending analysis"
  ON trending_analysis FOR SELECT
  USING (true);
```

- [ ] **Step 2: 로컬 DB 적용**

Run: `npx supabase db push` 또는 Supabase 대시보드에서 SQL 실행
Expected: 테이블 생성 성공

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/00031_trending_analysis.sql
git commit -m "feat: trending_analysis 테이블 추가 (트렌드 분석)"
```

---

### Task 5: AI 요약 생성 함수

**Files:**
- Create: `src/lib/gemini/summarize.ts`

- [ ] **Step 1: summarize 함수 작성**

```typescript
// src/lib/gemini/summarize.ts
import { getGeminiClient } from "@/lib/gemini/client";

const SUMMARY_PROMPT = `다음 의학 논문의 초록을 읽고, 알레르기/면역학 전문의를 위한 핵심 요약을 한국어 2~3문장으로 작성하세요.
연구의 주요 발견과 임상적 의의에 초점을 맞추세요. 마크다운 서식 없이 일반 텍스트로 작성하세요.

초록:
`;

export async function generatePaperSummary(
  abstract: string | null
): Promise<string | null> {
  if (!abstract || abstract.length < 50) return null;

  try {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: SUMMARY_PROMPT + abstract }] }],
    });

    const text = result.response.text()?.trim();
    return text || null;
  } catch (error) {
    console.error("[Summarize] Failed to generate summary:", error);
    return null;
  }
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/lib/gemini/summarize.ts
git commit -m "feat: Gemini 기반 논문 AI 요약 생성 함수"
```

---

### Task 6: PaperWithJournal 타입 확장

**Files:**
- Modify: `src/types/filters.ts:63-85`

- [ ] **Step 1: 타입에 ai_summary, like_count 추가**

`src/types/filters.ts`의 `PaperWithJournal` 인터페이스 끝에 추가:

```typescript
// 기존 필드 아래에 추가
  ai_summary?: string | null;
  like_count?: number;
  bookmark_count?: number;
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/types/filters.ts
git commit -m "feat: PaperWithJournal에 ai_summary, like_count, bookmark_count 추가"
```

---

### Task 7: Papers API 응답에 카운트 추가

**Files:**
- Modify: `src/app/api/papers/route.ts`

- [ ] **Step 1: select 쿼리에 ai_summary 추가**

기존 papers select 쿼리(약 55-63행)에 `ai_summary` 필드 추가.

- [ ] **Step 2: toPaperDto 변환에 카운트 쿼리 추가**

Papers 응답을 반환하기 전에, 해당 PMID 목록에 대한 like_count와 bookmark_count를 일괄 조회:

```typescript
// papers 조회 후, pmid 목록 추출
const pmids = papers.map((p) => p.pmid);

// like 카운트 일괄 조회
const { data: likeCounts } = await supabase
  .from("paper_likes")
  .select("paper_pmid")
  .in("paper_pmid", pmids);

const likeMap = new Map<string, number>();
for (const row of likeCounts ?? []) {
  likeMap.set(row.paper_pmid, (likeMap.get(row.paper_pmid) ?? 0) + 1);
}

// bookmark 카운트 일괄 조회
const { data: bookmarkCounts } = await supabase
  .from("bookmarks")
  .select("paper_pmid")
  .in("paper_pmid", pmids);

const bookmarkMap = new Map<string, number>();
for (const row of bookmarkCounts ?? []) {
  bookmarkMap.set(row.paper_pmid, (bookmarkMap.get(row.paper_pmid) ?? 0) + 1);
}
```

- [ ] **Step 3: DTO에 카운트 매핑**

`toPaperDto` 결과에 카운트를 병합:

```typescript
const enrichedPapers = papers.map((p) => ({
  ...toPaperDto(p),
  ai_summary: p.ai_summary ?? null,
  like_count: likeMap.get(p.pmid) ?? 0,
  bookmark_count: bookmarkMap.get(p.pmid) ?? 0,
}));
```

- [ ] **Step 4: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/papers/route.ts
git commit -m "feat: papers API 응답에 ai_summary, like_count, bookmark_count 추가"
```

---

### Task 8: 추천(Like) API

**Files:**
- Create: `src/app/api/papers/[pmid]/like/route.ts`

- [ ] **Step 1: 토글 API 작성**

```typescript
// src/app/api/papers/[pmid]/like/route.ts
import { createServerAuthClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ pmid: string }> }
) {
  const { pmid } = await params;
  const supabase = await createServerAuthClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if already liked
  const { data: existing } = await supabase
    .from("paper_likes")
    .select("id")
    .eq("user_id", user.id)
    .eq("paper_pmid", pmid)
    .maybeSingle();

  if (existing) {
    // Unlike
    await supabase.from("paper_likes").delete().eq("id", existing.id);
    return NextResponse.json({ liked: false });
  }

  // Like
  await supabase.from("paper_likes").insert({
    user_id: user.id,
    paper_pmid: pmid,
  });

  return NextResponse.json({ liked: true });
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/app/api/papers/[pmid]/like/route.ts
git commit -m "feat: 논문 추천(like) 토글 API"
```

---

### Task 9: use-paper-like 훅

**Files:**
- Create: `src/hooks/use-paper-like.ts`

- [ ] **Step 1: 훅 작성**

```typescript
// src/hooks/use-paper-like.ts
"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";

export function usePaperLike(pmid: string, initialCount: number) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(async () => {
    if (!user || loading) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/papers/${pmid}/like`, { method: "POST" });
      if (!res.ok) return;

      const data = await res.json();
      setLiked(data.liked);
      setCount((prev) => (data.liked ? prev + 1 : Math.max(0, prev - 1)));
    } finally {
      setLoading(false);
    }
  }, [pmid, user, loading]);

  return { liked, count, toggle, loading };
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/hooks/use-paper-like.ts
git commit -m "feat: usePaperLike 훅 (추천 토글 + 카운트)"
```

---

### Task 10: 피드 카드 UI 변경

**Files:**
- Modify: `src/components/papers/paper-card.tsx`

- [ ] **Step 1: AI 요약 표시 추가**

저자 섹션(`PaperAuthors`) 아래, abstract 토글 위에 AI 요약 추가:

```tsx
{/* AI Summary */}
{paper.ai_summary && (
  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
    <span className="font-semibold text-blue-500 dark:text-blue-400">AI:</span>{" "}
    {paper.ai_summary}
  </p>
)}
```

- [ ] **Step 2: PubMed/DOI 링크 제거**

기존 actions 영역에서 PubMed, DOI 외부 링크를 제거한다. 논문 상세 페이지에서만 접근 가능.

- [ ] **Step 3: 소셜 버튼 (🔖👍💬) 추가**

기존 `BookmarkButton` 위치를 소셜 버튼 그룹으로 교체:

```tsx
{/* Social Actions */}
<div className="flex items-center gap-4 pt-2 text-xs text-gray-400 dark:text-gray-500">
  <BookmarkButton pmid={paper.pmid} compact count={paper.bookmark_count ?? 0} />
  <LikeButton pmid={paper.pmid} count={paper.like_count ?? 0} />
  <Link
    href={`/paper/${paper.pmid}#comments`}
    className="flex items-center gap-1 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
  >
    <MessageCircle className="h-4 w-4" />
    <span>{paper.comment_count ?? 0}</span>
  </Link>
</div>
```

`LikeButton`은 인라인 컴포넌트로 `usePaperLike` 훅 사용:

```tsx
function LikeButton({ pmid, count }: { pmid: string; count: number }) {
  const { liked, count: likeCount, toggle } = usePaperLike(pmid, count);

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-1 transition-colors ${
        liked
          ? "text-blue-500 dark:text-blue-400"
          : "hover:text-gray-600 dark:hover:text-gray-300"
      }`}
    >
      <ThumbsUp className="h-4 w-4" />
      <span>{likeCount}</span>
    </button>
  );
}
```

- [ ] **Step 4: 기존 BookmarkButton에 compact + count prop 추가**

`BookmarkButton` 컴포넌트를 수정하여 `compact` 모드(아이콘+카운트만)와 `count` prop을 지원하도록 한다.

- [ ] **Step 5: 타입 체크 및 dev 서버 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add src/components/papers/paper-card.tsx src/components/papers/bookmark-button.tsx
git commit -m "feat: 피드 카드에 AI 요약·소셜 버튼 추가, PubMed/DOI 제거"
```

---

### Task 11: 논문 상세 페이지 AI 핵심 요약 SSR

**Files:**
- Modify: `src/app/paper/[pmid]/page.tsx`

- [ ] **Step 1: AI 요약 섹션 추가**

Abstract 섹션 위에 SSR로 AI 요약을 렌더링:

```tsx
{/* AI 핵심 요약 - SSR for crawlers */}
{paper.ai_summary && (
  <section className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
    <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
      <Sparkles className="h-4 w-4 text-blue-500" />
      AI 핵심 요약
    </h2>
    <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
      {paper.ai_summary}
    </p>
  </section>
)}
```

- [ ] **Step 2: select 쿼리에 ai_summary 추가**

기존 papers select에 `ai_summary` 필드가 포함되어야 한다 (이미 `*` 로 전체 조회 중이면 자동 포함).

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add src/app/paper/[pmid]/page.tsx
git commit -m "feat: 논문 상세 페이지에 AI 핵심 요약 SSR 섹션 추가"
```

---

### Task 12: Inngest 동기화에 AI 요약 생성 단계 추가

**Files:**
- Modify: `src/lib/inngest/functions.ts`

- [ ] **Step 1: summarize import 추가**

```typescript
import { generatePaperSummary } from "@/lib/gemini/summarize";
```

- [ ] **Step 2: syncJournalFn에 요약 생성 step 추가**

`enrichPapersWithCrossRef` step 이후에 새 step 추가:

```typescript
// Generate AI summaries for newly inserted papers
const summarized = await step.run("generate-ai-summaries", async () => {
  const serviceClient = createServiceClient();
  const { data: unsummarized } = await serviceClient
    .from("papers")
    .select("pmid, abstract")
    .eq("journal_id", journalId)
    .is("ai_summary", null)
    .not("abstract", "is", null)
    .order("publication_date", { ascending: false })
    .limit(20);

  let count = 0;
  for (const paper of unsummarized ?? []) {
    const summary = await generatePaperSummary(paper.abstract);
    if (summary) {
      await serviceClient
        .from("papers")
        .update({ ai_summary: summary })
        .eq("pmid", paper.pmid);
      count++;
    }
  }
  return count;
});
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add src/lib/inngest/functions.ts
git commit -m "feat: 논문 동기화 시 AI 요약 자동 생성"
```

---

### Task 13: 요약 백필 API

**Files:**
- Create: `src/app/api/sync/backfill-summaries/route.ts`

- [ ] **Step 1: 백필 API 작성**

```typescript
// src/app/api/sync/backfill-summaries/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generatePaperSummary } from "@/lib/gemini/summarize";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { limit = 50 } = await req.json().catch(() => ({}));
  const supabase = createServiceClient();

  const { data: papers } = await supabase
    .from("papers")
    .select("pmid, abstract")
    .is("ai_summary", null)
    .not("abstract", "is", null)
    .order("publication_date", { ascending: false })
    .limit(Math.min(limit, 100));

  let generated = 0;
  for (const paper of papers ?? []) {
    const summary = await generatePaperSummary(paper.abstract);
    if (summary) {
      await supabase
        .from("papers")
        .update({ ai_summary: summary })
        .eq("pmid", paper.pmid);
      generated++;
    }
    // Rate limit: ~1 req/sec
    await new Promise((r) => setTimeout(r, 1000));
  }

  return NextResponse.json({
    total: papers?.length ?? 0,
    generated,
    remaining: (papers?.length ?? 0) - generated,
  });
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/app/api/sync/backfill-summaries/route.ts
git commit -m "feat: 기존 논문 AI 요약 백필 API"
```

---

### Task 14: Trending 페이지 — 트렌드 분석 섹션

**Files:**
- Modify: `src/app/trending/page.tsx`

- [ ] **Step 1: trending_analysis 테이블에서 최신 분석 조회**

```typescript
// fetchTrendingPapers 함수 옆에 추가
async function fetchTrendingAnalysis() {
  const supabase = createAnonClient();
  const { data } = await supabase
    .from("trending_analysis")
    .select("ai_summary, stats_json, date")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}
```

- [ ] **Step 2: 페이지 컴포넌트에 분석 섹션 추가**

`TrendingPage` 에서 `fetchTrendingAnalysis()`를 `fetchTrendingPapers()`와 병렬 호출:

```typescript
const [papers, analysis] = await Promise.all([
  fetchTrendingPapers(),
  fetchTrendingAnalysis(),
]);
```

TrendingFeed 위에 분석 섹션 SSR 렌더링:

```tsx
{analysis && (
  <div className="border-b border-gray-200 px-4 py-5 dark:border-gray-800">
    <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-gray-900 dark:text-gray-100">
      <BarChart3 className="h-5 w-5 text-blue-500" />
      이번 달 연구 동향
    </h2>
    <div className="whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-gray-300">
      {analysis.ai_summary}
    </div>
    {analysis.stats_json?.topTopics && (
      <div className="mt-4 flex flex-wrap gap-2">
        {analysis.stats_json.topTopics.map((t: { name: string; count: number }) => (
          <span key={t.name} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
            {t.name} · {t.count}편
          </span>
        ))}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add src/app/trending/page.tsx
git commit -m "feat: Trending 페이지에 AI 트렌드 분석 섹션 추가"
```

---

### Task 15: Inngest 트렌드 분석 cron job

**Files:**
- Modify: `src/lib/inngest/functions.ts`

- [ ] **Step 1: 트렌드 분석 생성 함수 추가**

```typescript
export const generateTrendingAnalysisFn = inngest.createFunction(
  { id: "generate-trending-analysis", retries: 2 },
  { cron: "0 6 * * *" }, // 매일 오전 6시 (KST 15시)
  async ({ step }) => {
    const stats = await step.run("collect-stats", async () => {
      const supabase = createServiceClient();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: papers } = await supabase
        .from("papers")
        .select("topic_tags, publication_date")
        .gte("publication_date", thirtyDaysAgo.toISOString().split("T")[0]);

      // Count by topic
      const topicCounts = new Map<string, number>();
      for (const p of papers ?? []) {
        for (const tag of (p.topic_tags as string[]) ?? []) {
          topicCounts.set(tag, (topicCounts.get(tag) ?? 0) + 1);
        }
      }

      const topTopics = Array.from(topicCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return { totalPapers: papers?.length ?? 0, topTopics };
    });

    const aiSummary = await step.run("generate-analysis", async () => {
      const { getGeminiClient } = await import("@/lib/gemini/client");
      const client = getGeminiClient();
      const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `다음은 알레르기/임상면역학 분야 최근 30일간 논문 통계입니다:

총 논문 수: ${stats.totalPapers}편
토픽별 분포: ${stats.topTopics.map((t) => `${t.name}(${t.count}편)`).join(", ")}

이 데이터를 바탕으로 한국어로 2~3문단의 연구 동향 분석을 작성하세요.
주요 토픽별 연구 동향, 주목할 만한 변화, 새로운 연구 방향을 포함하세요.
마크다운 서식 없이 일반 텍스트로 작성하세요.`;

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      return result.response.text()?.trim() ?? "";
    });

    await step.run("save-analysis", async () => {
      const supabase = createServiceClient();
      const today = new Date().toISOString().split("T")[0];

      await supabase.from("trending_analysis").upsert(
        { date: today, ai_summary: aiSummary, stats_json: stats },
        { onConflict: "date" }
      );
    });

    return { date: new Date().toISOString().split("T")[0], stats };
  }
);
```

- [ ] **Step 2: Inngest serve에 함수 등록**

`src/app/api/inngest/route.ts`에서 `generateTrendingAnalysisFn`을 export 목록에 추가.

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add src/lib/inngest/functions.ts src/app/api/inngest/route.ts
git commit -m "feat: 일일 트렌드 분석 Inngest cron job 추가"
```

---

### Task 16: Insights 페이지 통계 요약 텍스트

**Files:**
- Modify: `src/components/insights/insights-view.tsx`

- [ ] **Step 1: 통계 요약 텍스트 추가**

기존 geography 섹션 위에 통계 요약 블록을 추가. API 응답 데이터를 활용하여 자동 생성:

```tsx
{/* Stats Summary */}
{geoData && (
  <div className="mb-6 rounded-xl bg-blue-50/50 p-4 dark:bg-blue-950/20">
    <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
      최근 6개월간 <strong>{geoData.total_papers.toLocaleString()}편</strong>의 논문이 등록되었으며,
      {" "}<strong>{geoData.total_authors.toLocaleString()}명</strong>의 저자가 참여했습니다.
      가장 많은 연구가 이루어진 지역은{" "}
      <strong>{geoData.locations?.[0]?.country}</strong>
      ({geoData.locations?.[0]?.count}편)이며,{" "}
      <strong>{geoData.locations?.[1]?.country}</strong>,{" "}
      <strong>{geoData.locations?.[2]?.country}</strong> 순으로 이어집니다.
    </p>
  </div>
)}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/components/insights/insights-view.tsx
git commit -m "feat: Insights 페이지에 통계 요약 텍스트 추가"
```

---

### Task 17: 빌드 검증 및 최종 커밋

**Files:** 전체

- [ ] **Step 1: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 2: 빌드**

Run: `npm run build`
Expected: 빌드 성공

- [ ] **Step 3: dev 서버에서 기능 확인**

- 홈 피드: AI 요약 표시, 소셜 버튼 정상, 광고 12개 간격
- 논문 상세: AI 핵심 요약 SSR 표시
- Trending: 트렌드 분석 섹션 (DB에 데이터 있을 때)
- Insights: 통계 요약 텍스트

- [ ] **Step 4: 최종 커밋 (필요 시)**

```bash
git add -A
git commit -m "chore: 빌드 수정 및 최종 점검"
```
