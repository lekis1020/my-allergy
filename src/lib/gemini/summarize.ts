import { getGeminiClient } from "@/lib/gemini/client";

const SUMMARY_PROMPT = `다음 의학 논문의 초록을 읽고, 알레르기/면역학 전문의를 위한 핵심 요약을 한국어 2~3문장으로 작성하세요.
연구의 주요 발견과 임상적 의의에 초점을 맞추세요. 마크다운 서식 없이 일반 텍스트로 작성하세요.

초록:
`;

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 2000;

/** Gemini SDK surfaces rate limits as a 429 / RESOURCE_EXHAUSTED error. */
function isRateLimitError(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  if (status === 429) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /429|rate limit|RESOURCE_EXHAUSTED|quota/i.test(message);
}

/**
 * Generate a Korean clinical summary of a paper abstract.
 *
 * Retries on Gemini rate-limit (429) errors with exponential backoff — the
 * free tier RPM is low, so sync runs that summarize many papers in a row
 * would otherwise silently drop the rate-limited ones.
 */
export async function generatePaperSummary(
  abstract: string | null
): Promise<string | null> {
  if (!abstract || abstract.length < 50) return null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const client = getGeminiClient();
      const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: SUMMARY_PROMPT + abstract }] }],
      });

      const text = result.response.text()?.trim();
      return text || null;
    } catch (error) {
      const lastAttempt = attempt === MAX_ATTEMPTS - 1;
      if (isRateLimitError(error) && !lastAttempt) {
        // Exponential backoff with jitter: ~2s, 4s, 8s
        const delay = BASE_DELAY_MS * 2 ** attempt + Math.random() * 1000;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      console.error("[Summarize] Failed to generate summary:", error);
      return null;
    }
  }

  return null;
}
