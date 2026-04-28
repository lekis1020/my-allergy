# AdSense 정책 준수를 위한 콘텐츠 강화 설계

## 배경

Google AdSense 신청이 두 가지 사유로 거절됨:
1. **Replicated Content** — PubMed에서 가져온 논문 데이터가 복제 콘텐츠로 판단
2. **Low Value Content** — 고유 콘텐츠 부족

## 목표

- 부가가치 콘텐츠(AI 요약, 소셜 인터랙션, 트렌드 분석)를 추가하여 고유 콘텐츠 비율 향상
- 복제 콘텐츠 비율이 높은 타임라인 피드의 광고 빈도 축소
- 모든 부가가치 콘텐츠는 SSR로 렌더링하여 크롤러 접근 가능

---

## 설계 1: 광고 빈도 조정

### 변경 사항

- `paper-feed.tsx`의 `AD_INTERVAL` 상수: 5 → 12
- 우측 사이드바(`right-rail.tsx`) 광고: 유지

### 파일

| 파일 | 변경 |
|------|------|
| `src/components/papers/paper-feed.tsx` | `AD_INTERVAL = 12` |

---

## 설계 2: AI 한줄 요약 + 소셜 인터랙션

### 2-1. AI 한줄 요약

#### DB 스키마

- `papers` 테이블에 `ai_summary` 컬럼 추가 (text, nullable)
- Supabase migration 파일 추가

#### 생성 흐름

1. Inngest 논문 동기화 함수에서 신규 논문 insert 후 Gemini 호출
2. 프롬프트: abstract 입력 → 한국어 2~3문장 핵심 요약 생성
3. 결과를 `papers.ai_summary`에 저장
4. Gemini 호출 실패 시 null로 두고 스킵 (동기화 자체는 실패하지 않음)

#### 기존 논문 백필

- `ai_summary`가 null인 논문에 대해 일괄 생성하는 백필 API 제공
- `/api/sync/backfill-summaries` POST 엔드포인트
- 배치 처리 (한 번에 50건, rate limit 준수)

#### 노출

**타임라인 피드 카드** (`paper-card.tsx`):
- 저자 아래, Show abstract 위에 1줄 truncate 표시
- 회색 텍스트, "AI:" 접두어
- null이면 미노출

**논문 상세 페이지** (`paper/[pmid]/page.tsx`):
- Abstract 위에 "AI 핵심 요약" 섹션으로 SSR 렌더링
- 크롤러가 읽을 수 있는 정적 HTML

#### Gemini 프롬프트

```
다음 의학 논문의 초록을 읽고, 알레르기/면역학 전문의를 위한 핵심 요약을
한국어 2~3문장으로 작성하세요. 연구의 주요 발견과 임상적 의의에 초점을 맞추세요.

초록:
{abstract}
```

### 2-2. 소셜 인터랙션

#### 타임라인 피드 카드 레이아웃 변경

기존:
```
[저널] · 2 days ago
논문 제목
저자들
Show abstract
[토픽태그]  PubMed  DOI  🔖
```

변경 후:
```
[저널] · 2 days ago
논문 제목
저자들
AI: 이 연구는 알레르기 피부질환의 글로벌 질병부담을...
Show abstract
[토픽태그]
🔖 3  👍 5  💬 2
```

- PubMed/DOI 링크는 카드에서 제거 (논문 상세에서만 접근)

#### DB 스키마 (신규 테이블)

```sql
CREATE TABLE paper_likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  paper_pmid text REFERENCES papers(pmid) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, paper_pmid)
);

ALTER TABLE paper_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own likes"
  ON paper_likes FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read like counts"
  ON paper_likes FOR SELECT
  USING (true);
```

#### 인터랙션 동작

| 기능 | DB | 비로그인 | 로그인 |
|------|-----|---------|--------|
| 🔖 북마크 | 기존 `bookmarks` 테이블 | 카운트만 표시 | 토글 + 카운트 |
| 👍 추천 | 신규 `paper_likes` 테이블 | 카운트만 표시 | 토글 + 카운트 |
| 💬 댓글 | 기존 `comments` 카운트 조회 | 카운트만 표시 | 클릭 시 상세 페이지 이동 |

#### API

- `GET /api/papers?...` 응답에 `like_count`, `comment_count`, `bookmark_count` 포함
- `POST /api/papers/[pmid]/like` — 토글 (insert/delete)
- 기존 bookmark API 활용

#### 컴포넌트

- `paper-actions.tsx` 수정: PubMed/DOI 제거, 🔖👍💬 토글 버튼 + 카운트 표시
- `use-paper-like.ts` 훅 신규 생성

---

## 설계 3: Trending/Insights 콘텐츠 강화

### Trending 페이지

#### AI 트렌드 분석 요약

- 페이지 상단에 2~3문단 AI 생성 트렌드 분석 표시
- "이번 달 알레르기/면역학 연구 동향" 형태
- SSR 렌더링 (크롤러 접근 가능)

#### 통계 기반 텍스트

- 하단에 자동 생성 통계 문장 블록
- "지난 6개월간 가장 많이 인용된 토픽: Asthma(18건), Atopic Dermatitis(17건)"

#### DB 스키마 (신규 테이블)

```sql
CREATE TABLE trending_analysis (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL UNIQUE,
  ai_summary text NOT NULL,
  stats_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL
);
```

#### 생성/갱신

- Inngest cron job (1일 1회)
- 입력: 최근 30일 논문 통계 + 토픽 분포
- Gemini에 트렌드 분석 요청 → `trending_analysis` 저장
- `stats_json`: 토픽별 논문 수, 전월 대비 변화율 등 구조화 데이터

#### Gemini 프롬프트

```
다음은 알레르기/임상면역학 분야 최근 30일간 논문 통계입니다:
{stats}

이 데이터를 바탕으로 한국어로 2~3문단의 연구 동향 분석을 작성하세요.
주요 토픽별 연구 동향, 주목할 만한 변화, 새로운 연구 방향을 포함하세요.
```

### Insights 페이지

- 기존 저자 지리/리더보드 위에 통계 요약 텍스트 추가
- DB 조회 기반 자동 생성 (AI 미사용): "현재 DB에 {total}편의 논문, {journal_count}개 저널..."
- SSR 렌더링

---

## 파일 변경 목록

### 신규 파일

| 파일 | 용도 |
|------|------|
| `supabase/migrations/00008_add_ai_summary.sql` | ai_summary 컬럼 |
| `supabase/migrations/00009_paper_likes.sql` | paper_likes 테이블 |
| `supabase/migrations/00010_trending_analysis.sql` | trending_analysis 테이블 |
| `src/hooks/use-paper-like.ts` | 추천 토글 훅 |
| `src/lib/gemini/summarize.ts` | AI 요약 생성 함수 |
| `src/app/api/papers/[pmid]/like/route.ts` | 추천 API |
| `src/app/api/sync/backfill-summaries/route.ts` | 기존 논문 요약 백필 |

### 수정 파일

| 파일 | 변경 |
|------|------|
| `src/components/papers/paper-feed.tsx` | AD_INTERVAL 5→12 |
| `src/components/papers/paper-card.tsx` | AI 요약 표시, PubMed/DOI 제거 |
| `src/components/papers/paper-actions.tsx` | 🔖👍💬 토글 + 카운트 |
| `src/app/paper/[pmid]/page.tsx` | AI 핵심 요약 SSR 섹션 |
| `src/app/trending/page.tsx` | 트렌드 분석 섹션 추가 |
| `src/components/insights/insights-view.tsx` | 통계 요약 텍스트 |
| `src/lib/inngest/functions.ts` | 동기화 시 AI 요약 생성 + 트렌드 분석 cron |
| `src/app/api/papers/route.ts` | 응답에 like/comment/bookmark 카운트 추가 |

---

## 기술 결정 사항

- **AI 모델**: Gemini 2.5 Flash (기존 chat과 동일)
- **요약 생성 비용**: 논문당 ~1 API 호출 (abstract → 2~3문장, 저비용)
- **트렌드 분석 비용**: 1일 1회 호출
- **캐싱**: ai_summary는 DB 영구 저장, trending_analysis는 일 1회 갱신
- **에러 처리**: AI 생성 실패 시 null, 동기화/페이지 렌더링에 영향 없음
