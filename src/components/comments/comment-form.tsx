"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Loader2, Send } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { registerOwnComment } from "@/hooks/use-comment-notifications";
import { useBookmarksWithTitles, type BookmarkPaper } from "@/hooks/use-bookmarks-with-titles";
import { MentionDropdown } from "./mention-dropdown";

interface CommentFormProps {
  pmid: string;
  parentId?: string | null;
  placeholder?: string;
  autoFocus?: boolean;
  onSubmitted?: () => void;
  onCancel?: () => void;
}

export function CommentForm({
  pmid,
  parentId = null,
  placeholder = "이 논문에 대해 의견을 남겨보세요 (익명)",
  autoFocus = false,
  onSubmitted,
  onCancel,
}: CommentFormProps) {
  const { user, loading: authLoading } = useAuth();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { papers: bookmarkPapers } = useBookmarksWithTitles();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionActive, setMentionActive] = useState(false);

  if (authLoading) {
    return (
      <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
        로딩 중…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
        <Link
          href="/login"
          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          로그인하고 익명으로 참여
        </Link>
        <span> — 댓글을 남기려면 로그인이 필요합니다.</span>
      </div>
    );
  }

  if (!user.email_confirmed_at) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        이메일 인증이 필요합니다. 받은 편지함의 확인 메일을 열어 인증을 완료해 주세요.
      </div>
    );
  }

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setContent(val);
    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    const mentionMatch = textBeforeCursor.match(/(?:^|[\s])@([^\s@]*)$/);
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setMentionActive(true);
    } else {
      setMentionActive(false);
      setMentionQuery(null);
    }
  }

  function handleMentionSelect(paper: BookmarkPaper) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const cursor = textarea.selectionStart;
    const textBeforeCursor = content.slice(0, cursor);
    const atIndex = textBeforeCursor.lastIndexOf("@");
    if (atIndex === -1) return;
    const shortTitle = paper.title.length > 60
      ? paper.title.slice(0, 57) + "..."
      : paper.title;
    const mention = `[@${shortTitle}](pmid:${paper.pmid})`;
    const before = content.slice(0, atIndex);
    const after = content.slice(cursor);
    const newContent = before + mention + " " + after;
    setContent(newContent);
    setMentionActive(false);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      textarea.focus();
      const newCursor = before.length + mention.length + 1;
      textarea.setSelectionRange(newCursor, newCursor);
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = content.trim();
    if (trimmed.length === 0) return;
    if (trimmed.length > 2000) {
      setError("댓글은 2000자 이하여야 합니다.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/papers/${pmid}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: trimmed, parent_id: parentId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "댓글을 저장하지 못했습니다.");
        return;
      }
      if (json?.comment?.id) {
        // Keep the realtime notification filter in sync without exposing
        // user_id in the Realtime payload (see migration 00019_harden.sql).
        registerOwnComment(json.comment.id);
      }
      setContent("");
      onSubmitted?.();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      {!parentId && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">@</span>
          을 입력해 다른 논문을 검색하여 인용할 수 있습니다.
        </p>
      )}
      <div className="relative">
        <MentionDropdown
          query={mentionQuery ?? ""}
          papers={bookmarkPapers}
          onSelect={handleMentionSelect}
          visible={mentionActive}
        />
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={(e) => {
            if (e.key === "Escape" && mentionActive) {
              setMentionActive(false);
              setMentionQuery(null);
            }
          }}
          onBlur={() => {
            setTimeout(() => setMentionActive(false), 200);
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          rows={parentId ? 2 : 3}
          maxLength={2000}
          className="w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
        />
      </div>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {content.length} / 2000
        </span>
        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              취소
            </button>
          )}
          <button
            type="submit"
            disabled={submitting || content.trim().length === 0}
            className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {parentId ? "답글 달기" : "댓글 작성"}
          </button>
        </div>
      </div>
    </form>
  );
}
