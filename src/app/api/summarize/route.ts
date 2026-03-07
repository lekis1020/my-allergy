import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const SYSTEM_PROMPT = `You are a medical research summarizer for allergy & clinical immunology papers. Be maximally concise.

Output exactly this structure — no extra lines, no headers beyond what's shown:

**[한 줄 한국어 제목 — 핵심 발견 요약]**

- 목적: [한 문장]
- 방법: [설계 + 핵심 방법, 최대 1줄]
- 규모: [N명/건, 국가]
- 결과: [핵심 수치 1~2개만, vs 비교 포함]
💬 [임상적 함의 또는 구체적 후속 연구 방향, 1문장]

Statistical format (no "95% CI" label):
- Rate: **value%**[lower-upper]
- OR/HR/RR: OR value[lower-upper]
- p-value: p=value

Rules:
- Korean output. Medical terms stay in English (OR, HR, IgE, etc.).
- Study design in Korean (메타분석, 코호트, 횡단면, RCT).
- Bold primary effect estimate only.
- No filler, no repetition. Each line must add new information.
- 결과 bullet: max 2 lines total.`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI API key not configured" },
      { status: 500 }
    );
  }

  let body: { abstract: string; title: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { abstract, title } = body;
  if (!abstract || !title) {
    return NextResponse.json(
      { error: "Both 'abstract' and 'title' are required" },
      { status: 400 }
    );
  }

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Title: ${title}\n\nAbstract: ${abstract}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 512,
    });

    const summary = completion.choices[0]?.message?.content ?? "";
    return NextResponse.json({ summary });
  } catch (err) {
    console.error("OpenAI API error:", err);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 502 }
    );
  }
}
