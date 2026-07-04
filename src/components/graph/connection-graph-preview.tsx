"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Network, Loader2, Maximize2 } from "lucide-react";
import { PaperConnectionGraph } from "./paper-connection-graph";
import { ConnectionGraphModal } from "./connection-graph-modal";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type EdgeType = "citation" | "mention" | "both" | "similarity" | "bookmark";

interface ConnectionEdge {
  source: string;
  target: string;
  type: EdgeType;
  direction: "references" | "cited_by" | "bidirectional";
  mentions: Array<{ comment_id: string; anon_id: string; content_snippet: string; created_at: string }>;
  similarity?: number;
}

interface ConnectionsData {
  requiresAuth?: boolean;
  focal: { pmid: string; title: string; journal_abbreviation: string; journal_color: string };
  nodes: Array<{ pmid: string; title: string; journal_abbreviation: string; journal_color: string; publication_date: string }>;
  edges: ConnectionEdge[];
}

interface ConnectionGraphPreviewProps {
  pmid: string;
}

export function ConnectionGraphPreview({ pmid }: ConnectionGraphPreviewProps) {
  const [mode, setMode] = useState<"all" | "mine">("all");
  const [modalOpen, setModalOpen] = useState(false);

  const key =
    mode === "all"
      ? `/api/papers/${pmid}/connections`
      : `/api/papers/${pmid}/my-connections`;

  const { data, isLoading } = useSWR<ConnectionsData>(key, fetcher, {
    revalidateOnFocus: false,
  });

  const hasGraph = !!data && (data.nodes.length > 0 || data.edges.length > 0);

  function openModal() {
    if (hasGraph) setModalOpen(true);
  }

  return (
    <>
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <Network className="h-3.5 w-3.5" />
            Relationship graph
          </h2>
          <button
            type="button"
            onClick={openModal}
            disabled={!hasGraph}
            className="inline-flex items-center gap-1 text-[11px] text-gray-400 transition-colors hover:text-gray-600 disabled:cursor-default disabled:opacity-40 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <Maximize2 className="h-3 w-3" />
            확대
          </button>
        </div>

        {/* Mode toggle */}
        <div className="mb-3 inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-[11px] dark:border-gray-700 dark:bg-gray-800">
          <button
            type="button"
            onClick={() => setMode("all")}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              mode === "all"
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
            }`}
          >
            전체 관계도
          </button>
          <button
            type="button"
            onClick={() => setMode("mine")}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              mode === "mine"
                ? "bg-violet-600 text-white"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
            }`}
          >
            내 관계도
          </button>
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : mode === "mine" && data?.requiresAuth ? (
          <div className="flex flex-col items-center gap-3 rounded-lg py-8 text-center">
            <span className="text-2xl">🔖</span>
            <p className="px-2 text-xs text-gray-500 dark:text-gray-400">
              로그인하고 논문을 북마크·댓글하면 나만의 관계도가 쌓입니다
            </p>
            <Link
              href="/login"
              className="inline-flex items-center rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-700"
            >
              로그인
            </Link>
          </div>
        ) : !hasGraph ? (
          <div className="flex items-center justify-center py-10 text-center">
            <p className="px-2 text-xs text-gray-400 dark:text-gray-500">
              {mode === "mine"
                ? "아직 내 활동으로 쌓인 관계가 없어요"
                : "아직 연결된 논문이 없습니다"}
            </p>
          </div>
        ) : (
          <>
            <div
              onClick={openModal}
              className="mb-3 cursor-pointer overflow-hidden rounded-lg"
            >
              <PaperConnectionGraph
                focal={data!.focal}
                nodes={data!.nodes}
                edges={data!.edges}
                width={280}
                height={180}
                interactive={false}
              />
            </div>
            <Summary mode={mode} edges={data!.edges} />
            <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">클릭하여 확대</p>
          </>
        )}
      </div>

      {modalOpen && hasGraph && (
        <ConnectionGraphModal
          focal={data!.focal}
          nodes={data!.nodes}
          edges={data!.edges}
          mode={mode}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

function Summary({ mode, edges }: { mode: "all" | "mine"; edges: ConnectionEdge[] }) {
  const total = edges.length;

  if (mode === "mine") {
    const bookmarkCount = edges.filter((e) => e.type === "bookmark").length;
    const mentionCount = edges.filter((e) => e.type === "mention" || e.type === "both").length;
    return (
      <p className="text-xs text-gray-600 dark:text-gray-300">
        <span className="font-medium">{total}</span>개 연결
        {bookmarkCount > 0 && <span className="text-amber-500"> · 북마크 {bookmarkCount}</span>}
        {mentionCount > 0 && <span className="text-blue-500"> · 멘션 {mentionCount}</span>}
      </p>
    );
  }

  const similarityCount = edges.filter(
    (e) => e.similarity != null || e.type === "similarity"
  ).length;
  const citationCount = edges.filter((e) => e.type === "citation" || e.type === "both").length;
  const mentionCount = edges.filter((e) => e.type === "mention" || e.type === "both").length;

  return (
    <p className="text-xs text-gray-600 dark:text-gray-300">
      <span className="font-medium">{total}</span>개 논문 연결
      {similarityCount > 0 && <span className="text-teal-500"> · 유사 {similarityCount}</span>}
      {citationCount > 0 && <span className="text-gray-400"> · 인용 {citationCount}</span>}
      {mentionCount > 0 && <span className="text-blue-500"> · 멘션 {mentionCount}</span>}
    </p>
  );
}
