const UNPAYWALL_EMAIL = "my-allergy-app@users.noreply.github.com";

interface UnpaywallOaLocation {
  url?: string;
  url_for_pdf?: string;
  license?: string;
  host_type?: string;
}

interface UnpaywallResponse {
  is_oa: boolean;
  best_oa_location?: UnpaywallOaLocation | null;
  oa_locations?: UnpaywallOaLocation[];
}

export interface OpenAccessInfo {
  isOa: boolean;
  pdfUrl: string | null;
  /** Alternative PDF URLs from other sources, tried if pdfUrl fails */
  fallbackPdfUrls?: string[];
  oaUrl: string | null;
  license: string | null;
  source: string | null;
}

/**
 * Find an open-access PDF link by checking multiple sources in order:
 * 1. Unpaywall API (by DOI)
 * 2. PubMed Central (by PMID)
 * 3. Europe PMC (by DOI)
 * 4. Semantic Scholar (by DOI)
 * Returns null on error (non-blocking).
 */
export async function findOpenAccessPdf(
  doi: string | null,
  pmid?: string | null
): Promise<OpenAccessInfo | null> {
  if (!doi && !pmid) return null;

  const cleanDoi = doi?.replace(/^https?:\/\/doi\.org\//, "") ?? null;

  // Collect PDF URLs from all sources concurrently for fallback support.
  // The primary URL comes from the first source that returns one;
  // remaining URLs are stored as fallbacks in case the primary is blocked (e.g. 403).
  const [unpaywall, pmc, europePmc, semanticScholar] = await Promise.all([
    cleanDoi ? tryUnpaywall(cleanDoi) : null,
    pmid ? tryPmc(pmid) : null,
    cleanDoi ? tryEuropePmc(cleanDoi) : null,
    cleanDoi ? trySemanticScholar(cleanDoi) : null,
  ]);

  // Rank sources by reliability: PMC > Europe PMC > Unpaywall > Semantic Scholar
  const ranked = [pmc, europePmc, unpaywall, semanticScholar];
  const primary = ranked.find((r) => r?.pdfUrl) ?? unpaywall;

  if (primary?.pdfUrl) {
    // Gather alternative PDF URLs from other sources
    const fallbackPdfUrls = ranked
      .filter((r) => r?.pdfUrl && r.pdfUrl !== primary.pdfUrl)
      .map((r) => r!.pdfUrl!);

    return { ...primary, fallbackPdfUrls };
  }

  // Return Unpaywall result even without PDF (may have oaUrl)
  return unpaywall;
}

async function tryUnpaywall(doi: string): Promise<OpenAccessInfo | null> {
  try {
    const url = `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${UNPAYWALL_EMAIL}`;
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate: 3_600 },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as UnpaywallResponse;

    // Check best_oa_location first, then scan all oa_locations for a PDF
    const best = data.best_oa_location;
    let pdfLocation = best?.url_for_pdf ? best : null;

    if (!pdfLocation && data.oa_locations) {
      pdfLocation = data.oa_locations.find((loc) => !!loc.url_for_pdf) ?? null;
    }

    return {
      isOa: data.is_oa,
      pdfUrl: pdfLocation?.url_for_pdf ?? null,
      oaUrl: best?.url ?? null,
      license: (pdfLocation ?? best)?.license ?? null,
      source: (pdfLocation ?? best)?.host_type ? `unpaywall:${(pdfLocation ?? best)?.host_type}` : "unpaywall",
    };
  } catch {
    return null;
  }
}

async function tryPmc(pmid: string): Promise<OpenAccessInfo | null> {
  try {
    // Convert PMID to PMCID via NCBI ID Converter
    const convUrl = `https://pmc.ncbi.nlm.nih.gov/tools/idconv/api/v1/articles/?ids=${pmid}&format=json`;
    const convResponse = await fetch(convUrl, {
      next: { revalidate: 3_600 },
    });

    if (!convResponse.ok) return null;

    const convData = await convResponse.json();
    const record = convData?.records?.[0];
    const pmcid = record?.pmcid as string | undefined;

    if (!pmcid) return null;

    // PMC PDF URL pattern
    const pdfUrl = `https://pmc.ncbi.nlm.nih.gov/articles/${pmcid}/pdf/`;

    // Verify the PDF is accessible via HEAD check.
    // Reject if content-type is text/html (PMC HTML viewer, not actual PDF).
    const headResponse = await fetch(pdfUrl, {
      method: "HEAD",
      redirect: "follow",
      next: { revalidate: 3_600 },
    });

    if (!headResponse.ok) return null;

    const contentType = headResponse.headers.get("content-type") ?? "";
    if (contentType.includes("text/html")) return null;

    return {
      isOa: true,
      pdfUrl,
      oaUrl: `https://pmc.ncbi.nlm.nih.gov/articles/${pmcid}/`,
      license: null,
      source: "pmc",
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
      next: { revalidate: 3_600 },
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

    // Prefer the direct API URL over the redirect URL (?pdf=render)
    // to avoid slow redirects that cause timeouts.
    let pdfUrl = pdfEntry?.url ?? null;
    if (pdfUrl) {
      const pmcidMatch = pdfUrl.match(/PMC\d+/);
      if (pmcidMatch) {
        pdfUrl = `https://europepmc.org/api/getPdf?pmcid=${pmcidMatch[0]}`;
      }
    }

    return {
      isOa: true,
      pdfUrl,
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
      next: { revalidate: 3_600 },
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
