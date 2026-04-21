const UNPAYWALL_EMAIL = "my-allergy-app@users.noreply.github.com";

interface UnpaywallResponse {
  is_oa: boolean;
  best_oa_location?: {
    url?: string;
    url_for_pdf?: string;
    license?: string;
    host_type?: string;
  } | null;
}

export interface OpenAccessInfo {
  isOa: boolean;
  pdfUrl: string | null;
  oaUrl: string | null;
  license: string | null;
  source: string | null;
}

/**
 * Check Unpaywall for an open-access PDF link.
 * Returns null on error (non-blocking).
 */
export async function findOpenAccessPdf(
  doi: string | null
): Promise<OpenAccessInfo | null> {
  if (!doi) return null;

  try {
    const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//, "");
    const url = `https://api.unpaywall.org/v2/${encodeURIComponent(cleanDoi)}?email=${UNPAYWALL_EMAIL}`;

    const response = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate: 86_400 }, // Cache 24h
    });

    if (!response.ok) return null;

    const data = (await response.json()) as UnpaywallResponse;
    const best = data.best_oa_location;

    return {
      isOa: data.is_oa,
      pdfUrl: best?.url_for_pdf ?? null,
      oaUrl: best?.url ?? null,
      license: best?.license ?? null,
      source: best?.host_type ?? null,
    };
  } catch {
    return null;
  }
}
