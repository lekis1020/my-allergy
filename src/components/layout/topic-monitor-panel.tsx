"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "my-allergy:topic-monitors";
const DEFAULT_TOPICS = [
  "asthma",
  "rhinitis",
  "urticaria",
  "atopic dermatitis",
  "drug allergy",
  "food allergy",
  "eosinophilic disorders",
  "immunodeficiency",
];

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
  const [topics, setTopics] = useState<string[]>(DEFAULT_TOPICS);
  const [input, setInput] = useState("");
  const normalizedActive = normalizeTopic(activeQuery || "");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return;

      const clean = parsed
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 30);

      if (clean.length > 0) {
        setTopics(dedupeTopics(clean));
      }
    } catch {
      // Ignore malformed localStorage values
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(topics));
  }, [topics]);

  const hasActiveMonitor = useMemo(
    () => topics.some((topic) => normalizeTopic(topic) === normalizedActive),
    [topics, normalizedActive]
  );

  const addTopic = () => {
    const clean = input.trim();
    if (!clean) return;
    setTopics((prev) => dedupeTopics([clean, ...prev]).slice(0, 30));
    setInput("");
    onActivate(clean);
  };

  const removeTopic = (topic: string) => {
    const normalized = normalizeTopic(topic);
    setTopics((prev) => prev.filter((item) => normalizeTopic(item) !== normalized));
    if (normalizeTopic(activeQuery || "") === normalized) {
      onClearActive();
    }
  };

  const applyTopic = (topic: string) => {
    onActivate(topic);
  };

  return (
    <aside className="space-y-4">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          <BellRing className="h-4 w-4 text-blue-500" />
          Topic Monitor
        </h3>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Add topic (e.g. food allergy)"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addTopic();
              }
            }}
          />
          <Button variant="secondary" size="sm" onClick={addTopic}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Click a topic to load its timeline. Topics are saved in this browser.
        </p>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Saved Topics</h4>
          {activeQuery && (
            <button
              onClick={onClearActive}
              className="text-xs font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Clear active
            </button>
          )}
        </div>

        <div className="space-y-2">
          {topics.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">No topics yet.</p>
          )}

          {topics.map((topic) => {
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
                  onClick={() => applyTopic(topic)}
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
                  onClick={() => removeTopic(topic)}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                  aria-label={`Remove topic ${topic}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {hasActiveMonitor && (
          <p className="mt-3 text-xs text-blue-700 dark:text-blue-300">
            Monitoring: <span className="font-semibold">{activeQuery}</span>
          </p>
        )}
      </section>
    </aside>
  );
}

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
