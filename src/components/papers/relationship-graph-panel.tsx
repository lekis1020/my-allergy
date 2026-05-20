"use client";

import useSWR from "swr";
import { Loader2, Network } from "lucide-react";
import { RelationshipGraph } from "@/components/graph/relationship-graph";
import type { GraphResponse } from "@/lib/graph/types";

const fetcher = async (url: string): Promise<GraphResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`graph fetch failed: ${res.status}`);
  return res.json();
};

interface RelationshipGraphPanelProps {
  // "for_you" + authenticated → per-user graph; otherwise the recent-papers
  // graph (last 90 days) on the Timeline tab.
  activeTab: "timeline" | "for_you";
  isAuthenticated: boolean;
}

export function RelationshipGraphPanel({ activeTab, isAuthenticated }: RelationshipGraphPanelProps) {
  const useAccountGraph = activeTab === "for_you" && isAuthenticated;
  const endpoint = useAccountGraph ? "/api/me/connections" : "/api/connections/recent";

  const { data, error, isLoading } = useSWR<GraphResponse>(endpoint, fetcher, {
    revalidateOnFocus: false,
  });

  return (
    <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
      <h2 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        <Network className="h-3.5 w-3.5" />
        Relationship graph
      </h2>

      {isLoading ? (
        <div className="flex h-[120px] items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-900/50">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : error ? (
        <p className="rounded-xl bg-gray-50 px-3 py-4 text-xs text-gray-400 dark:bg-gray-900/50 dark:text-gray-500">
          관계도를 불러오지 못했습니다.
        </p>
      ) : !data || data.nodes.length === 0 ? (
        <p className="rounded-xl bg-gray-50 px-3 py-6 text-center text-xs text-gray-500 dark:bg-gray-900/50 dark:text-gray-400">
          {useAccountGraph
            ? "북마크·댓글·좋아요한 논문이 모이면 관계도가 그려집니다."
            : "최근 3개월 논문 간 인용·멘션 관계가 아직 없습니다."}
        </p>
      ) : (
        <RelationshipGraph nodes={data.nodes} edges={data.edges} width={680} height={360} />
      )}
    </div>
  );
}
