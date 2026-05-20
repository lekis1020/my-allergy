"use client";

import { useState } from "react";
import { SearchInput } from "@/components/papers/search-input";
import { TopicMonitorPanel } from "@/components/layout/topic-monitor-panel";
import { JournalFilterPanel } from "@/components/layout/journal-filter-panel";
import { JOURNALS } from "@/lib/constants/journals";

type SidebarTab = "topics" | "journals";

interface HomeSidebarProps {
  query: string;
  onQueryChange: (q: string) => void;
  activeJournals: string[];
  onToggleJournal: (slug: string) => void;
  onClearJournals: () => void;
  onActivateTopic: (topic: string) => void;
  onClearActiveTopic: () => void;
}

export function HomeSidebar({
  query,
  onQueryChange,
  activeJournals,
  onToggleJournal,
  onClearJournals,
  onActivateTopic,
  onClearActiveTopic,
}: HomeSidebarProps) {
  const [tab, setTab] = useState<SidebarTab>("topics");

  const tabClass = (isActive: boolean) =>
    `flex-1 border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
      isActive
        ? "border-blue-500 text-gray-900 dark:text-gray-100"
        : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
    }`;

  return (
    <div className="space-y-4">
      <SearchInput
        value={query}
        onChange={onQueryChange}
        placeholder="Search topic, PMID, DOI"
      />

      <div>
        <div className="flex">
          <button onClick={() => setTab("topics")} className={tabClass(tab === "topics")}>
            Topics
          </button>
          <button onClick={() => setTab("journals")} className={tabClass(tab === "journals")}>
            Journals{activeJournals.length > 0 ? ` (${activeJournals.length})` : ""}
          </button>
        </div>

        <div className="pt-3">
          {tab === "topics" ? (
            <TopicMonitorPanel
              activeQuery={query}
              onActivate={onActivateTopic}
              onClearActive={onClearActiveTopic}
            />
          ) : (
            <JournalFilterPanel
              journals={JOURNALS}
              activeJournals={activeJournals}
              onToggle={onToggleJournal}
              onClearAll={onClearJournals}
            />
          )}
        </div>
      </div>
    </div>
  );
}
