"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Bookmark, CheckCheck, Loader2, MessageCircle, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import useSWRInfinite from "swr/infinite";

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

export function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  function getKey(
    pageIndex: number,
    previousPageData: NotificationsResponse | null
  ): string | null {
    if (!open) return null;
    if (previousPageData && !previousPageData.next_cursor) return null;
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (previousPageData?.next_cursor) {
      params.set("cursor", previousPageData.next_cursor);
    }
    return `/api/notifications?${params.toString()}`;
  }

  const { data, size, setSize, isValidating, mutate } =
    useSWRInfinite<NotificationsResponse>(user ? getKey : () => null, fetcher, {
      revalidateFirstPage: true,
    });

  // Unread count (lightweight poll)
  const unreadCount = useSWRInfinite<NotificationsResponse>(
    user ? (_i: number, prev: NotificationsResponse | null) => {
      if (prev) return null; // only first page
      return "/api/notifications?limit=1";
    } : () => null,
    fetcher,
    { refreshInterval: 30_000, revalidateOnFocus: true }
  );
  const totalUnread = unreadCount.data?.[0]?.notifications.filter((n) => !n.read).length ?? 0;

  const notifications = data?.flatMap((page) => page.notifications) ?? [];
  const isLoadingInitial = open && !data;
  const isLoadingMore = size > 0 && data && typeof data[size - 1] === "undefined";
  const hasMore = data?.[data.length - 1]?.next_cursor !== null;
  const hasUnread = notifications.some((n) => !n.read);

  // Close on backdrop click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const lastItemRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoadingMore || !hasMore) return;
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) setSize((s) => s + 1);
      });
      if (node) observer.observe(node);
      return () => observer.disconnect();
    },
    [isLoadingMore, hasMore, setSize]
  );

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read_all: true }),
    });
    mutate();
    unreadCount.mutate();
  };

  const handleClick = (n: NotificationItem) => {
    if (!n.read) {
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_ids: [n.id] }),
      }).then(() => { mutate(); unreadCount.mutate(); });
    }
    setOpen(false);
    router.push(`/paper/${n.paper_pmid}#comments`);
  };

  if (!user) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative rounded-full p-1.5 text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        aria-label="알림"
      >
        <Bell className="h-5 w-5" />
        {totalUnread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40">
          <div
            ref={sheetRef}
            className="w-full max-w-lg animate-slide-up rounded-t-2xl bg-white dark:bg-gray-900"
            style={{ maxHeight: "70vh" }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-4 pb-3 dark:border-gray-800">
              <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-gray-100">
                <Bell className="h-4 w-4" />
                알림
              </h2>
              <div className="flex items-center gap-2">
                {hasUnread && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    모두 읽음
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto" style={{ maxHeight: "calc(70vh - 80px)" }}>
              {isLoadingInitial ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <Bell className="mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    새로운 알림이 없습니다
                  </p>
                </div>
              ) : (
                <>
                  {notifications.map((n, idx) => (
                    <div
                      key={n.id}
                      ref={idx === notifications.length - 1 ? lastItemRef : undefined}
                      onClick={() => handleClick(n)}
                      className={`cursor-pointer border-b border-gray-100 px-4 py-3 transition-colors active:bg-gray-100 dark:border-gray-800 dark:active:bg-gray-800 ${
                        !n.read ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
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
                          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                            {n.paper_title}
                          </p>
                          <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                            <span className="font-medium">#{n.comment.anon_id}</span>
                            {": "}
                            {n.comment.content_preview}
                          </p>
                          <span className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                            {timeAgo(n.comment.created_at)}
                          </span>
                        </div>
                        {!n.read && (
                          <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                        )}
                      </div>
                    </div>
                  ))}
                  {isLoadingMore && (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
