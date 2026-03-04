# My Allergy

알레르기/임상면역학 저널 논문을 X(Twitter) 스타일 타임라인으로 모아보는 리서치 포털입니다.  
PubMed + CrossRef + Supabase를 기반으로 6시간마다 데이터를 동기화합니다.

## 소개

- 대상: 알레르기/면역학 주요 저널 23종
- 동기화 주기: 6시간 (`vercel.json` cron)
- 기본 동기화 범위: 최근 180일 (`CRON_SYNC_DAYS`)
- 피드 표시 조건: 초록(abstract)이 있는 논문만 노출
- 정렬: 기본 출간일 최신순, 인용순 정렬 지원

## 스크린샷

![My Allergy Timeline](docs/images/home-timeline.png)

## 주요 기능

- 타임라인 피드 + 무한 스크롤
- 저널 태그 필터 / 키워드 검색
- 주제 분류 태그 (Asthma, Rhinitis, Urticaria 등)
- 주제 모니터링(저장/즉시 적용)
- 논문 상세 페이지 (초록, 관련/참조/인용 링크)
- First Author Geography (세계지도 + 집계)
- 헬스체크 API (`/api/health`)

## 기술 스택

- Next.js 16 (App Router, TypeScript, React 19)
- Supabase (PostgreSQL + RLS)
- Tailwind CSS v4
- SWR
- PubMed E-utilities / CrossRef API
- Vitest

## 빠른 시작

### 1) 설치

```bash
npm install
```

### 2) 환경변수

`.env.example`을 참고해 `.env.local`을 작성합니다.

```bash
cp .env.example .env.local
```

### 3) Supabase 준비

```bash
brew install supabase/tap/supabase
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
supabase db push
```

시드 데이터는 다음 중 하나로 적용합니다.

- Supabase Dashboard → SQL Editor에서 `supabase/seed.sql` 실행
- 또는 Supabase CLI seed 설정이 되어 있다면 `supabase db seed`

### 4) 초기 동기화 (선택 권장)

개발 서버 실행 후 수동 동기화를 1회 호출합니다.

```bash
npm run dev
curl -X POST http://localhost:3000/api/sync \
  -H "Authorization: Bearer <CRON_SECRET>"
```

## 로컬 실행

```bash
npm run dev
```

- 앱: `http://localhost:3000`
- 헬스체크: `http://localhost:3000/api/health`

## 배포 방법 (Vercel)

### 1) Vercel 프로젝트 연결

이 저장소를 Vercel에 Import 합니다.

### 2) 환경변수 등록

Vercel Project Settings → Environment Variables에 아래 값 등록:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `CRON_SYNC_DAYS` (권장 `180`)
- `PUBMED_API_KEY` (선택, 있으면 PubMed rate limit 개선)
- `CROSSREF_EMAIL` (권장)

### 3) Cron 동기화

`vercel.json`에 아래 스케줄이 이미 포함되어 있습니다.

- `/api/cron/sync-papers`
- `0 */6 * * *` (6시간마다)

`CRON_SECRET`이 설정되어 있으면 cron 요청 인증이 적용됩니다.

### 4) 배포 후 점검

- `GET /api/health`가 `status: ok`인지 확인
- 필요 시 수동 동기화 1회 실행:

```bash
curl -X POST https://<your-domain>/api/sync \
  -H "Authorization: Bearer <CRON_SECRET>"
```

## 테스트

```bash
npm run test
npx tsc --noEmit
```

## 프로젝트 구조

```text
src/
  app/
    api/
      papers/
      sync/
      cron/sync-papers/
      insights/author-geography/
      health/
    paper/[pmid]/
  components/
  hooks/
  lib/
    pubmed/
    crossref/
    sync/
    supabase/
    utils/
  types/
supabase/
  migrations/
  seed.sql
```
