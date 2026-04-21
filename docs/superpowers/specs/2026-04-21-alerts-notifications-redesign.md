# Alerts Tab Redesign: In-App Comment Notifications

**Date:** 2026-04-21
**Status:** Draft

## Overview

Alerts 탭을 저널 이메일 구독 + 키워드 알림에서 **앱 내 댓글 알림 센터**로 전환한다.

두 가지 트리거:
- **bookmark_comment**: 내가 북마크한 논문에 새 댓글이 달림
- **thread_comment**: 내가 댓글을 단 논문에 새 댓글이 달림

이메일 알림 없음. 앱 내 알림만. 헤더 벨 아이콘 없음 (alerts 탭에서만 확인).

## 제거 대상

- `email_subscriptions` 테이블 (DROP 또는 미사용 처리)
- `keyword_alerts` 테이블 (DROP 또는 미사용 처리)
- `GET/POST/DELETE /api/subscriptions` route
- `GET/POST/DELETE/PATCH /api/keyword-alerts` route
- `src/app/alerts/page.tsx` 기존 UI 전체 (새 UI로 교체)
- `src/lib/email/notify.ts`의 `sendJournalAlerts`, `sendKeywordAlerts` 함수
- `src/lib/inngest/functions.ts`의 `sendNotificationsFn` (이메일 알림 함수)
- Supabase 타입 정의에서 `email_subscriptions`, `keyword_alerts` 관련 타입

## Database

### `notifications` 테이블

```sql
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paper_pmid  TEXT NOT NULL,
  comment_id  UUID NOT NULL REFERENCES paper_comments(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('bookmark_comment', 'thread_comment')),
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread
  ON notifications (user_id, read, created_at DESC);

CREATE UNIQUE INDEX idx_notifications_unique
  ON notifications (user_id, comment_id, type);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own notifications"
  ON notifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users update own notifications"
  ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- INSERT 정책 없음: 서비스 역할 client만 INSERT 가능 (RLS bypass)
-- 일반 유저는 INSERT 불가
```

### 우선순위 규칙

한 댓글이 bookmark_comment와 thread_comment 모두 해당할 경우, `bookmark_comment` 하나만 생성한다. 자기 자신이 작성한 댓글에 대해서는 알림을 생성하지 않는다.

## API

### 알림 생성 — 댓글 POST 시 (기존 route 수정)

**파일:** `src/app/api/papers/[pmid]/comments/route.ts`

댓글 INSERT 성공 후, try-catch로 감싸서 실행 (알림 생성 실패가 댓글 응답에 영향 없도록):

1. 해당 pmid를 북마크한 유저 목록 조회 (`bookmarks` 테이블)
2. 해당 pmid에 댓글 단 유저 목록 조회 (`paper_comments` 테이블, `DISTINCT user_id WHERE user_id IS NOT NULL`)
3. 댓글 작성자 본인 제외
4. 북마크 유저 → `type: 'bookmark_comment'`으로 INSERT
5. 나머지 댓글 유저 (북마크 유저에서 이미 처리된 유저 제외) → `type: 'thread_comment'`으로 INSERT

서비스 역할 Supabase client 사용 (RLS bypass).

### `GET /api/notifications`

**Query params:**
- `cursor` (optional): 페이지네이션용 `created_at` ISO string
- `limit` (optional): 기본 20, 최대 50

**Response:**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "bookmark_comment",
      "read": false,
      "created_at": "2026-04-21T10:00:00Z",
      "paper_pmid": "12345678",
      "paper_title": "IL-5 receptor...",
      "comment": {
        "id": "uuid",
        "anon_id": "a3f2",
        "content_preview": "This finding is consistent with...",
        "created_at": "2026-04-21T10:00:00Z"
      }
    }
  ],
  "next_cursor": "2026-04-21T09:00:00Z"
}
```

- `notifications` + `paper_comments` + `papers` JOIN
- `content_preview`: 댓글 내용 100자 잘라서 제공
- `created_at DESC` 정렬
- soft-deleted 댓글(`deleted_at IS NOT NULL`)의 알림은 필터링

### `PATCH /api/notifications`

**Request body:**
```json
{ "notification_ids": ["uuid1", "uuid2"] }
```
또는
```json
{ "read_all": true }
```

**Response:**
```json
{ "updated": 3 }
```

RLS로 본인 알림만 업데이트 가능.

## UI

### Alerts 탭 (`src/app/alerts/page.tsx`) — 전체 교체

**구성:**
- 헤더: "알림" 타이틀 + "모두 읽음" 버튼
- 알림 목록: 무한 스크롤 (cursor 기반, SWR `useSWRInfinite`)
- 각 알림 카드:
  - 타입 아이콘: 북마크(🔖) / 댓글(💬)
  - 논문 제목
  - 댓글 미리보기 (anon_id + content 100자)
  - 시간 (상대 시간: "2시간 전")
  - 안읽음 표시 (배경색 구분)
- 빈 상태: "북마크하거나 댓글을 달면 새 활동을 알려드립니다"
- 로그인 필요 (기존 auth-wall 유지)
- 다크모드 지원

**동작:**
- 알림 클릭 → 해당 논문 상세 페이지 댓글 섹션으로 이동 (`/papers/[pmid]#comments`) + 해당 알림 읽음 처리
- "모두 읽음" 버튼 → `PATCH /api/notifications { read_all: true }` + UI 즉시 반영

### 기존 유지

- `use-comment-notifications.ts` (실시간 답글 토스트) — 변경 없음
- `/api/comments/unread` (미읽은 답글 카운트) — 변경 없음

## 기존 이메일 인프라 정리

- `sendNotificationsFn` Inngest 함수 제거 (Inngest handler 등록에서도 제거)
- `sendJournalAlerts`, `sendKeywordAlerts` 함수 제거
- `buildJournalAlertHtml`, `buildKeywordAlertHtml` 템플릿 제거
- Resend 클라이언트, `getFromEmail` 등은 다른 곳에서 사용 여부 확인 후 판단

## Supabase 타입 업데이트

`src/types/supabase.ts` 및 `src/types/database.ts`에서:
- `email_subscriptions`, `keyword_alerts` 타입 제거
- `notifications` 테이블 타입 추가

## 범위 밖 (Out of Scope)

- 헤더 벨 아이콘 / 뱃지
- 이메일 알림
- 실시간 Supabase Realtime 구독 (알림 탭 자동 갱신) — 향후 확장 가능
- 알림 삭제 기능
- 알림 설정 (타입별 on/off)
