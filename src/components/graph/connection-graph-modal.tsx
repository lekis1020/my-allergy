"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { PaperConnectionGraph } from "./paper-connection-graph";

interface ConnectionNode {
  pmid: string;
  title: string;
  journal_abbreviation: string;
  journal_color: string;
  publication_date: string;
}

interface ConnectionEdge {
  source: string;
  target: string;
  type: "citation" | "mention" | "both" | "similarity" | "bookmark";
  direction: "references" | "cited_by" | "bidirectional" | null;
  mentions: Array<{ comment_id: string; anon_id: string; content_snippet: string; created_at: string }>;
  similarity?: number;
}

interface ConnectionGraphModalProps {
  focal: { pmid: string; title: string; journal_abbreviation: string; journal_color: string };
  nodes: ConnectionNode[];
  edges: ConnectionEdge[];
  mode: "all" | "mine";
  onClose: () => void;
}

interface RailItem {
  node: ConnectionNode;
  edge: ConnectionEdge;
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

  const items: RailItem[] = useMemo(() => {
    const nodeMap = new Map(nodes.map((n) => [n.pmid, n]));
    const paired: RailItem[] = [];
    for (const e of edges) {
      const otherPmid = e.source === focal.pmid ? e.target : e.source;
      const node = nodeMap.get(otherPmid);
      if (node) paired.push({ node, edge: e });
    }
    paired.sort((a, b) => {
      const sa = a.edge.similarity ?? 0;
      const sb = b.edge.similarity ?? 0;
      if (sa !== sb) return sb - sa;
      return b.node.publication_date.localeCompare(a.node.publication_date);
    });
    return paired;
  }, [nodes, edges, focal.pmid]);

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

        <div className="flex min-h-0 flex-1">
          {/* Graph */}
          <div className="min-w-0 flex-1 overflow-hidden p-2">
            <PaperConnectionGraph
              focal={focal}
              nodes={nodes}
              edges={edges}
              width={720}
              height={600}
              interactive
            />
          </div>

          {/* Side detail rail (desktop only) */}
          <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-gray-200 p-4 dark:border-gray-700 md:block">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              연결 논문 ({items.length})
            </p>
            {items.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500">아직 연결된 논문이 없습니다</p>
            ) : (
              <ul className="space-y-2">
                {items.map((it) => (
                  <RailCard key={it.node.pmid} item={it} onNavigate={onClose} />
                ))}
              </ul>
            )}
          </aside>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 border-t border-gray-200 px-6 py-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
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

function RailCard({ item, onNavigate }: { item: RailItem; onNavigate: () => void }) {
  const { node, edge } = item;
  const year = node.publication_date.slice(0, 4);
  const signals: string[] = [];
  if (edge.type === "bookmark") signals.push("북마크");
  if (edge.type === "citation" || edge.type === "both") signals.push("인용");
  if (edge.type === "mention" || edge.type === "both") signals.push("멘션");
  if (edge.similarity != null) signals.push(`유사도 ${edge.similarity.toFixed(2)}`);
  if (edge.type === "similarity" && edge.similarity == null) signals.push("유사");

  return (
    <li>
      <Link
        href={`/paper/${node.pmid}`}
        onClick={onNavigate}
        className="block rounded-lg border border-gray-100 p-2 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
      >
        <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
          <span
            className="inline-flex rounded px-1.5 text-[10px] font-medium text-white"
            style={{ background: node.journal_color }}
          >
            {node.journal_abbreviation}
          </span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            {year}
            {signals.length > 0 && <> · {signals.join(" · ")}</>}
          </span>
        </div>
        <p className="line-clamp-2 text-xs text-gray-700 dark:text-gray-300">
          {node.title}
        </p>
      </Link>
    </li>
  );
}
