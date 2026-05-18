import OpenAI from "openai";

const SYSTEM_PROMPT = `당신은 알레르기/면역학 논문 요약 전문가입니다.
주어진 의학 논문의 초록을 읽고, 알레르기/면역학 전문의를 위한 핵심 요약을
한국어 2~3문장으로 작성하세요. 연구의 주요 발견과 임상적 의의에 초점을
맞추세요. 마크다운 서식 없이 일반 텍스트로 작성하세요.`;

const MODEL = "gpt-4o-mini";
const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 2000;

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

/** OpenAI surfaces rate limits as a 429 error. */
function isRateLimitError(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  if (status === 429) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /429|rate limit|quota/i.test(message);
}

/**
 * Generate a short Korean clinical summary of a paper abstract, stored as
 * `papers.ai_summary` and shown on feed cards.
 *
 * Uses OpenAI gpt-4o-mini — the Gemini free tier hit its daily quota and
 * silently dropped every summary. Retries 429s with exponential backoff.
 */
export async function generatePaperSummary(
  abstract: string | null
): Promise<string | null> {
  if (!abstract || abstract.length < 50) return null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const completion = await getClient().chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `초록:\n${abstract}` },
        ],
        temperature: 0.3,
        max_tokens: 512,
      });

      const text = completion.choices[0]?.message?.content?.trim();
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
