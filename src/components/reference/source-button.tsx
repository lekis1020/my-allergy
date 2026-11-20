"use client";

import { useState } from "react";
import { SourceCitations } from "@/components/reference/source-citations";
import type { SourceId } from "@/lib/reference/types";

export function SourceButton({
  sourceIds,
  entryId,
  reviewLine,
}: {
  sourceIds: readonly SourceId[];
  entryId: string;
  reviewLine: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="inline-flex min-h-11 items-center rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-800 md:hidden dark:border-gray-700 dark:text-gray-100"
        onClick={() => setOpen(true)}
      >
        Source
      </button>
      {open ? (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close source"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Source"
            className="absolute inset-x-0 bottom-0 z-[70] max-h-[70vh] overflow-y-auto rounded-t-2xl border border-gray-200 bg-white p-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] shadow-xl dark:border-gray-800 dark:bg-gray-950"
          >
            <SourceCitations sourceIds={sourceIds} entryId={entryId} />
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{reviewLine}</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
