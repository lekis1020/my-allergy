"use client";

import Link from "next/link";
import { X } from "lucide-react";
import type { PaperNode, PaperEdge } from "@/lib/graph/types";

interface DetailSheetProps {
  focused: PaperNode;
  neighbors: { node: PaperNode; edge: PaperEdge }[];
  onClose: () => void;
}

/**
 * The right-side sheet for the `highlight` view of the relationship panel.
 *
 * On desktop it renders inline next to the graph (consumer positions it).
 * On mobile it should be wrapped in a bottom-sheet container by the parent.
 */
export function DetailSheet({ focused, neighbors, onClose }: DetailSheetProps) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Selected paper
          </p>
          <h3 className="mt-1 line-clamp-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
            {focused.title}
          </h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            <span style={{ color: focused.journal_color }} className="font-semibold">
              {focused.journal_abbreviation}
            </span>
            <span className="mx-1">·</span>
            <span>{focused.publication_date}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close detail"
          className="rounded-full p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <Link
        href={`/paper/${focused.pmid}`}
        className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        Open paper →
      </Link>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Neighbors ({neighbors.length})
        </p>
        {neighbors.length === 0 ? (
          <p className="text-xs text-gray-500">No connected papers in this view.</p>
        ) : (
          <ul className="space-y-2">
            {neighbors.map(({ node, edge }) => (
              <li key={node.pmid} className="text-xs">
                <Link href={`/paper/${node.pmid}`} className="block hover:underline">
                  <span style={{ color: node.journal_color }} className="font-semibold">
                    [{node.journal_abbreviation}]
                  </span>{" "}
                  <span className="text-gray-800 dark:text-gray-200">{node.title}</span>
                </Link>
                <p className="text-[10px] text-gray-500">
                  {edge.types.join(" · ")} · w {edge.weight.toFixed(1)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
