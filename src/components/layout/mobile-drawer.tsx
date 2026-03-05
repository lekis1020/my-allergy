"use client";

import { useEffect, useCallback, useState } from "react";
import { X, FolderTree, BarChart3 } from "lucide-react";
import { TopicMonitorPanel } from "@/components/layout/topic-monitor-panel";
import { RightRail } from "@/components/layout/right-rail";
import type { PaperWithJournal } from "@/types/filters";

type Tab = "topics" | "insights";

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  // TopicMonitorPanel props
  activeQuery?: string;
  onActivate: (topic: string) => void;
  onClearActive: () => void;
  // RightRail props
  total: number;
  papers: PaperWithJournal[];
}

export function MobileDrawer({
  open,
  onClose,
  activeQuery,
  onActivate,
  onClearActive,
  total,
  papers,
}: MobileDrawerProps) {
  const [tab, setTab] = useState<Tab>("topics");

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close on ESC
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-[70] flex w-80 max-w-[85vw] flex-col bg-white transition-transform duration-200 ease-out dark:bg-gray-950 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation drawer"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Menu
          </span>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 border-b border-gray-200 text-sm dark:border-gray-800">
          <button
            onClick={() => setTab("topics")}
            className={`flex items-center justify-center gap-1.5 border-b-2 py-2.5 font-medium transition-colors ${
              tab === "topics"
                ? "border-blue-500 text-gray-900 dark:text-gray-100"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            <FolderTree className="h-3.5 w-3.5" />
            Topics
          </button>
          <button
            onClick={() => setTab("insights")}
            className={`flex items-center justify-center gap-1.5 border-b-2 py-2.5 font-medium transition-colors ${
              tab === "insights"
                ? "border-blue-500 text-gray-900 dark:text-gray-100"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Insights
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === "topics" ? (
            <TopicMonitorPanel
              activeQuery={activeQuery}
              onActivate={onActivate}
              onClearActive={onClearActive}
            />
          ) : (
            <RightRail total={total} papers={papers} />
          )}
        </div>
      </div>
    </>
  );
}
