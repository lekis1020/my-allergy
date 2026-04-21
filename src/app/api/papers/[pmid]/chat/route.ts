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

  const body = await request.json().catch(() => null);
  const userMessage = body?.message as string | undefined;
  if (!userMessage || userMessage.trim().length === 0) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const serviceClient = createServiceClient();
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
    const { data: todayUsage } = await serviceClient
      .from("chat_usage")
      .select("paper_pmid")
      .eq("user_id", user.id)
      .eq("used_at", today);

    const distinctPapers = new Set((todayUsage ?? []).map((r) => r.paper_pmid));
    if (distinctPapers.size >= 10) {
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

  const existingMessages: ChatMessage[] = (session?.messages as unknown as ChatMessage[]) ?? [];

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
    ...existingMessages.flatMap((msg) => [{
      role: (msg.role === "user" ? "user" : "model") as "user" | "model",
      parts: [{ text: msg.content }],
    }]),
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

        // Get updated usage
        const { data: todayUsage } = await serviceClient
          .from("chat_usage")
          .select("paper_pmid")
          .eq("user_id", user.id)
          .eq("used_at", today);

        const todayPapers = new Set((todayUsage ?? []).map((r) => r.paper_pmid)).size;

        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({
              type: "done",
              usage: {
                papers_today: todayPapers,
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

  const { data: todayUsage } = await serviceClient
    .from("chat_usage")
    .select("paper_pmid")
    .eq("user_id", user.id)
    .eq("used_at", today);

  const todayPapers = new Set((todayUsage ?? []).map((r) => r.paper_pmid)).size;

  return NextResponse.json({
    messages: (session?.messages as unknown as ChatMessage[]) ?? [],
    usage: {
      papers_today: todayPapers,
      queries_this_paper: paperUsage?.count ?? 0,
      max_papers: 10,
      max_queries: 10,
    },
  });
}
