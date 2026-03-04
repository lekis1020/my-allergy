import type { CrossRefResponse, CrossRefWork } from "./types";
import { withRetry } from "@/lib/utils/retry";

const BASE_URL = "https://api.crossref.org/works";
const RATE_LIMIT_MS = 100;

let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
  }
  lastRequestTime = Date.now();

  const email = process.env.CROSSREF_EMAIL || "";
  const headers: Record<string, string> = {
    "User-Agent": `MyAllergy/1.0 (mailto:${email})`,
  };

  const response = await withRetry(() => fetch(url, { headers }));
  if (!response.ok) {
    if (response.status === 404) return response;
    throw new Error(`CrossRef API error: ${response.status}`);
  }
  return response;
}

export async function getWorkByDoi(doi: string): Promise<CrossRefWork | null> {
  try {
    const url = `${BASE_URL}/${encodeURIComponent(doi)}`;
    const response = await rateLimitedFetch(url);
    if (!response.ok) return null;
    const data: CrossRefResponse = await response.json();
    return data.message;
  } catch (error) {
    console.error(`CrossRef lookup failed for DOI ${doi}:`, error);
    return null;
  }
}

export async function enrichWithCrossRef(
  doi: string
): Promise<{ citationCount: number; license: string | null } | null> {
  const work = await getWorkByDoi(doi);
  if (!work) return null;

  return {
    citationCount: work["is-referenced-by-count"] ?? 0,
    license: work.license?.[0]?.URL ?? null,
  };
}
