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
