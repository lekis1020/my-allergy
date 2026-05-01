# Paper Mention & Connection Graph — Phase 1 Design

**Date:** 2026-04-29
**Branch:** `feat/user-data-backup`
**Status:** Draft

---

## 1. Overview

댓글에서 `@` 기호로 북마크한 논문을 검색/멘션하는 기능과, 논문 간 연결 관계(citation + 사용자 mention)를 D3.js force-directed 네트워크 그래프로 시각화하는 기능.

### Goals
- 댓글에서 `@` + 제목 검색으로 논문 멘션
- 멘션된 논문 간 관계를 `paper_mentions` 테이블에 저장
- 초점 논문 중심의 1-depth 네트워크 그래프 (citation + mention)
- 엣지에 관계 내용(댓글 텍스트) 오버뷰 표시
- 논문 상세 페이지에 프리뷰 카드 + 모달 풀스크린 확장

---

## 2. @ Mention System

### 2.1 UX Flow
1. 댓글 입력 중 `@` 타이핑
2. `@` 이후 입력한 텍스트로 **북마크 논문 제목** 실시간 필터링
3. 드롭다운에서 논문 선택 → 본문에 `[@논문제목](pmid:12345678)` 형태로 삽입
4. 렌더링 시 클릭 가능한 `/paper/[pmid]` 링크로 표시

### 2.2 Comment Form 변경 (`comment-form.tsx`)
- `@` 키 감지: textarea의 `onChange`에서 커서 앞 텍스트를 파싱, `@`로 시작하는 쿼리 추출
- 드롭다운 컴포넌트: `<MentionDropdown>` — textarea 아래 또는 커서 근처에 절대 위치
- 데이터 소스: `/api/bookmarks/with-titles` (아래 참조)
- 클라이언트 필터링: 북마크 논문 목록을 SWR로 캐시, 타이핑 시 제목 부분 매칭
- 선택 시: 드롭다운 닫고, textarea에 `[@짧은제목](pmid:XXXX)` 삽입
- ESC/외부 클릭으로 드롭다운 닫기

### 2.3 Comment Rendering 변경 (`comment-item.tsx`)
- 댓글 본문 렌더링 시 `[@...](pmid:XXXX)` 패턴을 정규식으로 감지
- 매치된 부분을 `<Link href="/paper/XXXX">` 컴포넌트로 교체
- 나머지 텍스트는 기존대로 표시

### 2.4 Bookmarks API 보강
**새 엔드포인트: `GET /api/bookmarks/with-titles`**
- 응답: `{ papers: [{ pmid, title }] }`
- bookmarks 테이블 JOIN papers 테이블로 title 포함
- 인증 필수 (기존 bookmarks API와 동일 패턴)

---

## 3. Database

### 3.1 새 테이블: `paper_mentions`

```sql
-- Migration: 00032_paper_mentions.sql
CREATE TABLE paper_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES paper_comments(id) ON DELETE CASCADE,
  source_pmid TEXT NOT NULL,      -- 댓글이 달린 논문
  mentioned_pmid TEXT NOT NULL,   -- @로 언급된 논문
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE paper_mentions
  ADD CONSTRAINT uq_mention_per_comment UNIQUE (comment_id, mentioned_pmid);

CREATE INDEX idx_paper_mentions_source ON paper_mentions(source_pmid);
CREATE INDEX idx_paper_mentions_mentioned ON paper_mentions(mentioned_pmid);

-- RLS
ALTER TABLE paper_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read mentions"
  ON paper_mentions FOR SELECT TO authenticated
  USING (true);

-- INSERT는 service role만 (API에서 댓글 저장 시 자동 insert)
```

### 3.2 Mention 파싱 & 저장 (서버)

댓글 POST API (`/api/papers/[pmid]/comments/route.ts`) 수정:
1. 댓글 insert 성공 후
2. `content`에서 `\[@[^\]]*\]\(pmid:(\d+)\)` 패턴 추출
3. 각 mentioned_pmid에 대해 `paper_mentions` insert (service client 사용)
4. fire-and-forget (알림 생성과 동일 패턴)

---

## 4. Connection Graph

### 4.1 API: `GET /api/papers/[pmid]/connections`

응답 형태:
```typescript
interface ConnectionsResponse {
  focal: {
    pmid: string;
    title: string;
    journal_abbreviation: string;
    journal_color: string;
  };
  nodes: Array<{
    pmid: string;
    title: string;
    journal_abbreviation: string;
    journal_color: string;
    publication_date: string;
  }>;
  edges: Array<{
    source: string;  // pmid
    target: string;  // pmid
    type: "citation" | "mention" | "both";
    direction: "references" | "cited_by" | "bidirectional";
    mentions?: Array<{
      comment_id: string;
      anon_id: string;
      content_snippet: string;  // 댓글 내용 발췌 (100자)
      created_at: string;
    }>;
  }>;
}
```

데이터 수집:
1. `paper_citations` — source_pmid/target_pmid 양방향 조회
2. `paper_mentions` — source_pmid/mentioned_pmid 양방향 조회 + JOIN paper_comments로 댓글 내용 가져오기
3. 동일 논문이 citation + mention 둘 다인 경우 type: "both"로 병합
4. 각 관련 논문의 메타데이터 (title, journal) 조회

### 4.2 D3.js Force-Directed Graph Component

**패키지:** `d3` (d3-force, d3-selection, d3-zoom)

**컴포넌트:** `src/components/graph/paper-connection-graph.tsx`

**노드 렌더링:**
- 초점 논문: 큰 원(r=30), 저널 컬러 fill, 굵은 테두리
- 주변 논문: 작은 원(r=18), 저널 컬러 fill
- 노드 내부 또는 옆에 짧은 제목(15자 + "...")
- hover 시 툴팁: 전체 제목, 저널명, 날짜

**엣지 렌더링:**
- Citation: 점선(stroke-dasharray), 화살표 마커로 방향 표시
- Mention: 실선, 다른 색상 (예: blue)
- Both: 실선 + 화살표
- hover 시 엣지 위에 관계 내용 팝오버 표시:
  - Citation: "Cited by" / "References" 레이블
  - Mention: 댓글 내용 발췌 목록

**인터랙션:**
- 드래그: 노드 이동 (d3-drag)
- 줌/팬: d3-zoom
- 노드 클릭: `/paper/[pmid]`로 이동
- 초점 논문은 중앙 고정 (fx, fy)

### 4.3 논문 상세 페이지 배치

**프리뷰 카드** (client component):
- 위치: 데스크톱 사이드바의 "Citation Graph" 섹션 위 또는 아래
- 모바일: 하단 섹션에 추가
- 카드 내부: 미니 그래프 (인터랙션 비활성) + "N개 논문 연결됨" 텍스트
- 클릭 시 모달 오픈

**풀스크린 모달** (`src/components/graph/connection-graph-modal.tsx`):
- 모달 배경 dim, 중앙 정렬
- 거의 뷰포트 전체 크기 (max-w-5xl, max-h-[90vh])
- 상단: 초점 논문 제목 + 닫기 버튼
- 중앙: D3 그래프 (풀 인터랙션)
- 하단: 범례 (Citation 점선 / Mention 실선 / Both)
- ESC로 닫기

---

## 5. 기술 스택 변경

| 항목 | 추가 |
|------|------|
| npm 패키지 | `d3`, `@types/d3` |
| 새 파일 | migration 1개, API route 2개, component 4개, hook 1개 |
| 수정 파일 | comment-form, comment-item, comments API route, paper detail page |

---

## 6. 파일 구조

```
src/
├── app/api/
│   ├── bookmarks/
│   │   └── with-titles/route.ts    [NEW] 북마크 + 제목 조회
│   └── papers/[pmid]/
│       ├── comments/route.ts       [MOD] mention 파싱/저장 추가
│       └── connections/route.ts    [NEW] connection graph 데이터
├── components/
│   ├── comments/
│   │   ├── comment-form.tsx        [MOD] @ mention 드롭다운 추가
│   │   ├── comment-item.tsx        [MOD] mention 링크 렌더링
│   │   └── mention-dropdown.tsx    [NEW] 논문 검색 드롭다운
│   └── graph/
│       ├── paper-connection-graph.tsx   [NEW] D3 네트워크 그래프
│       ├── connection-graph-preview.tsx [NEW] 프리뷰 카드
│       └── connection-graph-modal.tsx   [NEW] 풀스크린 모달
├── hooks/
│   └── use-bookmarks-with-titles.ts    [NEW] 북마크+제목 SWR 훅
└── app/paper/[pmid]/page.tsx           [MOD] 프리뷰 카드 배치

supabase/migrations/
└── 00032_paper_mentions.sql            [NEW]
```

---

## 7. Phase 2 (Future)

- Open Access PDF 확보 가능 시 Gemini로 인용 맥락 추출
- 엣지에 논문 원문의 인용 문맥 표시
- 기존 chat PDF 다운로드 + Gemini 연동 코드 재활용
