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

/** Check if a buffer starts with the PDF magic bytes (%PDF-) */
function isPdfBuffer(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 5) return false;
  const header = new Uint8Array(buf, 0, 5);
  // %PDF- = [0x25, 0x50, 0x44, 0x46, 0x2D]
  return header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46 && header[4] === 0x2D;
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
    redirect: "follow",
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: ${response.status} from ${pdfUrl}`);
  }

  // Read the buffer first, then validate by magic bytes (%PDF-) rather than
  // relying solely on content-type, since some servers (e.g. PMC) return
  // content-type: text/html even for valid PDF files.
  const buffer = await response.arrayBuffer();

  if (isPdfBuffer(buffer)) {
    // Valid PDF regardless of content-type header
    pdfCache.set(pmid, { buffer, expiry: Date.now() + PDF_CACHE_TTL_MS });
    return buffer;
  }

  // Not a PDF — likely an HTML viewer page. Try common URL variants.
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
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
      });
      if (!retryRes.ok) continue;
      const retryBuf = await retryRes.arrayBuffer();
      if (isPdfBuffer(retryBuf)) {
        pdfCache.set(pmid, { buffer: retryBuf, expiry: Date.now() + PDF_CACHE_TTL_MS });
        return retryBuf;
      }
    } catch {
      // try next variant
    }
  }
  throw new Error(`Expected PDF but received non-PDF content from ${pdfUrl}`);
}
