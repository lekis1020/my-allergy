"use client";

import { useCommentNotifications } from "@/hooks/use-comment-notifications";
import { CommentToastProvider } from "./toast-context";

function NotificationsListener() {
  useCommentNotifications();
  return null;
}

export function CommentNotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CommentToastProvider>
      <NotificationsListener />
      {children}
    </CommentToastProvider>
  );
}
