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
 * Find an open-access PDF link by checking multiple sources in order:
 * 1. Unpaywall API
 * 2. Europe PMC
 * 3. Semantic Scholar
 * Returns null on error (non-blocking).
 */
export async function findOpenAccessPdf(
  doi: string | null
): Promise<OpenAccessInfo | null> {
  if (!doi) return null;

  const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//, "");

  // Try Unpaywall first
  const unpaywall = await tryUnpaywall(cleanDoi);
  if (unpaywall?.pdfUrl) return unpaywall;

  // Fallback: Europe PMC
  const europePmc = await tryEuropePmc(cleanDoi);
  if (europePmc?.pdfUrl) return europePmc;

  // Fallback: Semantic Scholar
  const semanticScholar = await trySemanticScholar(cleanDoi);
  if (semanticScholar?.pdfUrl) return semanticScholar;

  // Return Unpaywall result even without PDF (may have oaUrl)
  return unpaywall;
}

async function tryUnpaywall(doi: string): Promise<OpenAccessInfo | null> {
  try {
    const url = `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${UNPAYWALL_EMAIL}`;
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate: 86_400 },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as UnpaywallResponse;
    const best = data.best_oa_location;

    return {
      isOa: data.is_oa,
      pdfUrl: best?.url_for_pdf ?? null,
      oaUrl: best?.url ?? null,
      license: best?.license ?? null,
      source: best?.host_type ? `unpaywall:${best.host_type}` : "unpaywall",
    };
  } catch {
    return null;
  }
}

async function tryEuropePmc(doi: string): Promise<OpenAccessInfo | null> {
  try {
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:${encodeURIComponent(doi)}&resultType=core&format=json`;
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate: 86_400 },
    });

    if (!response.ok) return null;

    const data = await response.json();
    const result = data?.resultList?.result?.[0];
    if (!result) return null;

    // Check fullTextUrlList for PDF
    const urls = result.fullTextUrlList?.fullTextUrl as
      | Array<{ url: string; documentStyle: string; availability: string }>
      | undefined;

    const pdfEntry = urls?.find(
      (u) => u.documentStyle === "pdf" && u.availability === "Open access"
    );
    const htmlEntry = urls?.find(
      (u) => u.documentStyle === "html" && u.availability === "Open access"
    );

    if (!pdfEntry && !htmlEntry) return null;

    return {
      isOa: true,
      pdfUrl: pdfEntry?.url ?? null,
      oaUrl: htmlEntry?.url ?? pdfEntry?.url ?? null,
      license: result.license ?? null,
      source: "europepmc",
    };
  } catch {
    return null;
  }
}

async function trySemanticScholar(doi: string): Promise<OpenAccessInfo | null> {
  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doi)}?fields=isOpenAccess,openAccessPdf`;
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate: 86_400 },
    });

    if (!response.ok) return null;

    const data = await response.json();

    if (!data.openAccessPdf?.url) return null;

    return {
      isOa: data.isOpenAccess ?? true,
      pdfUrl: data.openAccessPdf.url,
      oaUrl: data.openAccessPdf.url,
      license: null,
      source: "semanticscholar",
    };
  } catch {
    return null;
  }
}
