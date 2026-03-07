import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const SYSTEM_PROMPT = `You are a medical research summarizer for allergy & clinical immunology papers.

Summarize the given abstract following this exact format:

1. **제목줄**: 굵게, 한 줄 한국어 제목 (연구 핵심 요약)
2. **연구 개요** (bullet list):
   - 목적: 연구 목적 한 문장
   - 방법: 설계, 데이터 소스, 포함 기준
   - 규모: N명/건, 국가(명시된 경우)
3. **핵심 결과** (bullet list):
   - 주요 정량적 결과 (effect size 포함)
   - 그룹 비교 (vs 형식)
   - 주요 결론의 임상적 해석
4. **Comment** (한 줄):
   - 💬 Comment: 접두사
   - 임상적 함의 또는 추가 연구 방향 구체적 제시
5. **각주** (선택적): 도메인 특이 용어 * 접두사

통계 표기 규칙:
- 유병률/비율+CI: **값%**[하한-상한] (예: **29.6%**[22.6-37.1])
- OR+CI: OR 값[하한-상한]
- HR+CI: HR 값[하한-상한]
- p값: p=값 또는 p<값
- "95% CI" 라벨 생략, 괄호 표기로 대신
- 주요 효과 추정치 굵게 표시
- 구분자는 대시(-) 사용

그룹 비교 예시: 활동성 **56.9%**[20.3-89.9] vs 비활동성 **27.0%**[3.3-62.0]

출력 언어: 한국어. 의학 용어는 영어 유지 (예: OR, HR, IBD).`;

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
      max_tokens: 1024,
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
