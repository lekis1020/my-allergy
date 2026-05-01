"use client";

import { useState } from "react";
import useSWR from "swr";
import { Network, Loader2 } from "lucide-react";
import { PaperConnectionGraph } from "./paper-connection-graph";
import { ConnectionGraphModal } from "./connection-graph-modal";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ConnectionsData {
  focal: { pmid: string; title: string; journal_abbreviation: string; journal_color: string };
  nodes: Array<{ pmid: string; title: string; journal_abbreviation: string; journal_color: string; publication_date: string }>;
  edges: Array<{
    source: string; target: string;
    type: "citation" | "mention" | "both";
    direction: "references" | "cited_by" | "bidirectional";
    mentions: Array<{ comment_id: string; anon_id: string; content_snippet: string; created_at: string }>;
  }>;
}

interface ConnectionGraphPreviewProps {
  pmid: string;
}

export function ConnectionGraphPreview({ pmid }: ConnectionGraphPreviewProps) {
  const { data, isLoading } = useSWR<ConnectionsData>(
    `/api/papers/${pmid}/connections`,
    fetcher,
    { revalidateOnFocus: false }
  );
  const [modalOpen, setModalOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-900/50">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data || (data.nodes.length === 0 && data.edges.length === 0)) {
    return null;
  }

  const totalConnections = data.edges.length;
  const citationCount = data.edges.filter((e) => e.type === "citation" || e.type === "both").length;
  const mentionCount = data.edges.filter((e) => e.type === "mention" || e.type === "both").length;

  return (
    <>
      <div
        onClick={() => setModalOpen(true)}
        className="cursor-pointer rounded-2xl border border-gray-200 bg-gray-50 p-4 transition-colors hover:border-blue-300 hover:bg-blue-50/50 dark:border-gray-800 dark:bg-gray-900/50 dark:hover:border-blue-700 dark:hover:bg-blue-950/20"
      >
        <h2 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          <Network className="h-3.5 w-3.5" />
          Connections
        </h2>

        <div className="mb-3 overflow-hidden rounded-lg">
          <PaperConnectionGraph
            focal={data.focal}
            nodes={data.nodes}
            edges={data.edges}
            width={280}
            height={180}
            interactive={false}
          />
        </div>

        <p className="text-xs text-gray-600 dark:text-gray-300">
          <span className="font-medium">{totalConnections}</span>개 논문 연결
          {citationCount > 0 && <span className="text-gray-400"> · 인용 {citationCount}</span>}
          {mentionCount > 0 && <span className="text-blue-500"> · 멘션 {mentionCount}</span>}
        </p>
        <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
          클릭하여 확대
        </p>
      </div>

      {modalOpen && (
        <ConnectionGraphModal
          focal={data.focal}
          nodes={data.nodes}
          edges={data.edges}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
