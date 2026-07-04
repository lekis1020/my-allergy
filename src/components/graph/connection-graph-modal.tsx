"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { PaperConnectionGraph } from "./paper-connection-graph";

interface ConnectionGraphModalProps {
  focal: { pmid: string; title: string; journal_abbreviation: string; journal_color: string };
  nodes: Array<{ pmid: string; title: string; journal_abbreviation: string; journal_color: string; publication_date: string }>;
  edges: Array<{
    source: string; target: string;
    type: "citation" | "mention" | "both" | "similarity" | "bookmark";
    direction: "references" | "cited_by" | "bidirectional";
    mentions: Array<{ comment_id: string; anon_id: string; content_snippet: string; created_at: string }>;
    similarity?: number;
  }>;
  mode: "all" | "mine";
  onClose: () => void;
}

export function ConnectionGraphModal({ focal, nodes, edges, mode, onClose }: ConnectionGraphModalProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
              관계 그래프 — {mode === "mine" ? "내 관계도" : "전체 관계도"}
            </h2>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
              {focal.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Graph */}
        <div className="flex-1 overflow-hidden p-2">
          <PaperConnectionGraph
            focal={focal}
            nodes={nodes}
            edges={edges}
            width={960}
            height={600}
            interactive
          />
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 border-t border-gray-200 px-6 py-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {mode === "mine" ? (
            <>
              <span className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-6 bg-amber-500" />
                북마크
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-6 border-t-2 border-dashed border-teal-500" />
                유사도
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-6 bg-blue-500" />
                멘션
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-6 border-t-2 border-dashed border-teal-500" />
                유사도
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-6 border-t-2 border-dashed border-gray-400" />
                인용
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-6 bg-blue-500" />
                멘션
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
