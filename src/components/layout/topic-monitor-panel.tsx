"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FolderTree, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TOPIC_TREE, BUILTIN_QUERIES } from "@/lib/constants/topics";
import type { TopicCategory, SubTopic } from "@/lib/constants/topics";

const STORAGE_KEY = "my-allergy:topic-monitors";

interface TopicMonitorPanelProps {
  activeQuery?: string;
  onActivate: (topic: string) => void;
  onClearActive: () => void;
}

export function TopicMonitorPanel({
  activeQuery,
  onActivate,
  onClearActive,
}: TopicMonitorPanelProps) {
  const [customTopics, setCustomTopics] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const normalizedActive = normalizeTopic(activeQuery || "");

  // Load custom topics from localStorage (migrating away built-in duplicates)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return;

      const clean = parsed
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter(Boolean)
        .filter((v) => !BUILTIN_QUERIES.has(v.toLowerCase()))
        .slice(0, 30);

      if (clean.length > 0) {
        setCustomTopics(dedupeTopics(clean));
      }

      // Persist migrated list (remove built-in dupes)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    } catch {
      // Ignore malformed localStorage values
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customTopics));
  }, [customTopics]);

  // Auto-expand category that contains the active query
  useEffect(() => {
    if (!normalizedActive) return;
    for (const cat of TOPIC_TREE) {
      const catMatch = normalizeTopic(cat.searchQuery) === normalizedActive;
      const subMatch = cat.subtopics.some(
        (s) => normalizeTopic(s.searchQuery) === normalizedActive
      );
      if (catMatch || subMatch) {
        setExpandedIds((prev) => {
          if (prev.has(cat.id)) return prev;
          const next = new Set(prev);
          next.add(cat.id);
          return next;
        });
        break;
      }
    }
  }, [normalizedActive]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const addCustomTopic = () => {
    const clean = input.trim();
    if (!clean) return;
    if (!BUILTIN_QUERIES.has(clean.toLowerCase())) {
      setCustomTopics((prev) => dedupeTopics([clean, ...prev]).slice(0, 30));
    }
    setInput("");
    onActivate(clean);
  };

  const removeCustomTopic = (topic: string) => {
    const normalized = normalizeTopic(topic);
    setCustomTopics((prev) =>
      prev.filter((item) => normalizeTopic(item) !== normalized)
    );
    if (normalizedActive === normalized) {
      onClearActive();
    }
  };

  const hasActiveMonitor = useMemo(() => {
    // Check built-in topics
    for (const cat of TOPIC_TREE) {
      if (normalizeTopic(cat.searchQuery) === normalizedActive) return true;
      if (cat.subtopics.some((s) => normalizeTopic(s.searchQuery) === normalizedActive))
        return true;
    }
    // Check custom topics
    return customTopics.some((t) => normalizeTopic(t) === normalizedActive);
  }, [normalizedActive, customTopics]);

  return (
    <aside className="space-y-4">
      {/* Topic Tree */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          <FolderTree className="h-4 w-4 text-blue-500" />
          Topics
        </h3>

        <div className="space-y-0.5">
          {TOPIC_TREE.map((category) => (
            <TopicCategoryNode
              key={category.id}
              category={category}
              expanded={expandedIds.has(category.id)}
              activeQuery={normalizedActive}
              onToggle={() => toggleExpand(category.id)}
              onActivate={onActivate}
            />
          ))}
        </div>

        {activeQuery && (
          <button
            onClick={onClearActive}
            className="mt-3 text-xs font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Clear active topic
          </button>
        )}

        {hasActiveMonitor && (
          <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">
            Active: <span className="font-semibold">{activeQuery}</span>
          </p>
        )}
      </section>

      {/* Custom Topics */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
          Custom Topics
        </h4>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Add custom topic…"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustomTopic();
              }
            }}
          />
          <Button variant="secondary" size="sm" onClick={addCustomTopic}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {customTopics.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {customTopics.map((topic) => {
              const isActive = normalizeTopic(topic) === normalizedActive;
              return (
                <div
                  key={topic}
                  className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 ${
                    isActive
                      ? "border-blue-400 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/30"
                      : "border-gray-200 dark:border-gray-800"
                  }`}
                >
                  <button
                    onClick={() => onActivate(topic)}
                    className={`min-w-0 flex-1 truncate text-left text-sm ${
                      isActive
                        ? "font-semibold text-blue-700 dark:text-blue-300"
                        : "text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                    }`}
                    title={topic}
                  >
                    {topic}
                  </button>
                  <button
                    onClick={() => removeCustomTopic(topic)}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                    aria-label={`Remove topic ${topic}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Custom topics are saved in this browser.
        </p>
      </section>
    </aside>
  );
}

/* ─── Sub-components ──────────────────────────────────── */

function TopicCategoryNode({
  category,
  expanded,
  activeQuery,
  onToggle,
  onActivate,
}: {
  category: TopicCategory;
  expanded: boolean;
  activeQuery: string;
  onToggle: () => void;
  onActivate: (topic: string) => void;
}) {
  const isCatActive = normalizeTopic(category.searchQuery) === activeQuery;
  const hasActiveSub = category.subtopics.some(
    (s) => normalizeTopic(s.searchQuery) === activeQuery
  );

  return (
    <div>
      <div className="flex items-center">
        <button
          onClick={onToggle}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          onClick={() => onActivate(category.searchQuery)}
          className={`min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
            isCatActive
              ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              : hasActiveSub
                ? "font-medium text-gray-900 dark:text-gray-100"
                : "text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          }`}
          title={category.label}
        >
          <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${category.colorClass.replace("text-", "bg-")}`} />
          {category.label}
        </button>
      </div>

      {/* Animated expand/collapse */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-in-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="ml-6 border-l border-gray-200 pl-2 dark:border-gray-800">
            {category.subtopics.map((sub) => (
              <SubTopicItem
                key={sub.searchQuery}
                subtopic={sub}
                activeQuery={activeQuery}
                onActivate={onActivate}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SubTopicItem({
  subtopic,
  activeQuery,
  onActivate,
}: {
  subtopic: SubTopic;
  activeQuery: string;
  onActivate: (topic: string) => void;
}) {
  const isActive = normalizeTopic(subtopic.searchQuery) === activeQuery;

  return (
    <button
      onClick={() => onActivate(subtopic.searchQuery)}
      className={`block w-full truncate rounded-lg px-2 py-1 text-left text-[13px] transition-colors ${
        isActive
          ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
      }`}
      title={subtopic.searchQuery}
    >
      {subtopic.label}
    </button>
  );
}

/* ─── Helpers ──────────────────────────────────────────── */

function normalizeTopic(topic: string): string {
  return topic.toLowerCase().replace(/\s+/g, " ").trim();
}

function dedupeTopics(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    const clean = value.trim();
    if (!clean) continue;
    const normalized = normalizeTopic(clean);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(clean);
  }

  return out;
}
