"use client";

import { ThumbsUp, Loader2 } from "lucide-react";
import { usePaperLike } from "@/hooks/use-paper-like";
import { useAuth } from "@/hooks/use-auth";

interface LikeButtonProps {
  pmid: string;
  size?: "sm" | "md";
  initialCount?: number;
}

export function LikeButton({ pmid, size = "sm", initialCount = 0 }: LikeButtonProps) {
  const { user, loading: authLoading } = useAuth();
  const { liked, count, toggle, loading } = usePaperLike(pmid, initialCount);

  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  if (authLoading) {
    return (
      <div className="flex items-center gap-0.5 rounded-full p-1.5">
        <Loader2 className={`${iconSize} animate-spin text-gray-300 dark:text-gray-600`} />
      </div>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) {
          window.location.href = "/login";
          return;
        }
        toggle();
      }}
      disabled={loading}
      className={`flex items-center gap-1 rounded-full p-1.5 transition-colors ${
        liked
          ? "text-blue-500 dark:text-blue-400"
          : "text-gray-400 hover:bg-blue-50 hover:text-blue-500 dark:text-gray-500 dark:hover:bg-blue-900/30 dark:hover:text-blue-400"
      } ${loading ? "opacity-60" : ""}`}
      aria-label={liked ? "추천 취소" : user ? "추천하기" : "로그인 후 추천"}
      title={liked ? "추천 취소" : user ? "추천하기" : "로그인 후 추천"}
    >
      <ThumbsUp
        className={`${iconSize} ${liked ? "fill-blue-500 dark:fill-blue-400" : ""}`}
      />
      <span className="text-xs font-medium">
        추천 <span className="tabular-nums">{count}</span>
      </span>
    </button>
  );
}
