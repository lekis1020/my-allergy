import { getGeminiClient } from "@/lib/gemini/client";

const SUMMARY_PROMPT = `다음 의학 논문의 초록을 읽고, 알레르기/면역학 전문의를 위한 핵심 요약을 한국어 2~3문장으로 작성하세요.
연구의 주요 발견과 임상적 의의에 초점을 맞추세요. 마크다운 서식 없이 일반 텍스트로 작성하세요.

초록:
`;

export async function generatePaperSummary(
  abstract: string | null
): Promise<string | null> {
  if (!abstract || abstract.length < 50) return null;

  try {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: SUMMARY_PROMPT + abstract }] }],
    });

    const text = result.response.text()?.trim();
    return text || null;
  } catch (error) {
    console.error("[Summarize] Failed to generate summary:", error);
    return null;
  }
}
