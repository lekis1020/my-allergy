"use client";

import { useState, useCallback, useRef } from "react";
import { Sparkles, Loader2 } from "lucide-react";

const cache = new Map<string, string>();

interface AbstractSummaryProps {
  abstract: string;
  title: string;
  pmid: string;
  onSummaryGenerated?: (summary: string) => void;
}

export function AbstractSummary({ abstract, title, pmid, onSummaryGenerated }: AbstractSummaryProps) {
  const [summary, setSummary] = useState<string | null>(
    cache.get(pmid) ?? null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(!!cache.get(pmid));
  const fetchedRef = useRef(false);

  const handleClick = useCallback(async () => {
    if (summary) {
      setOpen((v) => !v);
      return;
    }
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ abstract, title }),
      });
      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }
      const data = await res.json();
      cache.set(pmid, data.summary);
      setSummary(data.summary);
      setOpen(true);
      onSummaryGenerated?.(data.summary);
    } catch (err) {
      fetchedRef.current = false;
      setError(err instanceof Error ? err.message : "요약 생성에 실패했습니다");
    } finally {
      setLoading(false);
    }
  }, [abstract, title, pmid, summary]);

  return (
    <div className="mt-4">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-purple-300 bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-100 disabled:opacity-60 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-300 dark:hover:bg-purple-900"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {loading ? "요약 생성 중..." : summary ? (open ? "요약 닫기" : "요약 보기") : "AI 요약"}
      </button>

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {open && summary && (
        <div className="mt-3 rounded-xl border border-purple-200 bg-purple-50/50 p-4 text-sm leading-relaxed text-gray-800 dark:border-purple-800 dark:bg-purple-950/50 dark:text-gray-200">
          <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-900/60 dark:text-purple-300">
            <Sparkles className="h-2.5 w-2.5" />
            AI 생성
          </div>
          <MarkdownContent content={summary} />
          <p className="mt-3 border-t border-purple-200/60 pt-2 text-[11px] leading-relaxed text-gray-500 dark:border-purple-800/40 dark:text-gray-400">
            ⚠️ AI가 자동 생성한 요약이며 오류가 있을 수 있습니다. 의학적 판단의 근거로 사용하지 마시고, 원문을 직접 확인하세요. 본 정보는 의료 조언을 대체하지 않습니다.
          </p>
        </div>
      )}
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => (
        <MarkdownLine key={i} line={line} />
      ))}
    </div>
  );
}

function MarkdownLine({ line }: { line: string }) {
  if (!line.trim()) return <div className="h-2" />;

  const formatted = formatInline(line);

  if (line.startsWith("- ") || line.startsWith("  - ")) {
    const indent = line.startsWith("  - ") ? "ml-4" : "";
    return (
      <div className={`flex gap-1.5 ${indent}`}>
        <span className="text-purple-400 select-none">•</span>
        <span dangerouslySetInnerHTML={{ __html: formatted }} />
      </div>
    );
  }

  return <div dangerouslySetInnerHTML={{ __html: formatted }} />;
}

function formatInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}
