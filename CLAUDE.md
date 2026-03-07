# My-Allergy Project

알레르기 및 임상면역학 분야 상위 7개 저널 논문을 X(Twitter) 스타일 타임라인 피드로 보여주는 지식 포털.

## Stack

- **Framework**: Next.js 16 (App Router, TypeScript, src/)
- **Database**: Supabase (PostgreSQL, RLS)
- **APIs**: PubMed ESearch/EFetch + CrossRef (DOI enrichment)
- **Styling**: Tailwind CSS v4
- **Queue**: Inngest (per-journal parallel sync with retry)
- **Data fetching**: SWR (infinite scroll)
- **Testing**: Vitest

## Project Structure

```
src/
├── app/
│   ├── page.tsx               # 메인 타임라인 피드
│   ├── layout.tsx             # 루트 레이아웃
│   ├── paper/[pmid]/page.tsx  # 논문 상세 (ISR revalidate=3600)
│   └── api/
│       ├── papers/            # GET: 페이지네이션 + 필터 + FTS
│       ├── sync/              # POST: 수동 동기화 트리거
│       ├── cron/sync-papers/  # GET: 크론 (6h interval)
│       ├── inngest/           # Inngest serve handler
│       ├── health/            # DB 연결 상태 체크
│       └── insights/          # 인사이트 API
├── lib/
│   ├── constants/
│   │   ├── journals.ts        # 7개 저널 정의 (ISSN, IF, color)
│   │   └── topics.ts          # 알레르기 토픽 분류
│   ├── pubmed/                # PubMed ESearch/EFetch client + XML parser
│   ├── crossref/              # DOI 기반 citation count 보강
│   ├── inngest/               # client.ts, functions.ts (queue-based sync)
│   ├── sync/                  # orchestrator, fetcher, store, enricher
│   ├── supabase/              # client.ts (browser), server.ts (anon + service)
│   └── utils/                 # cn, date, text, url, retry, rate-limit, etc.
├── components/
│   ├── layout/                # header, sidebar, footer, mobile-drawer
│   ├── papers/                # paper-card, paper-feed, journal-badge, etc.
│   ├── maps/                  # author-world-map
│   └── ui/                    # badge, button, card, input, select, skeleton
├── hooks/                     # use-papers, use-paper-filters, use-debounce
└── types/                     # database.ts, filters.ts
supabase/
├── migrations/                # 00001~00007 (schema + search_vector)
└── seed.sql                   # 7개 저널 시드
```

## Key Architecture Decisions

- `createAnonClient()` for reads (RLS 준수), `createServiceClient()` for sync writes only
- PubMed XML 배치별 개별 파싱 (`efetchAndParse()`) — joined XML 금지
- Full-text search: `search_vector tsvector GENERATED ALWAYS AS STORED` 컬럼 사용
- 동시 sync 방지: `sync_logs` "running" 상태 체크 + 10분 stale guard
- Rate limiting: 슬라이딩 윈도우 60req/min on `/api/papers`
- External API retry: `withRetry()` 지수 백오프 + jitter

## Completed Features (모두 완료)

- ✅ PubMed + CrossRef 동기화 파이프라인
- ✅ 7개 저널 필터링 + 정렬 + 날짜 범위 + FTS (title + abstract)
- ✅ SWR infinite scroll 타임라인
- ✅ 논문 상세 페이지 (ISR)
- ✅ 다크모드 지원
- ✅ 보안 헤더 (CSP, HSTS)
- ✅ Rate limiting, API 캐시 헤더
- ✅ 32개 Vitest 테스트
- ✅ Health check endpoint
- ✅ Inngest 큐 기반 동기화 (저널별 병렬 + 개별 재시도)

## Pending Work (전략 개선)

### S-2: Supabase 타입 자동 생성 (최우선)
- `supabase gen types typescript --local > src/types/database.ts`
- `createClient<Database>()` 로 타입 안전성 확보
- `Record<string, unknown>` 캐스트 모두 제거

### S-4: GitHub Actions CI/CD
- `.github/workflows/ci.yml`
- Steps: lint → tsc → build → vitest
- 브랜치 보호 룰 설정

### S-3: 사용자 기능
- Phase 1: localStorage 북마크
- Phase 2: Supabase Auth + 서버 북마크
- Phase 3: 이메일 알림
- Phase 4: Trending 탭

## Environment

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
```

## Commands

```bash
npm run dev        # 개발 서버
npm run build      # 빌드
npm run test       # Vitest
npm run lint       # ESLint
```

## Important Notes

- Supabase migration 00001~00007 모두 실행 필요 (00006: search_vector 컬럼 추가)
- `seed.sql` 실행 후 `/api/sync` POST로 초기 동기화
- CrossRef enrichment는 sync 후 자동 실행 (`citation_count` 채워짐)
- 환경변수 없으면 빌드는 가능하나 런타임 에러 발생
