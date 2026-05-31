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

/**
 * Typed error so the chat route can render a publisher-aware UX
 * instead of a generic "download failed" string.
 *
 * - "blocked": publisher refuses server-side fetch (403, or HTML viewer
 *   without a working .full.pdf / /pdf variant). The OA license is valid
 *   but we cannot deliver the PDF to Gemini from our backend. Recovery
 *   path is to send the user to the publisher's own PDF/landing page.
 * - "unavailable": non-403 HTTP error or empty body. May be transient.
 * - "network": fetch threw (timeout, DNS, abort).
 */
export class PdfFetchError extends Error {
  constructor(
    message: string,
    public readonly kind: "blocked" | "unavailable" | "network",
    public readonly url: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "PdfFetchError";
  }
}

export async function fetchPdfBuffer(pdfUrl: string, pmid: string): Promise<ArrayBuffer> {
  const cached = pdfCache.get(pmid);
  if (cached && cached.expiry > Date.now()) {
    return cached.buffer;
  }

  let response: Response;
  try {
    response = await fetch(pdfUrl, {
      headers: {
        accept: "application/pdf",
        "user-agent": "my-allergy-app/1.0 (academic-research; mailto:my-allergy-app@users.noreply.github.com)",
      },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    throw new PdfFetchError(
      `Network error fetching PDF from ${pdfUrl}: ${(err as Error).message}`,
      "network",
      pdfUrl,
    );
  }

  if (!response.ok) {
    // 403 is the classic "publisher anti-bot blocked us" signal.
    // 401 means publisher requires auth (effectively blocked for our server).
    const kind = response.status === 403 || response.status === 401 ? "blocked" : "unavailable";
    throw new PdfFetchError(
      `Failed to fetch PDF: ${response.status} from ${pdfUrl}`,
      kind,
      pdfUrl,
      response.status,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    // Some publishers (BMJ, Wiley) return an HTML viewer — try common PDF URL variants.
    const variants = [
      pdfUrl.replace(/\/?$/, ".full.pdf"),
      pdfUrl.replace(/\/?$/, "/pdf"),
    ];
    for (const variant of variants) {
      try {
        const retryRes = await fetch(variant, {
          headers: {
            accept: "application/pdf",
            "user-agent": "my-allergy-app/1.0 (academic-research; mailto:my-allergy-app@users.noreply.github.com)",
          },
          signal: AbortSignal.timeout(15_000),
        });
        const retryType = retryRes.headers.get("content-type") ?? "";
        if (retryRes.ok && !retryType.includes("text/html")) {
          const buf = await retryRes.arrayBuffer();
          pdfCache.set(pmid, { buffer: buf, expiry: Date.now() + PDF_CACHE_TTL_MS });
          return buf;
        }
      } catch {
        // try next variant
      }
    }
    // All variants returned HTML or failed — treat as publisher-blocked.
    throw new PdfFetchError(
      `Expected PDF but received HTML from ${pdfUrl}`,
      "blocked",
      pdfUrl,
    );
  }

  const buffer = await response.arrayBuffer();
  pdfCache.set(pmid, { buffer, expiry: Date.now() + PDF_CACHE_TTL_MS });

  // Evict expired entries
  for (const [key, val] of pdfCache) {
    if (val.expiry < Date.now()) pdfCache.delete(key);
  }

  return buffer;
}
