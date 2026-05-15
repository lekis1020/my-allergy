# My Allergy 백서 (White Paper)

**버전**: 1.0
**작성일**: 2026-05-15
**대상 독자**: 알레르기·임상면역학 임상의·연구자, 의학 정보 큐레이션 플랫폼 기획자, 의료 도메인 엔지니어
**프로젝트 저장소**: github.com/lekis1020/my-allergy

---

## 1. 요약 (Executive Summary)

**My Allergy**는 알레르기·임상면역학 영역의 최신 논문, 임상시험, 학회 정보를 X(Twitter) 스타일 타임라인으로 통합 제공하는 지식 포털이다. PubMed E-utilities·CrossRef·ClinicalTrials.gov를 일일 1회 자동 동기화하고, Gemini 2.5 Flash 기반 AI Paper Chat과 익명 커뮤니티(Agora)로 "읽기"를 넘어 "이해와 토론"까지 잇는 임상 의사용 리서치 환경을 구축한다.

핵심 차별점은 다음 다섯 가지다.

1. **37종 저널의 알레르기 도메인 정밀 필터링** — 알레르기·면역학 전문 저널 23종에 더해 NEJM·Lancet·JAMA·BMJ 및 호흡기 상위 저널 14종에 MeSH + tiab 필터를 적용해 도메인 노이즈를 차단한다.
2. **저널별 병렬 큐 동기화** — Inngest 큐로 각 저널 fetch를 독립 fan-out 시켜 단일 저널 실패가 전체 동기화를 막지 않는다.
3. **Open Access 우선 AI 논문 대화** — Unpaywall → PMC → Europe PMC → Semantic Scholar 4단 폴백으로 PDF를 자동 확보, Gemini 멀티모달로 Figure·한계점·통계까지 구조화 질의.
4. **임상시험 ↔ 논문 양방향 연결** — ClinicalTrials.gov ongoing trial을 10개 질환 영역으로 모니터링하고, trial 선택 시 intervention/condition 키워드로 논문 피드를 즉시 필터링.
5. **익명 커뮤니티 + 맞춤 추천** — `COMMUNITY_SALT` 기반 일관 익명 ID, 사용자 친화도(affinity) 프로필 기반 추천으로 의사 공동체의 비공식 토론을 보장.

본 백서는 시스템의 문제정의·아키텍처·데이터 파이프라인·보안 모델·운영 전략을 기록하며, 향후 확장 로드맵의 기준선이 된다.

---

## 2. 문제 정의 (Problem Statement)

### 2.1 임상 의사의 정보 비대칭

알레르기·임상면역학 전문의는 일주일 평균 30~50건의 새 논문을 점검해야 하지만, 현실은 다음과 같다.

- **분산된 정보원**: 저널 RSS, PubMed Saved Search, 학회 메일링, 트위터, Slack — 통합 큐레이션이 없다.
- **노이즈 우위**: NEJM·Lancet 같은 종합 저널에서 알레르기 논문만 분리하기 위한 검색식이 복잡하고 반복적이다.
- **PDF 접근 장벽**: Open Access 비율이 낮은 저널은 PDF 다운로드 단계에서 흐름이 끊긴다.
- **임상시험-논문 단절**: ongoing trial과 관련 종설·기초 논문이 도구상 분리되어 있다.
- **비공식 의견 부재**: 한국어권 알레르기 전문의 사이의 가벼운 의견 교환 채널이 없다.

### 2.2 기존 솔루션 한계

| 도구 | 강점 | 약점 |
|---|---|---|
| PubMed | 가장 완전한 색인 | UX가 검색 중심, 피드성 아님, 한국어 학회·임상시험 통합 없음 |
| Read by QxMD | 모바일 친화 피드 | 알레르기 도메인 큐레이션 부재, AI 분석·커뮤니티 없음 |
| 학회 메일링 | 큐레이션 품질 | 빈도 낮음(주1~월1), 검색·필터 불가 |
| ChatGPT/Gemini 직접 사용 | 강력한 분석 | 논문 PDF를 사용자가 직접 업로드해야 함 |

**My Allergy의 포지셔닝**은 "PubMed의 색인 신뢰성 + Read의 피드 UX + ChatGPT의 분석력 + 학회 메일링의 큐레이션"을 한 화면에 합치는 것이다.

---

## 3. 시스템 개요 (Solution Overview)

### 3.1 사용자 여정 (User Journey)

```
[Daily Feed]  ────►  [Paper Detail]  ────►  [AI Paper Chat]
     │                     │                       │
     │                     ▼                       ▼
     │              [Bookmark / AI 요약]    [한계점 / Figure 설명]
     │                     │
     ▼                     ▼
[Clinical Trial Monitor] ──► [Trial-filtered Feed]
     │
     ▼
[Agora 익명 토론]  ────►  [Notifications]
     │
     ▼
[Insights / Conferences]
```

### 3.2 정보 도메인 범위

- **저널 37종** (`src/lib/constants/journals.ts`)
  - 알레르기·면역학 전문: 23종 (Allergy, JACI, JACI:Pract, Clin Exp Allergy, Pediatr Allergy Immunol 등)
  - 종합 4종: NEJM, Lancet, JAMA, BMJ (allergy MeSH/tiab 필터 적용)
  - 호흡기 6종: Lancet Respir Med, Eur Respir J, AJRCCM, Chest, Thorax 등 (respiratory filter 적용)
  - 보강: Frontiers in Immunology / Allergy, Int Forum Allergy Rhinol 등
- **임상시험**: ClinicalTrials.gov 기준 10개 질환 영역 (Asthma, Food Allergy, Atopic Dermatitis, Allergic Rhinitis, Urticaria, Immunodeficiency, Hypereosinophilia, Chronic Rhinosinusitis, Chronic Urticaria, Anaphylaxis)
- **학회 일정**: 국제(KAAACI, EAACI, AAAAI, ACAAI, ATS 등) + 국내, Supabase `conferences` 테이블 + LLM 주간 자동 검증

---

## 4. 아키텍처 (Architecture)

### 4.1 전체 구성도

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser (Next.js RSC)                  │
│   ┌─────────────┬──────────────┬──────────────────────────┐ │
│   │  Timeline   │  AI Chat UI  │  Agora / Calendar / etc. │ │
│   └─────────────┴──────────────┴──────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────┘
                            │ SWR · fetch · Server Actions
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Next.js 16 (App Router · src/)              │
│  /api/papers · /api/sync · /api/papers/[pmid]/chat · …       │
└───────┬─────────────────────────────────┬───────────────────┘
        │ anon client (RLS)               │ service client
        ▼                                 ▼
┌──────────────────┐               ┌──────────────────────────┐
│  Supabase Reads  │               │   Supabase Writes (sync) │
└───────┬──────────┘               └──────────┬───────────────┘
        │                                     │
        ▼                                     ▼
┌─────────────────────────────────────────────────────────────┐
│                       PostgreSQL (RLS)                       │
│  papers · paper_authors · bookmarks · comments ·             │
│  conferences · clinical_trials · chat_messages ·             │
│  paper_likes · paper_mentions · notifications ·              │
│  user_affinity_profiles · sync_logs                          │
└─────────────────────────────────────────────────────────────┘
        ▲                                     ▲
        │                                     │
        │     ┌──────── Inngest Queue ───────┘
        │     │  per-journal fan-out · retry
        │     ▼
┌─────────────────────────────────────────────────────────────┐
│                       External APIs                          │
│  PubMed E-utilities · CrossRef · ClinicalTrials.gov ·        │
│  Unpaywall · PMC · Europe PMC · Semantic Scholar ·           │
│  Google Gemini 2.5 Flash · Resend (email) · Discord webhook  │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 레이어 책임

| 레이어 | 책임 | 위치 |
|---|---|---|
| **Presentation** | RSC + Client Components, Tailwind v4, SWR | `src/app/**`, `src/components/**`, `src/hooks/**` |
| **API Routes** | REST endpoint, rate limit, auth, cache header | `src/app/api/**` |
| **Domain Logic** | 동기화 파이프라인, 추천, 알림, 댓글 정책 | `src/lib/sync/**`, `src/lib/recommend/**`, `src/lib/notifications/**` |
| **Integration** | PubMed/CrossRef/Gemini/Inngest 클라이언트 | `src/lib/pubmed/**`, `src/lib/crossref/**`, `src/lib/gemini/**`, `src/lib/inngest/**` |
| **Persistence** | Supabase 클라이언트 분리(anon vs service) | `src/lib/supabase/**` |
| **Schema** | PostgreSQL migration + RLS | `supabase/migrations/00001~00033` |

### 4.3 핵심 설계 결정 (Architectural Decisions)

1. **`createAnonClient()` vs `createServiceClient()` 분리**
   - 모든 read는 anon 키 + RLS를 통과시켜 권한 누출 방지.
   - sync writes·관리 작업·집계(예: 북마크/댓글 카운트)만 service role 사용.
   - 메모리 기록 `project_rls_aggregates.md`에 따라, 피드의 카운트 집계는 service client로 처리한다.

2. **PubMed 배치별 개별 XML 파싱**
   - `efetchAndParse()`는 응답 XML을 배치 단위로 즉시 파싱한다. joined XML 누적은 메모리 폭주·파싱 실패를 야기하므로 금지된다.

3. **Full-text Search via `search_vector tsvector GENERATED ALWAYS AS STORED`**
   - migration `00006_add_search_vector.sql`에서 title + abstract를 stored generated 컬럼으로 결합.
   - PG에서 인덱스 가능한 `to_tsvector` 결과를 직접 인덱싱해 검색 속도와 일관성 확보.

4. **동시 sync 방지**
   - `sync_logs` 테이블에 `status='running'` row가 존재하면 신규 sync를 거절.
   - 단, 10분 이상 stale한 running은 좀비로 간주해 무시 (deadlock 회피).

5. **Rate Limiting**
   - `/api/papers`에 60 req/min 슬라이딩 윈도우 적용.
   - 외부 API (PubMed/CrossRef/ClinicalTrials)는 `withRetry()`로 지수 백오프 + jitter.

6. **ISR for Paper Detail**
   - `paper/[pmid]/page.tsx`는 `revalidate=3600`. 새 논문 인입 + citation_count 업데이트 주기와 일치.

---

## 5. 데이터 파이프라인 (Data Pipeline)

### 5.1 일일 동기화 흐름

```
00:00 UTC (vercel.json cron)
   │
   ▼
GET /api/cron/sync-papers   ── auth: Bearer CRON_SECRET
   │
   ▼
sync_logs INSERT (status='running')
   │
   ▼
Inngest event: "sync/papers.requested"
   │
   ▼ fan-out per journal (37 events)
   │
   ┌──────────────┬──────────────┬──────────────┐
   ▼              ▼              ▼              ▼
[Allergy]    [JACI]         [NEJM]          ... ×37
   │              │              │
   ▼              ▼              ▼
ESearch (PMID list, last CRON_SYNC_DAYS days)
   │
   ▼
EFetch in batches (200 PMIDs/req)
   │
   ▼
XML parse → upsert into `papers` + `paper_authors`
   │
   ▼
CrossRef DOI enrich → citation_count
   │
   ▼
sync_logs UPDATE (status='completed', counts)
```

**병렬화 효과**: 단일 저널의 PubMed 응답 지연·실패가 다른 저널에 전파되지 않는다. 개별 step retry로 transient 실패를 흡수하고, 완료된 저널은 즉시 사용자에게 노출된다.

### 5.2 백업 동기화

`vercel.json` cron 실패에 대비해 GitHub Actions workflow `.github/workflows/daily-sync-fallback.yml`이 매일 01:15 UTC에 `/api/health`를 확인하고, 최근 동기화가 20시간 이상 지났으면 `/api/sync`를 호출한다.

### 5.3 학회 정보 주간 검증

`project_conference_auto_check.md`에 기록된 정책에 따라:

```
weekly cron → OpenAI web search → conference_proposals 테이블 →
Discord webhook (검토 카드) → /admin/conferences 승인 → conferences 테이블 반영
```

LLM이 자동 수집·요약하지만 게시는 사람의 승인이 필요한 **review-gated** 구조다.

### 5.4 AI Paper Chat PDF 확보 전략

```
1) Unpaywall (DOI → OA URL)
   ↓ miss
2) PMC (PMID → fulltext XML / PDF)
   ↓ miss
3) Europe PMC
   ↓ miss
4) Semantic Scholar OpenAccessPdf
   ↓ all miss
abstract-only fallback (Gemini text mode)
```

PDF 확보 시 `pubmed_cache` 테이블(migration 00017)에 저장하여 동일 논문 재질의 시 외부 호출 없이 즉시 응답.

---

## 6. 데이터 모델 (Data Model)

주요 테이블 (migration 00001~00033)

| 테이블 | 목적 | 핵심 컬럼 |
|---|---|---|
| `journals` | 저널 메타 | slug, name, issn, impact_factor, color |
| `papers` | 논문 본체 | pmid (PK), doi, title, abstract, authors_summary, published_date, search_vector, citation_count, has_ai_summary |
| `paper_authors` | 저자 정규화 | paper_pmid, position, last_name, fore_name, affiliation, country |
| `paper_citations` | 인용 그래프 | citing_pmid, cited_pmid |
| `paper_mentions` | 언급 추적 | paper_pmid, source, mention_text |
| `paper_likes` | 추천(좋아요) | user_id, paper_pmid (총 카운트 = 추천 수) |
| `bookmarks` | 사용자 북마크 | user_id, paper_pmid, ai_summary |
| `comments` | 익명 댓글 | id, paper_pmid, parent_id, anon_id (salted hash), body |
| `notifications` | 답글/멘션 알림 | user_id, type, related_id, read_at |
| `chat_messages` / `chat_threads` | AI 대화 히스토리 | user_id, paper_pmid, role, content, tokens_used |
| `user_affinity_profiles` | 사용자 친화도 프로필 | user_id, topic_weights JSONB, journal_weights JSONB |
| `conferences` / `conference_proposals` | 학회 일정 + 검증 큐 | start_date, end_date, location, date_confirmed |
| `pubmed_cache` | PDF/메타 캐시 | pmid, source, payload, cached_at |
| `sync_logs` | 동기화 감사 로그 | started_at, status, journal_slug, fetched, inserted, errors |
| `trending_analysis` | 트렌딩 토픽 | topic, score, window |

**RLS 정책 요지**

- `papers`, `journals`, `conferences` (date_confirmed=true): 모두 익명 read 가능.
- `bookmarks`, `chat_messages`, `notifications`, `user_affinity_profiles`: `auth.uid() = user_id` 필수.
- `comments`: 읽기는 인증 사용자(00028), 쓰기는 anon_id 생성 후 본인 row만 수정 가능.
- 집계(좋아요 수, 댓글 수) 노출: anon으로는 집계 view에 접근하되 row-level 식별자는 차단.

---

## 7. AI 통합 (AI Integration)

### 7.1 AI Paper Chat

- **모델**: Google Gemini 2.5 Flash (멀티모달, 1M context window 지원)
- **입력**: PDF (base64) + 사용자 질의 + 시스템 프롬프트 (한국어 임상 의사 페르소나)
- **구조화된 응답 카테고리**:
  - "이 논문의 한계점" — 통계적·임상적·외적 타당성 차원으로 분해
  - "Figure N 설명" — 멀티모달로 그림 단위 해석
  - "Methods 요약" — 디자인·표본·통계 검정·연구윤리 항목
- **사용량 제한**: 논문당 10회, 일 10논문 (사용자별, `chat_messages` 카운트 기반)
- **이력 저장**: `chat_threads` 테이블에 thread 단위로 영속화

### 7.2 AI 초록 요약

- 북마크 시 옵션으로 한국어 구조화 요약 생성 (Background / Methods / Results / Implications).
- 결과는 `bookmarks.ai_summary`에 캐싱하여 재진입 시 재호출하지 않음 (migration 00012, 00029).

### 7.3 맞춤 추천

- `user_affinity_profiles`에 토픽·저널 가중치를 누적.
- 사용자가 북마크·좋아요·체류 시간으로 시그널을 남길 때마다 가중치를 업데이트.
- 추천 API는 최근 90일 논문을 (topic_weight × 0.6) + (journal_weight × 0.3) + (recency × 0.1)로 스코어링.

---

## 8. 보안 및 개인정보 (Security & Privacy)

### 8.1 인증/인가

- Supabase Auth (email magic link)
- `/admin/**`은 `ADMIN_EMAILS` 화이트리스트 게이트 (메모리 `reference_deployment_ids.md`)
- 모든 mutation API는 `auth.uid()` 검증 + RLS 더블 체크

### 8.2 외부 비밀

- `SUPABASE_SERVICE_ROLE_KEY` — 절대 client bundle 노출 금지, server-only 모듈에서만 import
- `CRON_SECRET` — cron 인증 Bearer
- `COMMUNITY_SALT` — 익명 ID 해시 솔트, 회전 시 기존 익명 ID 무효화
- `GOOGLE_GENERATIVE_AI_API_KEY`, `INNGEST_*`, `PUBMED_API_KEY`, `CROSSREF_EMAIL`

### 8.3 보안 헤더

- CSP, HSTS, X-Content-Type-Options, Referrer-Policy 적용 (`next.config.ts`)
- AdSense·Funding Choices 스크립트는 CSP `script-src` 화이트리스트에 명시

### 8.4 개인정보

- 익명 커뮤니티: `sha256(user_id || COMMUNITY_SALT)`로 `anon_id` 생성. 실명 매핑은 서버에 저장하지 않음.
- 사용자 데이터 삭제 요청 시 `bookmarks`, `chat_*`, `user_affinity_profiles`, `comments(anon_id)` 일괄 삭제 절차 마련.
- AdSense (pub-8245767086450488) + Google Funding Choices CMP로 EEA GDPR 컴플라이언스 지원.

---

## 9. 성능 (Performance)

| 영역 | 전략 | 측정 지표 |
|---|---|---|
| Feed first paint | RSC + `revalidate` + 페이지네이션 cursor | LCP < 2.0s (3G Fast) |
| Paper detail | ISR (revalidate=3600) | TTFB < 200ms (warm cache) |
| Full-text search | `search_vector` GIN 인덱스 | < 80ms p95 (50k papers 기준) |
| Daily sync | Inngest fan-out per journal | 전체 동기화 < 15분 |
| AI Chat | PDF cache hit 시 first token < 1.5s | TTFT 측정 |
| Rate-limited endpoint | `/api/papers` 60 req/min/IP | 429 비율 < 0.1% |

---

## 10. 운영 (Operations)

### 10.1 배포

- **호스팅**: Vercel (Edge runtime은 일부 read API만 사용, sync는 Node runtime)
- **CI/CD**: GitHub Actions `lint → tsc → vitest`, main 머지 시 자동 배포
- **DB Migration**: `supabase db push` (PR에 migration 변경 시 review 필수)

### 10.2 관측 (Observability)

- `sync_logs` 테이블 + `/api/health` endpoint로 동기화 상태 점검
- Inngest dashboard로 step retry 가시화
- 에러 추적: Sentry 미통합 (향후 작업)
- 비용 관측: Gemini 토큰 사용량을 `chat_messages.tokens_used` 합산

### 10.3 비상 대응

| 시나리오 | 대응 |
|---|---|
| Vercel cron 실패 | GitHub Actions fallback (01:15 UTC) |
| PubMed 장애 | Inngest 재시도, 다음 cron까지 자동 회복 |
| Supabase RLS 변경 후 트래픽 실패 | `/admin/diagnostics`에서 RLS 정책 점검, migration revert |
| Gemini API quota 초과 | 사용량 제한 도달 시 친화적 메시지, 다음 날 reset |

---

## 11. 로드맵 (Roadmap)

### Near-term (1~2개월)

- **S-2: Supabase 타입 자동 생성** — `supabase gen types typescript --local`로 `src/types/database.ts` 갱신, `Record<string, unknown>` 캐스트 제거.
- **conferences DB 동기화** — `src/lib/constants/conferences.ts` static 데이터를 Supabase upsert로 이관 (메모리 `project_pending_conferences_db_sync.md` 추적).
- **AdSense CMP 게시** — Funding Choices 콘솔에서 GDPR 메시지를 publish해 EEA 배너 노출 활성화 (메모리 `project_pending_adsense_cmp_console.md`).

### Mid-term (3~6개월)

- **이메일 알림** — 키워드/저자/저널 구독 → Resend 통한 daily digest
- **Trending Tab v2** — `trending_analysis`를 활용한 시계열 토픽 트렌드, 코호트별 비교
- **Sentry / OpenTelemetry 통합** — 에러·트레이스 가시화

### Long-term

- **Korean Conference Mirror** — KAAACI/대한천식알레르기학회 일정과 초록 통합
- **Reviewer Network** — 익명 ID에 reputation 가중치 부여, 실력 기반 댓글 정렬
- **Local LLM Option** — 민감 데이터(예: 환자 vignette)는 on-device/private LLM으로 라우팅하는 옵션

---

## 12. 기여 가이드 (Contributing)

- 모든 비-자명 변경은 **feature branch + PR** 워크플로우를 따른다 (메모리 `feedback_pr_workflow.md`).
- DB 변경은 새 migration 파일로만 — 기존 migration 수정 금지.
- 외부 API 호출 추가 시 반드시 `withRetry()` 래핑.
- 새 RLS 정책 추가 시 anon vs authenticated read/write 매트릭스를 PR 설명에 첨부.

---

## 13. 결론 (Conclusion)

My Allergy는 "알레르기 전문가의 평일 아침 30분"을 위해 설계된 단일 화면 리서치 환경이다. PubMed의 신뢰성, AI의 분석력, 커뮤니티의 의견을 한 흐름에 묶음으로써, 임상 의사가 정보 추적에 소모하던 인지 비용을 환자 진료와 연구로 되돌리는 것이 본 프로젝트의 종착점이다.

본 백서는 살아있는 문서로, 주요 마일스톤(타입 자동화·CMP 게시·conferences 동기화 완료 등) 달성 시 갱신한다.

---

**문의/기여**: Issues — github.com/lekis1020/my-allergy/issues
**라이선스**: 코드는 저장소 LICENSE 파일을 따르며, 논문 메타데이터는 PubMed/CrossRef/ClinicalTrials.gov 각 데이터 제공자의 이용 약관을 준수한다.
