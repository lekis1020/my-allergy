"use client";

import { useState, useCallback, useRef } from "react";
import { Sparkles, Loader2, ChevronDown, ChevronRight } from "lucide-react";

const cache = new Map<string, string>();

interface AbstractSummaryProps {
  abstract: string;
  title: string;
  pmid: string;
  onSummaryGenerated?: (summary: string) => void;
}

/**
 * On-demand structured AI analysis. Rendered as inline content inside the
 * unified AI summary card in `PaperActions` — no outer border/background of
 * its own. The page-level disclaimer at the bottom covers AI-generation
 * caveats, so neither a badge nor a per-card disclaimer is shown here.
 */
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
  }, [abstract, title, pmid, summary, onSummaryGenerated]);

  const buttonLabel = loading
    ? "상세 분석 생성 중..."
    : summary
      ? open
        ? "상세 분석 닫기"
        : "상세 분석 보기"
      : "상세 분석 보기";

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 transition-colors hover:text-blue-800 disabled:opacity-60 dark:text-blue-300 dark:hover:text-blue-200"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        {buttonLabel}
        {summary && !loading && (
          open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )
        )}
      </button>

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {open && summary && (
        <div className="mt-3">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-blue-600/80 dark:text-blue-400/80">
            상세 분석
          </div>
          <div className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            <MarkdownContent content={summary} />
          </div>
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
        <span className="text-blue-400 select-none">•</span>
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
