import type { SupabaseClient } from "@supabase/supabase-js";
import { enrichWithCrossRef } from "@/lib/crossref/client";

export async function enrichPapersWithCrossRef(
  supabase: SupabaseClient,
  limit: number = 50
): Promise<{ enriched: number; errors: number }> {
  const { data: papers, error: fetchError } = await supabase
    .from("papers")
    .select("id, doi")
    .not("doi", "is", null)
    .is("crossref_data", null)
    .limit(limit);

  if (fetchError || !papers) {
    console.error("Error fetching papers for enrichment:", fetchError);
    return { enriched: 0, errors: 1 };
  }

  let enriched = 0;
  let errorCount = 0;

  for (const paper of papers) {
    try {
      const data = await enrichWithCrossRef(paper.doi);
      if (data) {
        await supabase
          .from("papers")
          .update({
            citation_count: data.citationCount,
            crossref_data: { license: data.license },
            updated_at: new Date().toISOString(),
          })
          .eq("id", paper.id);

        enriched++;
      }
    } catch (err) {
      console.error(`Error enriching paper ${paper.id}:`, err);
      errorCount++;
    }
  }

  return { enriched, errors: errorCount };
}
