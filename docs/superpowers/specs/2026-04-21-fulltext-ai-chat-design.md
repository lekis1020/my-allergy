# Full-Text AI Paper Chat & Excalidraw Visualization

**Date:** 2026-04-21
**Status:** Draft

## Overview

Open Access 논문 원문(PDF)을 기반으로 AI 요약 및 질의응답 챗봇을 제공한다. 도식화 요청 시 Excalidraw 다이어그램을 생성하고 인라인 렌더링한다. 대화 이력은 DB에 저장되며, 기존 Bookmarks 탭을 History 탭으로 확장하여 북마크 + 채팅 이력을 통합 관리한다.

**핵심 결정사항:**
- AI 모델: Gemini 2.5 Flash (PDF 네이티브 지원, 1M 컨텍스트, 저비용)
- 접근 방식: 매 턴 PDF 직접 전송 (텍스트 추출 불필요)
- 도식화: Excalidraw JSON을 AI가 채팅 응답에 생성
- 대화 이력: DB 저장, 최대 2개월 보존
- 접근 제한: 인증 유저만, 하루 10건 논문, 논문당 10회 질의

## 기능 범위

### 포함
- OA 논문 PDF 기반 AI 채팅 (Gemini 2.5 Flash)
- 스트리밍 응답 (SSE)
- 퀵 액션 버튼 (원문 요약, 연구 방법, 한계점)
- Excalidraw 다이어그램 생성 및 인라인 렌더링
- 대화 이력 DB 저장 (chat_sessions)
- Rate limiting (chat_usage: 10 papers/day, 10 queries/paper)
- Bookmarks → History 탭 리네이밍 및 통합
- 2개월 초과 채팅 이력 자동 삭제

### 제외
- Non-OA 논문 지원
- 기존 초록 기반 AI 요약 변경 (그대로 유지)
- 이메일/외부 알림
- PDF 텍스트 추출 파이프라인
- Excalidraw 내보내기/공유

## Database

### `chat_sessions` 테이블

```sql
CREATE TABLE chat_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paper_pmid TEXT NOT NULL,
  messages   JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, paper_pmid)
);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own chat sessions"
  ON chat_sessions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users update own chat sessions"
  ON chat_sessions FOR UPDATE USING (auth.uid() = user_id);

-- INSERT/DELETE: 서비스 역할 client만 (RLS bypass)
```

`messages` JSONB 구조:
```json
[
  {
    "role": "user",
    "content": "핵심 결과를 요약해줘",
    "created_at": "2026-04-21T10:00:00Z"
  },
  {
    "role": "assistant",
    "content": "이 연구의 핵심 결과는...",
    "created_at": "2026-04-21T10:00:05Z",
    "excalidraw": null
  },
  {
    "role": "assistant",
    "content": "연구 흐름을 도식화하면...",
    "created_at": "2026-04-21T10:01:00Z",
    "excalidraw": { "elements": [...], "appState": {...} }
  }
]
```

### `chat_usage` 테이블

```sql
CREATE TABLE chat_usage (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paper_pmid TEXT NOT NULL,
  used_at    DATE NOT NULL DEFAULT CURRENT_DATE,
  count      INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, paper_pmid, used_at)
);

ALTER TABLE chat_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own chat usage"
  ON chat_usage FOR SELECT USING (auth.uid() = user_id);

-- INSERT/UPDATE: 서비스 역할 client만 (RLS bypass)
```

Rate limit 체크:
- 논문당 질의: `SELECT count FROM chat_usage WHERE user_id = ? AND paper_pmid = ? AND used_at = CURRENT_DATE` → `count ≤ 10`
- 일일 논문 수: `SELECT COUNT(DISTINCT paper_pmid) FROM chat_usage WHERE user_id = ? AND used_at = CURRENT_DATE` → `≤ 10` (또는 해당 논문이 이미 존재)

### 2개월 이력 정리

```sql
DELETE FROM chat_sessions WHERE updated_at < now() - interval '2 months';
```

API 요청 시 백그라운드로 실행하거나, Supabase pg_cron 등록.

## API

### `POST /api/papers/[pmid]/chat`

**인증:** 필수 (로그인 유저만)

**요청:**
```json
{
  "messages": [
    { "role": "user", "content": "이 논문의 핵심 결과를 요약해줘" }
  ]
}
```

**처리 흐름:**
1. 인증 확인
2. Rate limit 체크 (chat_usage 조회)
   - 논문당 10회, 일일 10건 논문 초과 시 429 반환
3. Unpaywall API로 OA PDF URL 조회
   - Non-OA면 `{ error: "이 논문은 Open Access가 아닙니다" }` 403
4. PDF 다운로드 (서버 메모리 캐시, Map<pmid, { buffer, expiry }>, 10분 TTL)
5. Gemini 2.5 Flash에 전송:
   - 시스템 프롬프트
   - PDF (inline base64 또는 파일 참조)
   - 대화 이력 (DB에서 로드 + 현재 메시지)
6. 스트리밍 응답 (ReadableStream → SSE)
7. 응답 완료 후:
   - chat_sessions UPSERT (messages 배열에 추가)
   - chat_usage UPSERT (count 증가)

**시스템 프롬프트:**
```
당신은 알레르기/임상면역학 분야 연구 논문 분석 전문가입니다.
첨부된 PDF 논문 원문을 기반으로 질문에 답변하세요.

규칙:
- 논문 내용에 근거한 답변만 제공
- 근거가 없으면 "논문에 해당 내용이 없습니다"라고 답변
- 한국어로 답변
- 수치, 통계, 결과는 정확하게 인용
- 마크다운 형식 사용 (볼드, 불릿, 테이블 등)

도식화 요청 시:
- Excalidraw JSON 형식으로 다이어그램을 생성하세요
- 텍스트 설명 후 ```excalidraw 코드 블록으로 JSON을 포함하세요
- 요소 타입: rectangle, ellipse, diamond, arrow, text
- 색상: 파스텔 계열, 연구 흐름은 좌→우 또는 상→하 배치
- JSON은 { "elements": [...] } 형식
```

**응답:** `Content-Type: text/event-stream`
```
data: {"type": "text", "content": "이 연구의 "}
data: {"type": "text", "content": "핵심 결과는..."}
data: {"type": "excalidraw", "data": {"elements": [...]}}
data: {"type": "done", "usage": {"papers_today": 3, "queries_this_paper": 5}}
```

**에러 응답:**
- 401: 미인증
- 403: Non-OA 논문
- 429: Rate limit 초과 (`{ error: "...", limit_type: "paper" | "daily" }`)
- 500: Gemini API 오류

### `GET /api/papers/[pmid]/chat`

대화 이력 조회 (채팅 패널 초기 로드용)

**응답:**
```json
{
  "messages": [...],
  "usage": { "papers_today": 3, "queries_this_paper": 5, "max_papers": 10, "max_queries": 10 }
}
```

세션이 없으면 `{ "messages": [], "usage": {...} }` 반환.

### `GET /api/chat/history`

History 탭에서 채팅 이력 목록 조회용.

**응답:**
```json
{
  "sessions": [
    {
      "paper_pmid": "41998809",
      "message_count": 5,
      "updated_at": "2026-04-21T10:00:00Z"
    }
  ]
}
```

## UI

### 1. 논문 상세 페이지 — AI Chat 패널

**위치:** 우측 사이드바, External Links와 Keywords 사이

**상태별 표시:**

| 상태 | 표시 |
|------|------|
| Non-OA 논문 | 표시 안 함 |
| OA + 비로그인 | "로그인 후 AI Chat 이용 가능" 안내 |
| OA + 로그인 + rate limit 초과 | 채팅 패널 (입력 비활성화 + 한도 초과 안내) |
| OA + 로그인 | 채팅 패널 (활성) |

**채팅 패널 구성:**
- 헤더: "AI Paper Chat" + Gemini 아이콘
- 퀵 액션 버튼: "원문 요약", "연구 방법", "한계점"
  - "원문 요약" → "이 논문의 전체 내용을 구조화하여 요약해줘"
  - "연구 방법" → "이 논문의 연구 방법론을 상세히 설명해줘"
  - "한계점" → "이 논문의 한계점과 향후 연구 방향을 분석해줘"
- 메시지 영역: 스크롤 가능, 최신 메시지로 자동 스크롤
- 입력 영역: 텍스트 입력 + 전송 버튼
- 하단 사용량 표시: "남은 질의: 8/10"
- 이전 대화가 있으면 DB에서 로드하여 표시

**메시지 렌더링:**
- 유저 메시지: 오른쪽 정렬, 배경색 구분
- AI 응답: 왼쪽 정렬, 마크다운 렌더링
- Excalidraw 블록: `@excalidraw/excalidraw` 컴포넌트로 인라인 렌더링
  - 기본: 읽기 전용 뷰
  - "편집" 버튼 클릭 → 전체화면 모달에서 편집 가능
- 스트리밍 중: 타이핑 애니메이션 + "생성 중..." 표시

### 2. History 탭 (기존 Bookmarks 리네이밍)

**변경사항:**
- 탭 이름: Bookmarks → History
- 아이콘: Bookmark → Clock 또는 History 아이콘
- URL: `/bookmarks` 유지 (기존 링크 호환)
- 헤더 네비게이션 + 모바일 네비게이션 텍스트/아이콘 변경

**필터 탭:**
- 전체: 북마크 + 채팅 이력 통합 (updated_at 기준 최신순)
- 북마크: 기존 북마크만
- AI 채팅: 채팅 이력이 있는 논문만

**각 항목 표시:**
- 🔖 아이콘: 북마크된 논문
- 💬 아이콘: 채팅 이력 있는 논문
- 둘 다 해당하면 두 아이콘 모두 표시
- 채팅 이력 논문: "N일 전 채팅" 서브텍스트
- 클릭 → 논문 상세 페이지 이동 (채팅 이력 자동 로드)

## 의존성

### 신규 패키지
- `@google/generative-ai` — Gemini API SDK
- `@excalidraw/excalidraw` — Excalidraw React 컴포넌트

### 환경 변수
- `GOOGLE_GENERATIVE_AI_API_KEY` — Gemini API 키 (Vercel + .env.local)

### 기존 유지
- `openai` 패키지 — 기존 초록 요약 그대로 유지
- `OPENAI_API_KEY` — 기존 초록 요약용

## Supabase 타입 업데이트

`src/types/supabase.ts`에 `chat_sessions`, `chat_usage` 테이블 타입 추가.
`src/types/database.ts`에 `ChatSession`, `ChatUsage` 편의 타입 추가.

## 범위 밖 (Out of Scope)

- Non-OA 논문 지원
- 기존 초록 AI 요약 변경
- Excalidraw 다이어그램 내보내기/공유/다운로드
- 다국어 지원 (한국어 고정)
- 채팅 이력 검색
- PDF 텍스트 추출 파이프라인
