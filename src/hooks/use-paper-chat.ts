"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import useSWR from "swr";
import type { ChatMessage } from "@/types/database";

interface ChatUsage {
  papers_today: number;
  queries_this_paper: number;
  max_papers: number;
  max_queries: number;
}

interface ChatSession {
  messages: ChatMessage[];
  usage: ChatUsage;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json()) as Promise<ChatSession>;

export function usePaperChat(pmid: string, isAuthenticated: boolean) {
  const { data: session, mutate } = useSWR<ChatSession>(
    isAuthenticated ? `/api/papers/${pmid}/chat` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<ChatUsage | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Sync DB messages on load
  useEffect(() => {
    if (session?.messages && session.messages.length > 0) {
      setMessages(session.messages);
    }
    if (session?.usage) {
      setUsage(session.usage);
    }
  }, [session]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (isStreaming) return;

      setError(null);
      setIsStreaming(true);
      setStreamingContent("");

      const userMsg: ChatMessage = {
        role: "user",
        content,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`/api/papers/${pmid}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({ error: "요청 실패" }));
          setError(errBody.error);
          setIsStreaming(false);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No reader");

        const decoder = new TextDecoder();
        let accumulated = "";
        let excalidrawData: { elements: unknown[] } | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          const lines = text.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6);
            try {
              const event = JSON.parse(json);
              if (event.type === "text") {
                accumulated += event.content;
                setStreamingContent(accumulated);
              } else if (event.type === "excalidraw") {
                excalidrawData = event.data;
              } else if (event.type === "done") {
                setUsage(event.usage);
              } else if (event.type === "error") {
                setError(event.content);
              }
            } catch {
              // skip invalid JSON
            }
          }
        }

        // Finalize assistant message
        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: accumulated,
          created_at: new Date().toISOString(),
          excalidraw: excalidrawData,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setStreamingContent("");
        mutate();
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("네트워크 오류가 발생했습니다.");
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [pmid, isStreaming, mutate]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    messages,
    streamingContent,
    isStreaming,
    error,
    usage,
    sendMessage,
    stopStreaming,
    isLoading: !session && isAuthenticated,
  };
}
