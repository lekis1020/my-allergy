"use client";

import { useState } from "react";
import { Flag, MessageSquare, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { formatRelativeDate } from "@/lib/utils/date";
import { formatAnonId } from "@/lib/comments/anon-id-client";
import type { CommentDTO } from "@/lib/comments/types";
import { CommentForm } from "./comment-form";

interface CommentItemProps {
  comment: CommentDTO;
  pmid: string;
  isReply?: boolean;
  onChanged: () => void;
  onReplySubmitted?: () => void;
}

export function CommentItem({
  comment,
  pmid,
  isReply = false,
  onChanged,
  onReplySubmitted,
}: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isDeleted = comment.deleted_at !== null;

  async function saveEdit() {
    setBusy(true);
    setActionError(null);
    const trimmed = editContent.trim();
    if (trimmed.length === 0 || trimmed.length > 2000) {
      setActionError("댓글은 1–2000자여야 합니다.");
      setBusy(false);
      return;
    }
    const res = await fetch(`/api/comments/${comment.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: trimmed }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setActionError(json.error ?? "수정에 실패했습니다.");
      return;
    }
    setEditing(false);
    onChanged();
  }

  async function remove() {
    if (!window.confirm("이 댓글을 삭제하시겠어요?")) return;
    setBusy(true);
    const res = await fetch(`/api/comments/${comment.id}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (res.ok) onChanged();
  }

  async function report() {
    const reason = window.prompt("신고 사유를 입력해 주세요 (선택사항).") ?? "";
    setBusy(true);
    const res = await fetch(`/api/comments/${comment.id}/report`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    setBusy(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      window.alert(json.error ?? "신고에 실패했습니다.");
      return;
    }
    window.alert("신고가 접수되었습니다.");
    onChanged();
  }

  return (
    <div
      className={`${
        isReply ? "ml-6 border-l border-gray-100 pl-4 dark:border-gray-800" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          {comment.anon_id.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-gray-800 dark:text-gray-200">
              {formatAnonId(comment.anon_id)}
            </span>
            <span className="text-gray-400 dark:text-gray-500">
              {formatRelativeDate(comment.created_at)}
            </span>
            {comment.updated_at !== comment.created_at && !isDeleted && (
              <span className="text-gray-400 dark:text-gray-500">· 수정됨</span>
            )}
            {comment.is_own && (
              <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                나
              </span>
            )}
          </div>

          {isDeleted ? (
            <p className="mt-1 text-sm italic text-gray-400 dark:text-gray-500">
              삭제된 댓글입니다.
            </p>
          ) : editing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={3}
                maxLength={2000}
                className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
              {actionError && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {actionError}
                </p>
              )}
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditContent(comment.content);
                  }}
                  className="rounded-full px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  취소
                </button>
                <button
                  disabled={busy}
                  onClick={saveEdit}
                  className="rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
                >
                  저장
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">
              {comment.content}
            </p>
          )}

          {!isDeleted && !editing && (
            <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              {!isReply && (
                <button
                  onClick={() => setReplying((v) => !v)}
                  className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  답글
                </button>
              )}
              {comment.can_edit && (
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  수정
                </button>
              )}
              {comment.is_own && (
                <button
                  onClick={remove}
                  disabled={busy}
                  className="inline-flex items-center gap-1 hover:text-red-600 dark:hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  삭제
                </button>
              )}
              {!comment.is_own && (
                <button
                  onClick={report}
                  disabled={busy}
                  className="inline-flex items-center gap-1 hover:text-red-600 dark:hover:text-red-400"
                >
                  <Flag className="h-3.5 w-3.5" />
                  신고
                </button>
              )}
              {!comment.can_edit && comment.is_own && !isDeleted && (
                <span className="inline-flex items-center gap-1 text-gray-300 dark:text-gray-600">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                  수정 기한 만료
                </span>
              )}
            </div>
          )}

          {replying && (
            <div className="mt-3">
              <CommentForm
                pmid={pmid}
                parentId={comment.id}
                placeholder="답글을 남겨주세요 (익명)"
                autoFocus
                onCancel={() => setReplying(false)}
                onSubmitted={() => {
                  setReplying(false);
                  onReplySubmitted?.();
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
