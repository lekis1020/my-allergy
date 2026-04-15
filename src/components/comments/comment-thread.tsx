"use client";

import useSWR from "swr";
import { MessageCircle } from "lucide-react";
import type { CommentThreadNode } from "@/lib/comments/types";
import { CommentForm } from "./comment-form";
import { CommentItem } from "./comment-item";

async function fetchThread(url: string): Promise<{ thread: CommentThreadNode[] }> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load comments");
  return res.json();
}

interface CommentThreadProps {
  pmid: string;
}

export function CommentThread({ pmid }: CommentThreadProps) {
  const key = `/api/papers/${pmid}/comments`;
  const { data, error, isLoading, mutate } = useSWR(key, fetchThread, {
    revalidateOnFocus: false,
  });

  const thread = data?.thread ?? [];
  const totalCount = thread.reduce(
    (sum, node) => sum + 1 + node.children.length,
    0
  );

  return (
    <section id="comments" className="mt-10 border-t border-gray-200 pt-8 dark:border-gray-800">
      <div className="mb-4 flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          커뮤니티 스레드
          <span className="ml-1 text-gray-400 dark:text-gray-500">
            · {totalCount}개 댓글
          </span>
        </h2>
      </div>

      <CommentForm pmid={pmid} onSubmitted={() => mutate()} />

      <div className="mt-6 space-y-6">
        {isLoading && (
          <p className="text-sm text-gray-500 dark:text-gray-400">불러오는 중…</p>
        )}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            댓글을 불러오지 못했습니다.
          </p>
        )}
        {!isLoading && thread.length === 0 && !error && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            첫 댓글의 주인공이 되어보세요.
          </p>
        )}

        {thread.map((node) => (
          <div key={node.id} className="space-y-3">
            <CommentItem
              comment={node}
              pmid={pmid}
              onChanged={() => mutate()}
              onReplySubmitted={() => mutate()}
            />
            {node.children.length > 0 && (
              <div className="space-y-3">
                {node.children.map((child) => (
                  <CommentItem
                    key={child.id}
                    comment={child}
                    pmid={pmid}
                    isReply
                    onChanged={() => mutate()}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
