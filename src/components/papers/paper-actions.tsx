"use client";

import { useState, useCallback } from "react";
import { AbstractSummary } from "@/components/papers/abstract-summary";
import { BookmarkButton } from "@/components/papers/bookmark-button";

interface PaperActionsProps {
  pmid: string;
  abstract: string;
  title: string;
}

export function PaperActions({ pmid, abstract, title }: PaperActionsProps) {
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  const handleSummaryGenerated = useCallback((summary: string) => {
    setAiSummary(summary);
  }, []);

  return (
    <div className="mt-6 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          AI 요약
        </h2>
        <BookmarkButton pmid={pmid} size="md" aiSummary={aiSummary} />
      </div>
      <AbstractSummary
        abstract={abstract}
        title={title}
        pmid={pmid}
        onSummaryGenerated={handleSummaryGenerated}
      />
    </div>
  );
}
