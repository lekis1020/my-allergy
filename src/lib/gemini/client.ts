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
    headers: {
      accept: "application/pdf",
      "user-agent": "my-allergy-app/1.0 (academic-research; mailto:my-allergy-app@users.noreply.github.com)",
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: ${response.status} from ${pdfUrl}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    throw new Error(`Expected PDF but received HTML from ${pdfUrl}`);
  }

  const buffer = await response.arrayBuffer();
  pdfCache.set(pmid, { buffer, expiry: Date.now() + PDF_CACHE_TTL_MS });

  // Evict expired entries
  for (const [key, val] of pdfCache) {
    if (val.expiry < Date.now()) pdfCache.delete(key);
  }

  return buffer;
}
