"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, Send, Square, Sparkles, FlaskConical, AlertTriangle, Lock, Loader2, Maximize2, Minimize2, Download } from "lucide-react";
import { usePaperChat } from "@/hooks/use-paper-chat";
import { ChatMessage } from "./chat-message";
import { QUICK_ACTIONS } from "@/lib/gemini/prompts";
import { useAuth } from "@/hooks/use-auth";

interface PaperChatProps {
  pmid: string;
  isOa: boolean;
}

export function PaperChat({ pmid, isOa }: PaperChatProps) {
  const { user } = useAuth();
  const {
    messages,
    streamingContent,
    isStreaming,
    error,
    usage,
    sendMessage,
    stopStreaming,
    isLoading,
  } = usePaperChat(pmid, !!user);

  const [input, setInput] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const exportAsMarkdown = () => {
    const lines = messages.map((m) =>
      m.role === "user" ? `**Q:** ${m.content}` : `**A:** ${m.content}`
    );
    const md = `# AI Paper Chat — PMID ${pmid}\n\n${lines.join("\n\n---\n\n")}\n`;
    const blob = new Blob([md], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `chat-${pmid}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    setShowExport(false);
  };

  const exportAsPdf = () => {
    const lines = messages.map((m) =>
      m.role === "user"
        ? `<div style="margin:12px 0"><strong>Q:</strong> ${m.content.replace(/\n/g, "<br>")}</div>`
        : `<div style="margin:12px 0;color:#333"><strong>A:</strong> ${m.content.replace(/\n/g, "<br>")}</div>`
    );
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Chat — PMID ${pmid}</title><style>body{font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;padding:0 20px;font-size:14px;line-height:1.6}h1{font-size:18px}hr{border:none;border-top:1px solid #ddd;margin:16px 0}</style></head><body><h1>AI Paper Chat — PMID ${pmid}</h1>${lines.join("<hr>")}</body></html>`;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 300);
    }
    setShowExport(false);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  if (!isOa) return null;

  if (!user) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          AI Paper Chat
        </h2>
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <Lock className="h-6 w-6 text-gray-400" />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            로그인 후 AI Chat을 이용할 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  const canSend = !isStreaming && input.trim().length > 0 &&
    (usage ? usage.queries_this_paper < usage.max_queries : true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    sendMessage(input.trim());
    setInput("");
  };

  const handleQuickAction = (action: keyof typeof QUICK_ACTIONS) => {
    if (isStreaming) return;
    sendMessage(QUICK_ACTIONS[action]);
  };

  const chatContent = (
    <>
      {/* Quick actions */}
      {messages.length === 0 && !isStreaming && (
        <div className="flex flex-wrap gap-1.5 border-b border-gray-200 px-3 py-2 dark:border-gray-800">
          <button
            onClick={() => handleQuickAction("summary")}
            className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <Sparkles className="h-3 w-3" />
            원문 요약
          </button>
          <button
            onClick={() => handleQuickAction("methods")}
            className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <FlaskConical className="h-3 w-3" />
            연구 방법
          </button>
          <button
            onClick={() => handleQuickAction("limitations")}
            className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <AlertTriangle className="h-3 w-3" />
            한계점
          </button>
        </div>
      )}

      {/* Messages */}
      <div className={`space-y-3 overflow-y-auto px-3 py-3 ${expanded ? "flex-1" : "max-h-96"}`}>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : messages.length === 0 && !isStreaming ? (
          <p className="py-4 text-center text-xs text-gray-400">
            논문에 대해 무엇이든 질문해 보세요.
          </p>
        ) : (
          <>
            {messages.map((msg, i) => (
              <ChatMessage key={i} message={msg} />
            ))}
            {streamingContent && (
              <ChatMessage
                message={{
                  role: "assistant",
                  content: streamingContent,
                  created_at: new Date().toISOString(),
                }}
              />
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-3 mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-gray-200 px-3 py-2 dark:border-gray-800">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="질문을 입력하세요..."
            rows={expanded ? 2 : 1}
            className="flex-1 resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            disabled={isStreaming || (usage?.queries_this_paper ?? 0) >= 10}
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={stopStreaming}
              className="rounded-lg bg-red-500 p-2 text-white hover:bg-red-600"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              className="rounded-lg bg-blue-600 p-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <div className="text-[10px] text-gray-400 dark:text-gray-500">
            {usage && (
              <span>질의 {usage.queries_this_paper}/{usage.max_queries} · 오늘 논문 {usage.papers_today}/{usage.max_papers}</span>
            )}
            <span className={usage ? " · " : ""}>대화 기록은 30일간 보관됩니다</span>
          </div>
          {messages.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExport(!showExport)}
                className="inline-flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                <Download className="h-3 w-3" />
                내보내기
              </button>
              {showExport && (
                <div className="absolute bottom-6 right-0 z-10 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  <button
                    type="button"
                    onClick={exportAsMarkdown}
                    className="block w-full whitespace-nowrap px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Markdown (.md)
                  </button>
                  <button
                    type="button"
                    onClick={exportAsPdf}
                    className="block w-full whitespace-nowrap px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    PDF (인쇄)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </form>
    </>
  );

  const header = (
    <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5 dark:border-gray-800">
      <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        <Bot className="h-3.5 w-3.5" />
        AI Paper Chat
      </h2>
      <button
        onClick={() => setExpanded(!expanded)}
        className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        title={expanded ? "축소" : "확대"}
      >
        {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
      </button>
    </div>
  );

  if (expanded) {
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setExpanded(false)}
        />
        {/* Modal */}
        <div className="fixed inset-4 z-50 flex flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-950 sm:inset-8 md:inset-16 lg:inset-24">
          {header}
          {chatContent}
        </div>
      </>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50">
      {header}
      {chatContent}
    </div>
  );
}
