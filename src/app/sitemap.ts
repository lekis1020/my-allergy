import type { MetadataRoute } from "next";
import { createAnonClient } from "@/lib/supabase/server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://my-allergy.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_URL}/trending`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/insights`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/calendar`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/agora`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/clinical-trials`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];

  // Fetch paper PMIDs for dynamic pages
  let paperPages: MetadataRoute.Sitemap = [];
  try {
    const supabase = createAnonClient();
    const { data: papers } = await supabase
      .from("papers")
      .select("pmid, updated_at")
      .order("updated_at", { ascending: false })
      .limit(5000);

    if (papers) {
      paperPages = papers.map((paper) => ({
        url: `${SITE_URL}/paper/${paper.pmid}`,
        lastModified: paper.updated_at ? new Date(paper.updated_at as string) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }));
    }
  } catch {
    // Sitemap generation should not fail the build
  }

  return [...staticPages, ...paperPages];
}
