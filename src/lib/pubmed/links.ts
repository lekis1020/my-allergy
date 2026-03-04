const EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

interface ELinkResponse {
  linksets?: Array<{
    linksetdbs?: Array<{
      linkname?: string;
      links?: string[];
    }>;
  }>;
}

export async function fetchLinkedPmids(
  pmid: string,
  linkName: "pubmed_pubmed" | "pubmed_pubmed_refs" | "pubmed_pubmed_citedin",
  max: number = 20
): Promise<string[]> {
  try {
    const params = new URLSearchParams({
      dbfrom: "pubmed",
      db: "pubmed",
      id: pmid,
      retmode: "json",
      linkname: linkName,
    });

    const response = await fetch(`${EUTILS_BASE}/elink.fcgi?${params.toString()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as ELinkResponse;
    const dbs = data.linksets?.[0]?.linksetdbs ?? [];

    const matched =
      dbs.find((entry) => entry.linkname === linkName)?.links ??
      dbs[0]?.links ??
      [];

    return [...new Set(matched.filter((id) => id && id !== pmid))].slice(0, max);
  } catch {
    return [];
  }
}
