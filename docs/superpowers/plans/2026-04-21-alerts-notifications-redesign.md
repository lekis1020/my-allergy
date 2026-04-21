# Alerts Tab Redesign: In-App Comment Notifications — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace journal email subscriptions and keyword alerts with an in-app notification center that alerts users when new comments appear on their bookmarked or previously-commented papers.

**Architecture:** New `notifications` table stores notification rows created by the comment POST API route. Two new API endpoints serve and update notifications. The alerts page is replaced with a notification list using SWR infinite scroll. All old email alert infrastructure is removed.

**Tech Stack:** Next.js 16 (App Router), Supabase (PostgreSQL + RLS), SWR (`useSWRInfinite`), Tailwind CSS v4, Vitest

---

### Task 1: DB Migration — Create notifications table

**Files:**
- Create: `supabase/migrations/00025_create_notifications.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 00025_create_notifications.sql
-- In-app notifications for comment activity on bookmarked/commented papers

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paper_pmid  TEXT NOT NULL,
  comment_id  UUID NOT NULL REFERENCES paper_comments(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('bookmark_comment', 'thread_comment')),
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup for user's unread notifications, newest first
CREATE INDEX idx_notifications_user_unread
  ON notifications (user_id, read, created_at DESC);

-- Prevent duplicate notifications for same user + comment + type
CREATE UNIQUE INDEX idx_notifications_unique
  ON notifications (user_id, comment_id, type);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications
CREATE POLICY "users read own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only update (mark read) their own notifications
CREATE POLICY "users update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- No INSERT policy: only service role client can insert (bypasses RLS)
```

- [ ] **Step 2: Apply migration locally**

Run: `cd /Users/napler/projects/my-allergy && npx supabase db push`
Expected: Migration applies successfully

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00025_create_notifications.sql
git commit -m "feat: add notifications table for in-app comment alerts"
```

---

### Task 2: Update Supabase types

**Files:**
- Modify: `src/types/supabase.ts` (add `notifications` table, remove `email_subscriptions` and `keyword_alerts`)
- Modify: `src/types/database.ts` (update type aliases)

- [ ] **Step 1: Add notifications type to supabase.ts**

In `src/types/supabase.ts`, inside `public.Tables`, add after the `bookmarks` entry:

```typescript
      notifications: {
        Row: {
          id: string
          user_id: string
          paper_pmid: string
          comment_id: string
          type: "bookmark_comment" | "thread_comment"
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          paper_pmid: string
          comment_id: string
          type: "bookmark_comment" | "thread_comment"
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          paper_pmid?: string
          comment_id?: string
          type?: "bookmark_comment" | "thread_comment"
          read?: boolean
          created_at?: string
        }
        Relationships: []
      }
```

- [ ] **Step 2: Remove old types from supabase.ts**

Remove the entire `email_subscriptions` block (lines 41–61) and `keyword_alerts` block (lines 221–244) from `src/types/supabase.ts`.

- [ ] **Step 3: Update database.ts**

Replace `src/types/database.ts` contents with:

```typescript
import type { Database } from "./supabase";

// Re-export generated Database type
export type { Database };

// Convenience row-type aliases
export type Journal = Database["public"]["Tables"]["journals"]["Row"];
export type Paper = Database["public"]["Tables"]["papers"]["Row"];
export type PaperAuthor = Database["public"]["Tables"]["paper_authors"]["Row"];
export type SyncLog = Database["public"]["Tables"]["sync_logs"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];

export interface PaperWithDetails extends Paper {
  journal: Journal;
  authors: PaperAuthor[];
}
```

- [ ] **Step 4: Verify types compile**

Run: `cd /Users/napler/projects/my-allergy && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/types/supabase.ts src/types/database.ts
git commit -m "feat: update Supabase types for notifications, remove email/keyword alert types"
```

---

### Task 3: Notification generation helper

**Files:**
- Create: `src/lib/notifications/generate.ts`
- Create: `src/__tests__/notifications/generate.test.ts`

- [ ] **Step 1: Write the test**

Create `src/__tests__/notifications/generate.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildNotificationRows } from "@/lib/notifications/generate";

describe("buildNotificationRows", () => {
  const commentAuthorId = "user-author";
  const pmid = "12345678";
  const commentId = "comment-1";

  it("creates bookmark_comment for users who bookmarked the paper", () => {
    const bookmarkUserIds = ["user-a", "user-b"];
    const commentUserIds: string[] = [];

    const rows = buildNotificationRows({
      commentAuthorId,
      commentId,
      pmid,
      bookmarkUserIds,
      commentUserIds,
    });

    expect(rows).toEqual([
      { user_id: "user-a", paper_pmid: pmid, comment_id: commentId, type: "bookmark_comment" },
      { user_id: "user-b", paper_pmid: pmid, comment_id: commentId, type: "bookmark_comment" },
    ]);
  });

  it("creates thread_comment for users who commented on the paper", () => {
    const bookmarkUserIds: string[] = [];
    const commentUserIds = ["user-c", "user-d"];

    const rows = buildNotificationRows({
      commentAuthorId,
      commentId,
      pmid,
      bookmarkUserIds,
      commentUserIds,
    });

    expect(rows).toEqual([
      { user_id: "user-c", paper_pmid: pmid, comment_id: commentId, type: "thread_comment" },
      { user_id: "user-d", paper_pmid: pmid, comment_id: commentId, type: "thread_comment" },
    ]);
  });

  it("excludes the comment author from notifications", () => {
    const bookmarkUserIds = [commentAuthorId, "user-a"];
    const commentUserIds = [commentAuthorId, "user-b"];

    const rows = buildNotificationRows({
      commentAuthorId,
      commentId,
      pmid,
      bookmarkUserIds,
      commentUserIds,
    });

    expect(rows).toEqual([
      { user_id: "user-a", paper_pmid: pmid, comment_id: commentId, type: "bookmark_comment" },
      { user_id: "user-b", paper_pmid: pmid, comment_id: commentId, type: "thread_comment" },
    ]);
  });

  it("bookmark_comment takes priority over thread_comment for same user", () => {
    const bookmarkUserIds = ["user-a"];
    const commentUserIds = ["user-a", "user-b"];

    const rows = buildNotificationRows({
      commentAuthorId,
      commentId,
      pmid,
      bookmarkUserIds,
      commentUserIds,
    });

    expect(rows).toEqual([
      { user_id: "user-a", paper_pmid: pmid, comment_id: commentId, type: "bookmark_comment" },
      { user_id: "user-b", paper_pmid: pmid, comment_id: commentId, type: "thread_comment" },
    ]);
  });

  it("returns empty array when no recipients", () => {
    const rows = buildNotificationRows({
      commentAuthorId,
      commentId,
      pmid,
      bookmarkUserIds: [],
      commentUserIds: [],
    });

    expect(rows).toEqual([]);
  });

  it("returns empty array when only the author bookmarked/commented", () => {
    const rows = buildNotificationRows({
      commentAuthorId,
      commentId,
      pmid,
      bookmarkUserIds: [commentAuthorId],
      commentUserIds: [commentAuthorId],
    });

    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/napler/projects/my-allergy && npx vitest run src/__tests__/notifications/generate.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `src/lib/notifications/generate.ts`:

```typescript
interface NotificationRow {
  user_id: string;
  paper_pmid: string;
  comment_id: string;
  type: "bookmark_comment" | "thread_comment";
}

interface BuildNotificationRowsInput {
  commentAuthorId: string;
  commentId: string;
  pmid: string;
  bookmarkUserIds: string[];
  commentUserIds: string[];
}

/**
 * Build notification rows for a new comment.
 * - bookmark_comment: user bookmarked the paper
 * - thread_comment: user previously commented on the paper
 * - bookmark_comment takes priority (no duplicate for same user)
 * - comment author is excluded
 */
export function buildNotificationRows(
  input: BuildNotificationRowsInput
): NotificationRow[] {
  const { commentAuthorId, commentId, pmid, bookmarkUserIds, commentUserIds } =
    input;
  const rows: NotificationRow[] = [];
  const notified = new Set<string>();

  // bookmark_comment first (higher priority)
  for (const userId of bookmarkUserIds) {
    if (userId === commentAuthorId) continue;
    if (notified.has(userId)) continue;
    rows.push({
      user_id: userId,
      paper_pmid: pmid,
      comment_id: commentId,
      type: "bookmark_comment",
    });
    notified.add(userId);
  }

  // thread_comment for remaining users
  for (const userId of commentUserIds) {
    if (userId === commentAuthorId) continue;
    if (notified.has(userId)) continue;
    rows.push({
      user_id: userId,
      paper_pmid: pmid,
      comment_id: commentId,
      type: "thread_comment",
    });
    notified.add(userId);
  }

  return rows;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/napler/projects/my-allergy && npx vitest run src/__tests__/notifications/generate.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/generate.ts src/__tests__/notifications/generate.test.ts
git commit -m "feat: add notification row builder with priority logic and tests"
```

---

### Task 4: Integrate notification generation into comment POST

**Files:**
- Modify: `src/app/api/papers/[pmid]/comments/route.ts` (add notification generation after comment insert)

- [ ] **Step 1: Add import at top of file**

Add after existing imports in `src/app/api/papers/[pmid]/comments/route.ts`:

```typescript
import { createServiceClient } from "@/lib/supabase/server";
import { buildNotificationRows } from "@/lib/notifications/generate";
```

- [ ] **Step 2: Add notification generation after the comment insert**

After the `if (insertErr || !inserted)` error check block (line 194–199) and before the final `return NextResponse.json(...)` (line 201), add:

```typescript
  // Generate notifications (fire-and-forget, don't block response)
  try {
    const serviceClient = createServiceClient();

    // 1. Users who bookmarked this paper
    const { data: bookmarks } = await serviceClient
      .from("bookmarks")
      .select("user_id")
      .eq("pmid", pmid);
    const bookmarkUserIds = (bookmarks ?? []).map((b) => b.user_id);

    // 2. Users who previously commented on this paper
    const { data: commenters } = await serviceClient
      .from("paper_comments")
      .select("user_id")
      .eq("paper_pmid", pmid)
      .not("user_id", "is", null)
      .neq("id", inserted.id);
    const commentUserIds = [
      ...new Set(
        (commenters ?? [])
          .map((c) => c.user_id)
          .filter((id): id is string => id !== null)
      ),
    ];

    const rows = buildNotificationRows({
      commentAuthorId: user.id,
      commentId: inserted.id,
      pmid,
      bookmarkUserIds,
      commentUserIds,
    });

    if (rows.length > 0) {
      await serviceClient.from("notifications").upsert(rows, {
        onConflict: "user_id,comment_id,type",
        ignoreDuplicates: true,
      });
    }
  } catch (err) {
    console.error("[Notifications] Failed to generate notifications:", err);
  }
```

- [ ] **Step 3: Verify types compile**

Run: `cd /Users/napler/projects/my-allergy && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/papers/[pmid]/comments/route.ts
git commit -m "feat: generate in-app notifications when comments are posted"
```

---

### Task 5: GET /api/notifications

**Files:**
- Create: `src/app/api/notifications/route.ts`

- [ ] **Step 1: Create the GET route**

Create `src/app/api/notifications/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50);

  let query = supabase
    .from("notifications")
    .select(
      `
      id, type, read, created_at, paper_pmid, comment_id,
      paper_comments!inner(id, anon_id, content, created_at, deleted_at),
      papers:papers!inner(pmid, title)
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  const notifications = items
    .filter((row) => {
      // Filter out notifications for deleted comments
      const comment = row.paper_comments as unknown as {
        deleted_at: string | null;
      };
      return comment.deleted_at === null;
    })
    .map((row) => {
      const comment = row.paper_comments as unknown as {
        id: string;
        anon_id: string;
        content: string;
        created_at: string;
      };
      const paper = row.papers as unknown as {
        pmid: string;
        title: string;
      };

      return {
        id: row.id,
        type: row.type,
        read: row.read,
        created_at: row.created_at,
        paper_pmid: row.paper_pmid,
        paper_title: paper.title,
        comment: {
          id: comment.id,
          anon_id: comment.anon_id,
          content_preview:
            comment.content.length > 100
              ? comment.content.slice(0, 100) + "…"
              : comment.content,
          created_at: comment.created_at,
        },
      };
    });

  return NextResponse.json({
    notifications,
    next_cursor: hasMore ? items[items.length - 1].created_at : null,
  });
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd /Users/napler/projects/my-allergy && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/notifications/route.ts
git commit -m "feat: add GET /api/notifications with cursor pagination"
```

---

### Task 6: PATCH /api/notifications (mark as read)

**Files:**
- Modify: `src/app/api/notifications/route.ts`

- [ ] **Step 1: Add PATCH handler**

Append to `src/app/api/notifications/route.ts`:

```typescript
interface PatchBody {
  notification_ids?: string[];
  read_all?: boolean;
}

export async function PATCH(request: NextRequest) {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as PatchBody;

  if (body.read_all) {
    const { count, error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false)
      .select("id", { count: "exact", head: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ updated: count ?? 0 });
  }

  if (
    !body.notification_ids ||
    !Array.isArray(body.notification_ids) ||
    body.notification_ids.length === 0
  ) {
    return NextResponse.json(
      { error: "notification_ids or read_all required" },
      { status: 400 }
    );
  }

  const { count, error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .in("id", body.notification_ids)
    .select("id", { count: "exact", head: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ updated: count ?? 0 });
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd /Users/napler/projects/my-allergy && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/notifications/route.ts
git commit -m "feat: add PATCH /api/notifications for marking as read"
```

---

### Task 7: New alerts page UI

**Files:**
- Modify: `src/app/alerts/page.tsx` (full replacement)

- [ ] **Step 1: Replace alerts page**

Replace entire contents of `src/app/alerts/page.tsx`:

```tsx
"use client";

import { useCallback, useRef } from "react";
import { Bell, Bookmark, MessageCircle, Loader2, CheckCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import useSWRInfinite from "swr/infinite";
import { useRouter } from "next/navigation";

interface NotificationItem {
  id: string;
  type: "bookmark_comment" | "thread_comment";
  read: boolean;
  created_at: string;
  paper_pmid: string;
  paper_title: string;
  comment: {
    id: string;
    anon_id: string;
    content_preview: string;
    created_at: string;
  };
}

interface NotificationsResponse {
  notifications: NotificationItem[];
  next_cursor: string | null;
}

const PAGE_SIZE = 20;

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function getKey(
  pageIndex: number,
  previousPageData: NotificationsResponse | null
): string | null {
  if (previousPageData && !previousPageData.next_cursor) return null;
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (previousPageData?.next_cursor) {
    params.set("cursor", previousPageData.next_cursor);
  }
  return `/api/notifications?${params.toString()}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR");
}

export default function AlertsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const markingAllRead = useRef(false);

  const { data, error, size, setSize, isValidating, mutate } =
    useSWRInfinite<NotificationsResponse>(user ? getKey : () => null, fetcher, {
      revalidateFirstPage: true,
    });

  const notifications = data?.flatMap((page) => page.notifications) ?? [];
  const isLoadingInitial = !data && !error;
  const isLoadingMore =
    size > 0 && data && typeof data[size - 1] === "undefined";
  const hasMore = data?.[data.length - 1]?.next_cursor !== null;
  const isEmpty = data?.[0]?.notifications.length === 0;
  const hasUnread = notifications.some((n) => !n.read);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastItemRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoadingMore || !hasMore) return;
      if (observerRef.current) observerRef.current.disconnect();
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          setSize((s) => s + 1);
        }
      });
      if (node) observerRef.current.observe(node);
    },
    [isLoadingMore, hasMore, setSize]
  );

  const markAsRead = async (notificationId: string) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification_ids: [notificationId] }),
    });
    mutate();
  };

  const markAllRead = async () => {
    if (markingAllRead.current) return;
    markingAllRead.current = true;
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read_all: true }),
      });
      mutate();
    } finally {
      markingAllRead.current = false;
    }
  };

  const handleClick = (notification: NotificationItem) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    router.push(`/paper/${notification.paper_pmid}#comments`);
  };

  if (authLoading) {
    return (
      <div className="mx-auto w-full max-w-[1280px] px-0 sm:px-4 sm:py-4">
        <div className="mx-auto max-w-2xl border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-[1280px] px-0 sm:px-4 sm:py-4">
        <div className="mx-auto max-w-2xl border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bell className="mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" />
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
              로그인하고 알림을 받아보세요
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              북마크하거나 댓글을 달면 새 활동을 알려드립니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] px-0 sm:px-4 sm:py-4">
      <div className="mx-auto max-w-2xl border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        {/* Header */}
        <div className="sticky top-14 z-20 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-gray-900 dark:text-gray-100" />
              <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                알림
              </h1>
            </div>
            {hasUnread && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <CheckCheck className="h-4 w-4" />
                모두 읽음
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {isLoadingInitial ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bell className="mb-4 h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              북마크하거나 댓글을 달면 새 활동을 알려드립니다.
            </p>
          </div>
        ) : (
          <div>
            {notifications.map((n, idx) => {
              const isLast = idx === notifications.length - 1;
              return (
                <div
                  key={n.id}
                  ref={isLast ? lastItemRef : undefined}
                  onClick={() => handleClick(n)}
                  className={`cursor-pointer border-b border-gray-100 px-4 py-3 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900 ${
                    !n.read
                      ? "bg-blue-50/50 dark:bg-blue-950/20"
                      : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      {n.type === "bookmark_comment" ? (
                        <Bookmark className="h-4 w-4 text-amber-500" />
                      ) : (
                        <MessageCircle className="h-4 w-4 text-blue-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {n.paper_title}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">
                          #{n.comment.anon_id}
                        </span>
                        {": "}
                        {n.comment.content_preview}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {timeAgo(n.comment.created_at)}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {n.type === "bookmark_comment"
                            ? "북마크한 논문"
                            : "댓글 단 논문"}
                        </span>
                      </div>
                    </div>
                    {!n.read && (
                      <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                    )}
                  </div>
                </div>
              );
            })}
            {isLoadingMore && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd /Users/napler/projects/my-allergy && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/app/alerts/page.tsx
git commit -m "feat: replace alerts page with in-app notification center"
```

---

### Task 8: Remove old email alert infrastructure

**Files:**
- Delete: `src/app/api/subscriptions/route.ts`
- Delete: `src/app/api/keyword-alerts/route.ts`
- Delete: `src/lib/email/notify.ts`
- Delete: `src/lib/email/resend.ts`
- Modify: `src/lib/inngest/functions.ts` (remove `sendNotificationsFn` and its imports)
- Modify: `src/app/api/inngest/route.ts` (remove `sendNotificationsFn` from handler)
- Modify: `src/lib/inngest/functions.ts` (remove notification trigger from `syncAllFn`)

- [ ] **Step 1: Delete old API routes and email modules**

```bash
cd /Users/napler/projects/my-allergy
rm src/app/api/subscriptions/route.ts
rm src/app/api/keyword-alerts/route.ts
rm src/lib/email/notify.ts
rm src/lib/email/resend.ts
rmdir src/lib/email 2>/dev/null || true
rmdir src/app/api/subscriptions 2>/dev/null || true
rmdir src/app/api/keyword-alerts 2>/dev/null || true
```

- [ ] **Step 2: Remove sendNotificationsFn from Inngest functions**

In `src/lib/inngest/functions.ts`:

Remove the import line:
```typescript
import { sendJournalAlerts, sendKeywordAlerts } from "@/lib/email/notify";
```

Remove the entire `sendNotificationsFn` function definition (the `export const sendNotificationsFn = inngest.createFunction(...)` block, lines 338–412).

- [ ] **Step 3: Remove notification trigger from syncAllFn**

In `src/lib/inngest/functions.ts`, inside `syncAllFn`, remove the notification event emission block:

```typescript
    // Trigger email notifications after a delay to allow journal syncs to complete
    await step.sendEvent("trigger-notifications", [
      {
        name: "sync/notifications.requested" as const,
        data: { journalCount: JOURNALS.length },
      },
    ]);
```

- [ ] **Step 4: Update Inngest handler**

Replace `src/app/api/inngest/route.ts`:

```typescript
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import {
  syncJournalFn,
  syncAllFn,
  backfillJournalFn,
  backfillAllFn,
  onDemandEnrichFn,
} from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    syncJournalFn,
    syncAllFn,
    backfillJournalFn,
    backfillAllFn,
    onDemandEnrichFn,
  ],
});
```

- [ ] **Step 5: Verify build**

Run: `cd /Users/napler/projects/my-allergy && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 6: Run all tests**

Run: `cd /Users/napler/projects/my-allergy && npx vitest run`
Expected: All tests pass (no existing tests depend on removed code)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: remove email alert infrastructure (subscriptions, keywords, Resend, Inngest notifications)"
```

---

### Task 9: DB Migration — Drop old tables

**Files:**
- Create: `supabase/migrations/00026_drop_email_keyword_alerts.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 00026_drop_email_keyword_alerts.sql
-- Remove email subscription and keyword alert tables (replaced by in-app notifications)

DROP TABLE IF EXISTS keyword_alerts;
DROP TABLE IF EXISTS email_subscriptions;
```

- [ ] **Step 2: Apply migration locally**

Run: `cd /Users/napler/projects/my-allergy && npx supabase db push`
Expected: Migration applies successfully

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00026_drop_email_keyword_alerts.sql
git commit -m "chore: drop email_subscriptions and keyword_alerts tables"
```

---

### Task 10: Final verification

- [ ] **Step 1: Run full test suite**

Run: `cd /Users/napler/projects/my-allergy && npx vitest run`
Expected: All tests pass including new notification tests

- [ ] **Step 2: Run type check**

Run: `cd /Users/napler/projects/my-allergy && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run dev server and verify UI**

Run: `cd /Users/napler/projects/my-allergy && npm run dev`

Manual verification:
1. Navigate to `/alerts` — should show empty state when no notifications
2. Bookmark a paper, then post a comment from a different account — notification should appear
3. Click notification — should navigate to paper detail with `#comments`
4. "모두 읽음" button — should mark all as read
5. Infinite scroll — should load more notifications when scrolling down
6. Dark mode — should render correctly

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```
