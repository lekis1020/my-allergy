# Full-Text AI Paper Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI-powered full-text paper chat with Excalidraw visualization for Open Access papers, backed by Gemini 2.5 Flash, with chat history saved in a unified History tab.

**Architecture:** OA PDF URLs from Unpaywall are fetched and the PDF binary is sent directly to Gemini 2.5 Flash with conversation context. Responses stream via SSE. Excalidraw JSON blocks in AI responses are rendered inline. Chat sessions persist in `chat_sessions` table. The existing Bookmarks tab becomes History, combining bookmarks and chat history.

**Tech Stack:** Gemini 2.5 Flash (`@google/generative-ai`), Excalidraw (`@excalidraw/excalidraw`), Supabase, Next.js 16 App Router, SSE streaming, Tailwind CSS v4

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/00027_create_chat_tables.sql` | chat_sessions + chat_usage tables |
| Create | `src/lib/gemini/client.ts` | Gemini client singleton + PDF cache |
| Create | `src/lib/gemini/prompts.ts` | System prompts for paper chat |
| Create | `src/app/api/papers/[pmid]/chat/route.ts` | POST (chat + stream) + GET (load session) |
| Create | `src/app/api/chat/history/route.ts` | GET chat history list for History tab |
| Create | `src/components/chat/paper-chat.tsx` | Main chat panel component |
| Create | `src/components/chat/chat-message.tsx` | Single message renderer (markdown + excalidraw) |
| Create | `src/components/chat/excalidraw-block.tsx` | Excalidraw inline viewer/editor |
| Create | `src/hooks/use-paper-chat.ts` | Chat state management + SSE hook |
| Modify | `src/app/paper/[pmid]/page.tsx` | Add chat panel to sidebar |
| Modify | `src/app/bookmarks/page.tsx` | Rename to History + add chat sessions |
| Modify | `src/components/layout/header.tsx` | Bookmarks → History nav link |
| Modify | `src/components/layout/mobile-bottom-nav.tsx` | Bookmarks → History |
| Modify | `src/types/supabase.ts` | Add chat_sessions + chat_usage types |
| Modify | `src/types/database.ts` | Add ChatSession + ChatUsage aliases |

---

### Task 1: DB Migration — chat_sessions + chat_usage

**Files:**
- Create: `supabase/migrations/00027_create_chat_tables.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 00027_create_chat_tables.sql
-- Chat sessions for AI paper Q&A and rate limiting

CREATE TABLE chat_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paper_pmid TEXT NOT NULL,
  messages   JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, paper_pmid)
);

CREATE INDEX idx_chat_sessions_user ON chat_sessions (user_id, updated_at DESC);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own chat sessions"
  ON chat_sessions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users update own chat sessions"
  ON chat_sessions FOR UPDATE USING (auth.uid() = user_id);

-- No INSERT/DELETE policy: service role only

CREATE TABLE chat_usage (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paper_pmid TEXT NOT NULL,
  used_at    DATE NOT NULL DEFAULT CURRENT_DATE,
  count      INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, paper_pmid, used_at)
);

ALTER TABLE chat_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own chat usage"
  ON chat_usage FOR SELECT USING (auth.uid() = user_id);
```

- [ ] **Step 2: Apply migration**

Run: `npx supabase db push`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00027_create_chat_tables.sql
git commit -m "feat: add chat_sessions and chat_usage tables"
```

---

### Task 2: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

```bash
cd /Users/napler/projects/my-allergy
npm install @google/generative-ai @excalidraw/excalidraw
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @google/generative-ai and @excalidraw/excalidraw"
```

---

### Task 3: Update Supabase types

**Files:**
- Modify: `src/types/supabase.ts`
- Modify: `src/types/database.ts`

- [ ] **Step 1: Add chat_sessions type to supabase.ts**

In `src/types/supabase.ts`, inside `public.Tables`, add:

```typescript
      chat_sessions: {
        Row: {
          id: string
          user_id: string
          paper_pmid: string
          messages: import("./database").ChatMessage[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          paper_pmid: string
          messages?: import("./database").ChatMessage[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          paper_pmid?: string
          messages?: import("./database").ChatMessage[]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_usage: {
        Row: {
          user_id: string
          paper_pmid: string
          used_at: string
          count: number
        }
        Insert: {
          user_id: string
          paper_pmid: string
          used_at?: string
          count?: number
        }
        Update: {
          user_id?: string
          paper_pmid?: string
          used_at?: string
          count?: number
        }
        Relationships: []
      }
```

- [ ] **Step 2: Update database.ts**

Add to `src/types/database.ts`:

```typescript
export type ChatSession = Database["public"]["Tables"]["chat_sessions"]["Row"];
export type ChatUsage = Database["public"]["Tables"]["chat_usage"]["Row"];

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  created_at: string;
  excalidraw?: { elements: unknown[] } | null;
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/types/supabase.ts src/types/database.ts
git commit -m "feat: add ChatSession and ChatUsage types"
```

---

### Task 4: Gemini client + PDF cache + prompts

**Files:**
- Create: `src/lib/gemini/client.ts`
- Create: `src/lib/gemini/prompts.ts`

- [ ] **Step 1: Create Gemini client with PDF cache**

Create `src/lib/gemini/client.ts`:

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

let client: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (!client) {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
    }
    client = new GoogleGenerativeAI(apiKey);
  }
  return client;
}

// In-memory PDF cache with 10-minute TTL
const pdfCache = new Map<string, { buffer: ArrayBuffer; expiry: number }>();
const PDF_CACHE_TTL_MS = 10 * 60 * 1000;

export async function fetchPdfBuffer(pdfUrl: string, pmid: string): Promise<ArrayBuffer> {
  const cached = pdfCache.get(pmid);
  if (cached && cached.expiry > Date.now()) {
    return cached.buffer;
  }

  const response = await fetch(pdfUrl, {
    headers: { accept: "application/pdf" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  pdfCache.set(pmid, { buffer, expiry: Date.now() + PDF_CACHE_TTL_MS });

  // Evict expired entries
  for (const [key, val] of pdfCache) {
    if (val.expiry < Date.now()) pdfCache.delete(key);
  }

  return buffer;
}
```

- [ ] **Step 2: Create system prompts**

Create `src/lib/gemini/prompts.ts`:

```typescript
export const PAPER_CHAT_SYSTEM_PROMPT = `당신은 알레르기/임상면역학 분야 연구 논문 분석 전문가입니다.
첨부된 PDF 논문 원문을 기반으로 질문에 답변하세요.

규칙:
- 논문 내용에 근거한 답변만 제공
- 근거가 없으면 "논문에 해당 내용이 없습니다"라고 답변
- 한국어로 답변
- 수치, 통계, 결과는 정확하게 인용
- 마크다운 형식 사용 (볼드, 불릿, 테이블 등)

도식화 요청 시:
- 텍스트 설명을 먼저 작성한 후, Excalidraw JSON을 \`\`\`excalidraw 코드 블록으로 포함하세요
- JSON 형식: { "elements": [...] }
- 요소 타입: rectangle, ellipse, diamond, arrow, text
- 각 요소에 id, type, x, y, width, height, strokeColor, backgroundColor, text(해당 시) 포함
- 색상: 파스텔 계열 (#a5d8ff, #b2f2bb, #ffec99, #ffc9c9, #d0bfff)
- 연구 흐름은 상→하 또는 좌→우 배치
- arrow 요소로 흐름 연결 (startBinding, endBinding 사용)`;

export const QUICK_ACTIONS = {
  summary: "이 논문의 전체 내용을 구조화하여 요약해줘. 배경, 방법, 결과, 결론 순서로 정리하고 핵심 수치를 포함해줘.",
  methods: "이 논문의 연구 방법론을 상세히 설명해줘. 연구 설계, 대상 모집, 실험 절차, 통계 분석 방법을 포함해줘.",
  limitations: "이 논문의 한계점과 향후 연구 방향을 분석해줘. 저자가 언급한 한계와 추가로 발견되는 한계를 구분해줘.",
} as const;
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/gemini/client.ts src/lib/gemini/prompts.ts
git commit -m "feat: add Gemini client with PDF cache and system prompts"
```

---

### Task 5: POST /api/papers/[pmid]/chat — streaming chat API

**Files:**
- Create: `src/app/api/papers/[pmid]/chat/route.ts`

- [ ] **Step 1: Create the chat API route**

Create `src/app/api/papers/[pmid]/chat/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient, createServiceClient } from "@/lib/supabase/server";
import { findOpenAccessPdf } from "@/lib/pubmed/open-access";
import { getGeminiClient, fetchPdfBuffer } from "@/lib/gemini/client";
import { PAPER_CHAT_SYSTEM_PROMPT } from "@/lib/gemini/prompts";
import type { ChatMessage } from "@/types/database";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pmid: string }> }
) {
  const { pmid } = await params;
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse request
  const body = await request.json().catch(() => null);
  const userMessage = body?.message as string | undefined;
  if (!userMessage || userMessage.trim().length === 0) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  // Rate limit check
  const today = new Date().toISOString().slice(0, 10);

  // Check per-paper limit
  const { data: paperUsage } = await serviceClient
    .from("chat_usage")
    .select("count")
    .eq("user_id", user.id)
    .eq("paper_pmid", pmid)
    .eq("used_at", today)
    .single();

  if (paperUsage && paperUsage.count >= 10) {
    return NextResponse.json(
      { error: "이 논문의 일일 질의 한도(10회)를 초과했습니다.", limit_type: "paper" },
      { status: 429 }
    );
  }

  // Check daily paper limit
  if (!paperUsage) {
    const { count } = await serviceClient
      .from("chat_usage")
      .select("paper_pmid", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("used_at", today);

    if ((count ?? 0) >= 10) {
      return NextResponse.json(
        { error: "일일 논문 한도(10건)를 초과했습니다.", limit_type: "daily" },
        { status: 429 }
      );
    }
  }

  // Check OA status
  const { data: paper } = await supabase
    .from("papers")
    .select("doi")
    .eq("pmid", pmid)
    .single();

  if (!paper) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  const openAccess = await findOpenAccessPdf(paper.doi);
  if (!openAccess?.pdfUrl) {
    return NextResponse.json(
      { error: "이 논문은 Open Access가 아닙니다." },
      { status: 403 }
    );
  }

  // Fetch PDF
  let pdfBuffer: ArrayBuffer;
  try {
    pdfBuffer = await fetchPdfBuffer(openAccess.pdfUrl, pmid);
  } catch {
    return NextResponse.json(
      { error: "PDF 다운로드에 실패했습니다." },
      { status: 502 }
    );
  }

  // Load existing conversation
  const { data: session } = await serviceClient
    .from("chat_sessions")
    .select("messages")
    .eq("user_id", user.id)
    .eq("paper_pmid", pmid)
    .single();

  const existingMessages: ChatMessage[] = (session?.messages as ChatMessage[]) ?? [];

  // Build Gemini conversation
  const gemini = getGeminiClient();
  const model = gemini.getGenerativeModel({ model: "gemini-2.5-flash" });

  const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

  const contents = [
    {
      role: "user" as const,
      parts: [
        { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
        { text: PAPER_CHAT_SYSTEM_PROMPT },
      ],
    },
    { role: "model" as const, parts: [{ text: "네, 논문을 분석했습니다. 질문해 주세요." }] },
    // Existing conversation history
    ...existingMessages.flatMap((msg) => [{
      role: (msg.role === "user" ? "user" : "model") as "user" | "model",
      parts: [{ text: msg.content }],
    }]),
    // New user message
    { role: "user" as const, parts: [{ text: userMessage }] },
  ];

  // Stream response
  const result = await model.generateContentStream({ contents });

  const now = new Date().toISOString();
  let fullResponse = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            fullResponse += text;
            controller.enqueue(
              new TextEncoder().encode(`data: ${JSON.stringify({ type: "text", content: text })}\n\n`)
            );
          }
        }

        // Parse excalidraw blocks from full response
        let excalidrawData: { elements: unknown[] } | null = null;
        const excalidrawMatch = fullResponse.match(/```excalidraw\s*([\s\S]*?)```/);
        if (excalidrawMatch) {
          try {
            excalidrawData = JSON.parse(excalidrawMatch[1].trim());
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ type: "excalidraw", data: excalidrawData })}\n\n`
              )
            );
          } catch {
            // Invalid excalidraw JSON, ignore
          }
        }

        // Save to DB
        const newMessages: ChatMessage[] = [
          ...existingMessages,
          { role: "user", content: userMessage, created_at: now },
          { role: "assistant", content: fullResponse, created_at: new Date().toISOString(), excalidraw: excalidrawData },
        ];

        await serviceClient
          .from("chat_sessions")
          .upsert({
            user_id: user.id,
            paper_pmid: pmid,
            messages: newMessages as unknown as import("@supabase/supabase-js").Json,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id,paper_pmid" });

        // Update usage
        await serviceClient
          .from("chat_usage")
          .upsert({
            user_id: user.id,
            paper_pmid: pmid,
            used_at: today,
            count: (paperUsage?.count ?? 0) + 1,
          }, { onConflict: "user_id,paper_pmid,used_at" });

        // Get updated usage for response
        const { count: todayPapers } = await serviceClient
          .from("chat_usage")
          .select("paper_pmid", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("used_at", today);

        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({
              type: "done",
              usage: {
                papers_today: todayPapers ?? 0,
                queries_this_paper: (paperUsage?.count ?? 0) + 1,
                max_papers: 10,
                max_queries: 10,
              },
            })}\n\n`
          )
        );

        controller.close();
      } catch (err) {
        console.error("[Chat] Gemini stream error:", err);
        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({ type: "error", content: "AI 응답 생성 중 오류가 발생했습니다." })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pmid: string }> }
) {
  const { pmid } = await params;
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = createServiceClient();

  const { data: session } = await supabase
    .from("chat_sessions")
    .select("messages")
    .eq("user_id", user.id)
    .eq("paper_pmid", pmid)
    .single();

  const today = new Date().toISOString().slice(0, 10);

  const { data: paperUsage } = await serviceClient
    .from("chat_usage")
    .select("count")
    .eq("user_id", user.id)
    .eq("paper_pmid", pmid)
    .eq("used_at", today)
    .single();

  const { count: todayPapers } = await serviceClient
    .from("chat_usage")
    .select("paper_pmid", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("used_at", today);

  return NextResponse.json({
    messages: (session?.messages as ChatMessage[]) ?? [],
    usage: {
      papers_today: todayPapers ?? 0,
      queries_this_paper: paperUsage?.count ?? 0,
      max_papers: 10,
      max_queries: 10,
    },
  });
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/papers/[pmid]/chat/route.ts
git commit -m "feat: add streaming chat API with Gemini + rate limiting"
```

---

### Task 6: Chat history API for History tab

**Files:**
- Create: `src/app/api/chat/history/route.ts`

- [ ] **Step 1: Create the history API**

Create `src/app/api/chat/history/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Clean up sessions older than 2 months (fire-and-forget)
  const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  supabase
    .from("chat_sessions")
    .delete()
    .eq("user_id", user.id)
    .lt("updated_at", twoMonthsAgo)
    .then(() => {});

  const { data, error } = await supabase
    .from("chat_sessions")
    .select("paper_pmid, messages, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sessions = (data ?? []).map((s) => ({
    paper_pmid: s.paper_pmid,
    message_count: Array.isArray(s.messages) ? (s.messages as unknown[]).length : 0,
    updated_at: s.updated_at,
  }));

  return NextResponse.json({ sessions });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/chat/history/route.ts
git commit -m "feat: add chat history API with 2-month auto-cleanup"
```

---

### Task 7: usePaperChat hook

**Files:**
- Create: `src/hooks/use-paper-chat.ts`

- [ ] **Step 1: Create the chat hook**

Create `src/hooks/use-paper-chat.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-paper-chat.ts
git commit -m "feat: add usePaperChat hook with SSE streaming"
```

---

### Task 8: Chat message renderer + Excalidraw block

**Files:**
- Create: `src/components/chat/chat-message.tsx`
- Create: `src/components/chat/excalidraw-block.tsx`

- [ ] **Step 1: Create ExcalidrawBlock component**

Create `src/components/chat/excalidraw-block.tsx`:

```tsx
"use client";

import { useState, lazy, Suspense } from "react";
import { Maximize2, Minimize2, Loader2 } from "lucide-react";

const Excalidraw = lazy(() =>
  import("@excalidraw/excalidraw").then((mod) => ({ default: mod.Excalidraw }))
);

interface ExcalidrawBlockProps {
  data: { elements: unknown[] };
}

export function ExcalidrawBlock({ data }: ExcalidrawBlockProps) {
  const [fullscreen, setFullscreen] = useState(false);

  const viewer = (
    <Suspense
      fallback={
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      }
    >
      <Excalidraw
        initialData={{ elements: data.elements as any, scrollToContent: true }}
        viewModeEnabled={!fullscreen}
        UIOptions={{
          canvasActions: {
            export: false,
            loadScene: false,
            saveToActiveFile: false,
          },
        }}
      />
    </Suspense>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-gray-950">
        <button
          onClick={() => setFullscreen(false)}
          className="absolute right-4 top-4 z-50 rounded-lg bg-gray-100 p-2 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
        >
          <Minimize2 className="h-5 w-5" />
        </button>
        <div className="h-full w-full">{viewer}</div>
      </div>
    );
  }

  return (
    <div className="relative mt-2 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="h-64">{viewer}</div>
      <button
        onClick={() => setFullscreen(true)}
        className="absolute right-2 top-2 rounded-md bg-white/80 p-1.5 text-gray-600 hover:bg-white dark:bg-gray-900/80 dark:text-gray-400 dark:hover:bg-gray-900"
        title="전체화면 편집"
      >
        <Maximize2 className="h-4 w-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create ChatMessage component**

Create `src/components/chat/chat-message.tsx`:

```tsx
import { User, Bot } from "lucide-react";
import { ExcalidrawBlock } from "./excalidraw-block";
import type { ChatMessage as ChatMessageType } from "@/types/database";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  // Strip excalidraw code blocks from displayed text
  const displayContent = message.content.replace(/```excalidraw[\s\S]*?```/g, "").trim();

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
          isUser
            ? "bg-blue-100 dark:bg-blue-900/30"
            : "bg-purple-100 dark:bg-purple-900/30"
        }`}
      >
        {isUser ? (
          <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        ) : (
          <Bot className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
        )}
      </div>
      <div
        className={`min-w-0 max-w-[85%] rounded-xl px-3 py-2 text-sm ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
        }`}
      >
        <div
          className="prose prose-sm max-w-none dark:prose-invert [&_table]:text-xs"
          dangerouslySetInnerHTML={{
            __html: simpleMarkdown(displayContent),
          }}
        />
        {message.excalidraw && (
          <ExcalidrawBlock data={message.excalidraw} />
        )}
      </div>
    </div>
  );
}

/** Minimal markdown → HTML (bold, italic, bullets, code, tables) */
function simpleMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>")
    .replace(/\n/g, "<br>");
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/chat-message.tsx src/components/chat/excalidraw-block.tsx
git commit -m "feat: add chat message renderer with Excalidraw block support"
```

---

### Task 9: PaperChat panel component

**Files:**
- Create: `src/components/chat/paper-chat.tsx`

- [ ] **Step 1: Create the chat panel**

Create `src/components/chat/paper-chat.tsx`:

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, Send, Square, Sparkles, FlaskConical, AlertTriangle, Lock, Loader2 } from "lucide-react";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50">
      <div className="border-b border-gray-200 px-4 py-2.5 dark:border-gray-800">
        <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          <Bot className="h-3.5 w-3.5" />
          AI Paper Chat
        </h2>
      </div>

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
      <div className="max-h-96 space-y-3 overflow-y-auto px-3 py-3">
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
            rows={1}
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
        {usage && (
          <p className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500">
            질의 {usage.queries_this_paper}/{usage.max_queries} · 오늘 논문 {usage.papers_today}/{usage.max_papers}
          </p>
        )}
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/chat/paper-chat.tsx
git commit -m "feat: add PaperChat panel with quick actions and streaming"
```

---

### Task 10: Integrate chat panel into paper detail sidebar

**Files:**
- Modify: `src/app/paper/[pmid]/page.tsx`

- [ ] **Step 1: Add PaperChat import**

Add to imports at top of file:

```typescript
import { PaperChat } from "@/components/chat/paper-chat";
```

- [ ] **Step 2: Insert chat panel between External links and Keywords in sidebar**

In the `<aside>` section (around line 250), between the External links `<div>` (ending around line 257) and the Keywords `<div>` (starting around line 259), insert:

```tsx
              <PaperChat pmid={pmid} isOa={!!openAccess?.pdfUrl} />
```

So the sidebar order becomes:
1. External links
2. **AI Paper Chat** (new)
3. Keywords
4. Citation Graph

- [ ] **Step 3: Also add to mobile layout**

In the mobile section (`<div className="space-y-8 lg:hidden">`), add before keywords:

```tsx
              <PaperChat pmid={pmid} isOa={!!openAccess?.pdfUrl} />
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/app/paper/[pmid]/page.tsx
git commit -m "feat: integrate AI chat panel into paper detail sidebar"
```

---

### Task 11: History tab (rename Bookmarks + add chat sessions)

**Files:**
- Modify: `src/app/bookmarks/page.tsx`

- [ ] **Step 1: Replace bookmarks page with History**

Replace entire contents of `src/app/bookmarks/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Clock, Bookmark, MessageCircle } from "lucide-react";
import useSWR from "swr";
import { PaperCard } from "@/components/papers/paper-card";
import { PaperCardSkeleton } from "@/components/ui/skeleton";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useAuth } from "@/hooks/use-auth";
import { buildApiUrl } from "@/lib/utils/url";
import type { PaperWithJournal, PapersResponse } from "@/types/filters";
import Link from "next/link";

type FilterTab = "all" | "bookmarks" | "chat";

interface ChatSessionItem {
  paper_pmid: string;
  message_count: number;
  updated_at: string;
}

const papersFetcher = (url: string) =>
  fetch(url)
    .then((res) => res.json())
    .then((data: PapersResponse) => data.papers);

const chatFetcher = (url: string) =>
  fetch(url)
    .then((res) => res.json())
    .then((data: { sessions: ChatSessionItem[] }) => data.sessions);

export default function HistoryPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterTab>("all");
  const { pmids, loading: bookmarksLoading } = useBookmarks();

  // Fetch bookmarked papers
  const bookmarkUrl =
    !bookmarksLoading && pmids.length > 0
      ? buildApiUrl("/api/papers", { pmids: pmids.join(","), limit: 100 })
      : null;
  const { data: bookmarkedPapers = [], isLoading: bkLoading } =
    useSWR<PaperWithJournal[]>(bookmarkUrl, papersFetcher, { revalidateOnFocus: false });

  // Fetch chat sessions
  const { data: chatSessions = [], isLoading: chatLoading } =
    useSWR<ChatSessionItem[]>(user ? "/api/chat/history" : null, chatFetcher, {
      revalidateOnFocus: false,
    });

  // Fetch papers for chat sessions (pmids not already in bookmarks)
  const chatPmids = chatSessions.map((s) => s.paper_pmid);
  const chatOnlyPmids = chatPmids.filter((p) => !pmids.includes(p));
  const chatPapersUrl =
    chatOnlyPmids.length > 0
      ? buildApiUrl("/api/papers", { pmids: chatOnlyPmids.join(","), limit: 100 })
      : null;
  const { data: chatPapers = [] } = useSWR<PaperWithJournal[]>(
    chatPapersUrl,
    papersFetcher,
    { revalidateOnFocus: false }
  );

  const chatPmidSet = new Set(chatPmids);
  const bookmarkPmidSet = new Set(pmids);
  const allPapers = [...bookmarkedPapers, ...chatPapers];
  const uniquePapers = allPapers.filter(
    (p, i, arr) => arr.findIndex((x) => x.pmid === p.pmid) === i
  );

  const filteredPapers =
    filter === "bookmarks"
      ? uniquePapers.filter((p) => bookmarkPmidSet.has(p.pmid))
      : filter === "chat"
        ? uniquePapers.filter((p) => chatPmidSet.has(p.pmid))
        : uniquePapers;

  const showSkeleton = bookmarksLoading || bkLoading || chatLoading;

  const tabClass = (tab: FilterTab) =>
    `px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
      filter === tab
        ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
        : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
    }`;

  return (
    <div className="mx-auto w-full max-w-[1280px] px-0 sm:px-4 sm:py-4">
      <div className="mx-auto max-w-2xl border-x border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="sticky top-14 z-20 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-900 dark:text-gray-100" />
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              History
            </h1>
          </div>
          <div className="mt-2 flex gap-1.5">
            <button onClick={() => setFilter("all")} className={tabClass("all")}>
              전체
            </button>
            <button onClick={() => setFilter("bookmarks")} className={tabClass("bookmarks")}>
              북마크
            </button>
            <button onClick={() => setFilter("chat")} className={tabClass("chat")}>
              AI 채팅
            </button>
          </div>
        </div>

        {showSkeleton ? (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {Array.from({ length: 3 }).map((_, i) => (
              <PaperCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredPapers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Clock className="mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" />
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
              기록이 없습니다
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              논문을 북마크하거나 AI Chat을 이용하면 여기에 표시됩니다.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {filteredPapers.map((paper) => (
              <div key={paper.pmid} className="relative">
                <div className="absolute right-3 top-3 flex gap-1">
                  {bookmarkPmidSet.has(paper.pmid) && (
                    <Bookmark className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  )}
                  {chatPmidSet.has(paper.pmid) && (
                    <MessageCircle className="h-3.5 w-3.5 text-purple-500" />
                  )}
                </div>
                <PaperCard paper={paper} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/bookmarks/page.tsx
git commit -m "feat: transform Bookmarks into History tab with chat session support"
```

---

### Task 12: Navigation updates (Bookmarks → History)

**Files:**
- Modify: `src/components/layout/header.tsx`
- Modify: `src/components/layout/mobile-bottom-nav.tsx`

- [ ] **Step 1: Update header navigation**

In `src/components/layout/header.tsx`, find:
```tsx
          <Link href="/bookmarks" className={linkClass("/bookmarks")}>
            <Bookmark className="h-4 w-4" />
            Bookmarks
            <UnreadRepliesBadge />
          </Link>
```

Replace with:
```tsx
          <Link href="/bookmarks" className={linkClass("/bookmarks")}>
            <Clock className="h-4 w-4" />
            History
            <UnreadRepliesBadge />
          </Link>
```

Also add `Clock` to the lucide-react import at the top of the file.

- [ ] **Step 2: Update mobile bottom nav**

In `src/components/layout/mobile-bottom-nav.tsx`, find the Bookmarks link and change the label from "Bookmarks" to "History" and the icon from `Bookmark` to `Clock` (import from lucide-react).

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/header.tsx src/components/layout/mobile-bottom-nav.tsx
git commit -m "feat: rename Bookmarks navigation to History"
```

---

### Task 13: Add GOOGLE_GENERATIVE_AI_API_KEY to Vercel

- [ ] **Step 1: Add env var**

```bash
npx vercel env add GOOGLE_GENERATIVE_AI_API_KEY production
```

Enter the Gemini API key when prompted.

- [ ] **Step 2: Commit env example update**

If `.env.example` exists, add `GOOGLE_GENERATIVE_AI_API_KEY=` to it.

---

### Task 14: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Manual testing checklist**

1. Navigate to OA paper → chat panel visible in sidebar
2. Navigate to non-OA paper → chat panel hidden
3. Quick action "원문 요약" → streaming response
4. "도식화해줘" 요청 → Excalidraw diagram rendered
5. Excalidraw 전체화면 편집 → modal opens
6. Rate limit → 11th query shows error
7. History tab → shows bookmarks and chat sessions
8. History filter tabs → all/bookmarks/chat 필터 동작
9. Paper detail → previous chat loaded from DB
10. Dark mode rendering
