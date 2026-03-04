# My-Allergy Handoff Document

## 프로젝트 개요
알레르기/임상면역학 분야 상위 7개 저널 논문을 X(Twitter) 스타일 타임라인 피드로 보여주는 지식 포털.

- **Stack**: Next.js 16 (App Router, TypeScript), Supabase (PostgreSQL), PubMed + CrossRef API, Tailwind CSS v4, SWR
- **위치**: `/Volumes/LaCie/Development Projects/my-allergy/my-allergy`

## 완료된 작업

### Phase 1-9: 전체 기능 구현 완료
- Next.js 16 프로젝트 초기화, Supabase DB 설계 (5개 마이그레이션 + 시드)
- PubMed ESearch/EFetch + XML 파서, CrossRef citation 보강
- 동기화 파이프라인 (orchestrator, fetcher, store, enricher)
- 프론트엔드 (2단 레이아웃, 사이드바 필터, 무한스크롤 피드, 논문 상세 ISR)
- 보안 헤더, 캐시 헤더, 입력 검증

### Medium Effort 개선 (M-1 ~ M-6) 전부 완료
| 항목 | 내용 | 변경 파일 |
|------|------|-----------|
| M-1 | Store 배치 upsert (N+1 제거) | `src/lib/sync/store.ts` |
| M-2 | 외부 API 재시도 (지수 백오프+jitter) | `src/lib/utils/retry.ts`, `src/lib/pubmed/client.ts`, `src/lib/crossref/client.ts` |
| M-3 | Stored tsvector 가중치 검색 | `supabase/migrations/00006_add_search_vector.sql`, `src/app/api/papers/route.ts` |
| M-4 | API 레이트 리밋 (60req/min) | `src/lib/utils/rate-limit.ts`, `src/app/api/papers/route.ts` |
| M-5 | Vitest 테스트 스위트 (32 tests) | `vitest.config.ts`, `src/lib/pubmed/__tests__/parser.test.ts`, `src/lib/utils/__tests__/retry.test.ts` |
| M-6 | Health check 엔드포인트 | `src/app/api/health/route.ts` |

### 검증 상태
- `next build` 성공 (TypeScript 에러 없음)
- `npx vitest run` — 32/32 tests passed
- 모든 라우트: ○ / (Static), ƒ /api/* + /paper/[pmid] (Dynamic)

## 즉시 해야 할 작업 (현재 블로커)

### 1. Supabase 프로젝트 생성 + 연결
`.env.local`에 실제 값이 없어서 API가 500 에러를 반환하고 있음.

```bash
# Supabase CLI 설치
brew install supabase/tap/supabase

# 로그인
supabase login

# 프로젝트 초기화 (이미 supabase/ 디렉토리 있음)
supabase init  # 이미 되어있으면 스킵

# Supabase 대시보드에서 새 프로젝트 생성 후 link
supabase link --project-ref <PROJECT_REF>

# 마이그레이션 적용 (6개)
supabase db push

# 시드 데이터 적용
supabase db seed
```

### 2. .env.local 업데이트
Supabase 대시보드 > Settings > API에서 값 복사:
```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
CRON_SECRET=<임의의 시크릿 문자열>
```

### 3. 초기 동기화 실행
```bash
# dev 서버 실행 후
curl -X POST http://localhost:3000/api/sync \
  -H "Authorization: Bearer <CRON_SECRET>"
```

## 프로젝트 구조
```
src/
├── app/
│   ├── api/
│   │   ├── papers/          # GET /api/papers (피드) + /api/papers/[pmid] (상세)
│   │   ├── health/          # GET /api/health (헬스체크)
│   │   ├── sync/            # POST /api/sync (수동 동기화)
│   │   └── cron/sync-papers/ # GET (Vercel cron 6시간)
│   ├── paper/[pmid]/        # 논문 상세 페이지 (ISR)
│   ├── layout.tsx           # 루트 레이아웃
│   └── page.tsx             # 메인 피드
├── components/              # UI 컴포넌트
├── hooks/                   # use-papers, use-paper-filters, use-debounce
├── lib/
│   ├── pubmed/              # ESearch/EFetch client + XML parser
│   ├── crossref/            # DOI citation count
│   ├── sync/                # orchestrator, fetcher, store, enricher
│   ├── supabase/            # client.ts (browser), server.ts (anon + service)
│   ├── utils/               # retry, rate-limit, cn, date, text, url
│   └── constants/           # journals.ts (7개 저널 정의)
└── types/                   # database.ts, filters.ts

supabase/
├── migrations/              # 00001~00006 (6개 SQL 마이그레이션)
└── seed.sql                 # 7개 저널 시드 데이터
```

## DB 마이그레이션 목록
1. `00001_create_journals.sql` — journals 테이블
2. `00002_create_papers.sql` — papers 테이블 + GIN FTS 인덱스
3. `00003_create_paper_authors.sql` — paper_authors 테이블
4. `00004_create_sync_logs.sql` — sync_logs 테이블
5. `00005_create_search_function.sql` — search_papers() PL/pgSQL 함수
6. `00006_add_search_vector.sql` — stored tsvector 컬럼 + 가중치 검색 (NEW)

## 남은 Strategic 개선 (선택)
- S-2: Supabase 타입 생성 (`supabase gen types typescript`)
- S-4: CI/CD (GitHub Actions: lint → tsc → build → vitest)
- S-1: 큐 기반 동기화 (Inngest/Trigger.dev)
- S-3: 사용자 기능 (북마크, 알림, Trending)

## 주요 설계 결정
- `createAnonClient()` — 읽기 (RLS 준수), `createServiceClient()` — 쓰기 전용
- PubMed XML은 배치별 개별 파싱 (`efetchAndParse()`)
- 검색: `search_vector` tsvector (title=A, abstract=B 가중치)
- 동시 sync 방지: sync_logs "running" + 10분 stale guard
- 보안 헤더: CSP, HSTS, X-Frame-Options 등 next.config.ts에 설정
