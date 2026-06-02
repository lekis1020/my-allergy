import OpenAI from "openai";

const MODEL = "text-embedding-3-small";
const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 1500;

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

function isRateLimitError(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  if (status === 429) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /429|rate limit|quota/i.test(message);
}

/**
 * Embed a single text into a 1536-dim vector via OpenAI
 * text-embedding-3-small. Returns null when input is too short to be
 * meaningful. Throws after MAX_ATTEMPTS on persistent failure.
 */
export async function embedText(text: string): Promise<number[] | null> {
  const trimmed = text.trim();
  if (trimmed.length < 20) return null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const result = await getClient().embeddings.create({
        model: MODEL,
        input: trimmed,
      });
      const vec = result.data[0]?.embedding;
      return vec ? Array.from(vec) : null;
    } catch (error) {
      const lastAttempt = attempt === MAX_ATTEMPTS - 1;
      if (lastAttempt) throw error;
      if (isRateLimitError(error)) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  return null;
}

/**
 * Embed an array of texts in one OpenAI request (much cheaper per token
 * than N individual calls). Returns null entries for any inputs that
 * were too short. Preserves index order.
 */
export async function embedTexts(texts: string[]): Promise<(number[] | null)[]> {
  const trimmed = texts.map((t) => t.trim());
  const indexedValid: { idx: number; text: string }[] = [];
  trimmed.forEach((t, idx) => {
    if (t.length >= 20) indexedValid.push({ idx, text: t });
  });
  const out: (number[] | null)[] = new Array(texts.length).fill(null);
  if (indexedValid.length === 0) return out;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const result = await getClient().embeddings.create({
        model: MODEL,
        input: indexedValid.map((e) => e.text),
      });
      result.data.forEach((entry, i) => {
        const targetIdx = indexedValid[i].idx;
        out[targetIdx] = Array.from(entry.embedding);
      });
      return out;
    } catch (error) {
      const lastAttempt = attempt === MAX_ATTEMPTS - 1;
      if (lastAttempt) throw error;
      if (isRateLimitError(error)) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  return out;
}
