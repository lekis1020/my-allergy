"use client";

import { Sparkles } from "lucide-react";
import { AbstractSummary } from "@/components/papers/abstract-summary";

interface PaperActionsProps {
  pmid: string;
  abstract: string | null;
  title: string;
  aiSummary: string | null;
}

/**
 * Unified AI summary card: pre-stored "한 줄 요약" (paper.ai_summary) on top,
 * on-demand "상세 분석" toggle below, both inside the same blue card.
 * AI-generation disclaimer is intentionally NOT shown here — a single
 * consolidated disclaimer sits at the bottom of the page.
 */
export function PaperActions({ pmid, abstract, title, aiSummary }: PaperActionsProps) {
  // Nothing to render if neither a pre-stored summary nor an abstract is available.
  if (!aiSummary && !abstract) return null;

  return (
    <section className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50/50 p-5 dark:border-blue-800/50 dark:from-blue-950/40 dark:to-indigo-950/30">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          <Sparkles className="h-4 w-4 text-blue-500" />
          AI 요약
        </h2>
      </div>

      {aiSummary && (
        <div>
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-blue-600/80 dark:text-blue-400/80">
            한 줄 요약
          </div>
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {aiSummary}
          </p>
        </div>
      )}

      {abstract && (
        <div
          className={
            aiSummary
              ? "mt-4 border-t border-blue-200/60 pt-3 dark:border-blue-800/40"
              : ""
          }
        >
          <AbstractSummary
            abstract={abstract}
            title={title}
            pmid={pmid}
          />
        </div>
      )}
    </section>
  );
}
