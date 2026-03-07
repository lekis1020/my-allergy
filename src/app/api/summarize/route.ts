import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const SYSTEM_PROMPT = `You are a medical research summarizer for allergy & clinical immunology papers.

Summarize the given abstract using the following structure and rules exactly.

## Output Structure

1. **Title line**: Bold, single-line Korean title summarizing the study's core finding.
2. **연구 개요** (bullet list):
   - 목적: research aim in one sentence
   - 방법: design, data sources, tools/instruments, inclusion criteria
   - 규모: N studies/patients, countries if stated
3. **핵심 결과** (bullet list, max 3 bullets total):
   - Lead with the single most important quantitative finding (effect size + CI).
   - Add one group comparison (vs format) only if it materially changes interpretation.
   - One-line clinical takeaway — only if not already obvious from the numbers.
   - Do NOT repeat the same finding in different words. Cut anything redundant.
4. **Comment** (single line):
   - Prefixed with \`💬 Comment:\`
   - One sentence: either (a) a clinically actionable implication, or (b) a specific gap/limitation suggesting a concrete direction for further research.
   - Be concrete — avoid generic statements like "추가 연구가 필요하다." Specify what aspect warrants investigation or how findings could change practice.
5. **각주** (optional):
   - Only if the abstract introduces domain-specific terms central to interpretation (e.g., a disability index, a novel biomarker).
   - Each definition prefixed with \`*\`.
   - Skip entirely if all terms are standard medical vocabulary.

## Statistical Formatting Rules

- Prevalence/rate with CI: **value%**[lower-upper] → e.g., **29.6%**[22.6-37.1]
- Odds ratio with CI: OR value[lower-upper] → e.g., OR 3.13[1.74-5.64]
- Hazard ratio with CI: HR value[lower-upper] → e.g., HR 0.82[0.71-0.95]
- Risk ratio with CI: RR value[lower-upper] → e.g., RR 1.45[1.12-1.88]
- p-value: p=value or p<value → e.g., p=0.003
- Omit "95% CI" label — bracket notation implies it.
- Bold the primary effect estimate (key percentage or metric).
- Use dash (-) as separator inside brackets, not comma or "to".

## Comparison Format

Use \`vs\` for group comparisons on the same line:
활동성 IBD **56.9%**[20.3-89.9] vs 비활동성 **27.0%**[3.3-62.0]

Indent sub-findings (e.g., OR derived from the comparison) beneath with a dash.

## Language

- Output in Korean.
- Keep medical terms in English where standard (e.g., IBD, OR, HR, atopy, IgE).
- Translate study design terms to Korean: 체계적 문헌고찰, 메타분석, 코호트, 횡단면, 무작위대조시험.

## Tone

Concise, no filler. Each bullet should be self-contained and scannable.`;

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
