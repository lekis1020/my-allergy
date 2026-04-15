import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { UserAffinity } from "./score";

type AuthedClient = SupabaseClient<Database>;

/**
 * Load the signals used by the personalization scorer for a given user.
 *
 * Uses the auth-scoped client — RLS guarantees we only see rows for this user.
 */
export async function loadUserAffinity(
  supabase: AuthedClient,
  userId: string
): Promise<UserAffinity> {
  // Run aggregates in parallel — 4 small reads.
  const [subsRes, bookmarksRes, keywordsRes, feedbackRes] = await Promise.all([
    supabase
      .from("email_subscriptions")
      .select("journal_slug")
      .eq("user_id", userId),
    supabase.from("bookmarks").select("pmid").eq("user_id", userId),
    supabase
      .from("keyword_alerts")
      .select("keyword, active")
      .eq("user_id", userId)
      .eq("active", true),
    supabase
      .from("paper_feedback")
      .select("paper_pmid, feedback")
      .eq("user_id", userId),
  ]);

  const journalSlugs = new Set<string>();
  for (const row of subsRes.data ?? []) {
    if (row.journal_slug) journalSlugs.add(row.journal_slug);
  }

  const bookmarkPmids: string[] = [];
  for (const row of bookmarksRes.data ?? []) {
    if (row.pmid) bookmarkPmids.push(row.pmid);
  }

  // Enrich journal affinity from bookmarks by looking up their journal slugs.
  if (bookmarkPmids.length > 0) {
    const { data: bookmarkedPapers } = await supabase
      .from("papers")
      .select("pmid, journals!inner(slug)")
      .in("pmid", bookmarkPmids.slice(0, 200));
    for (const p of bookmarkedPapers ?? []) {
      const slug = (p as { journals: { slug: string } | null }).journals?.slug;
      if (slug) journalSlugs.add(slug);
    }
  }

  const keywordAlerts = (keywordsRes.data ?? [])
    .map((row) => row.keyword?.toLowerCase().trim())
    .filter((k): k is string => Boolean(k));

  const interestedPmids = new Set<string>();
  const notInterestedPmids = new Set<string>();
  for (const row of feedbackRes.data ?? []) {
    if (row.feedback === "interested") interestedPmids.add(row.paper_pmid);
    else if (row.feedback === "not_interested") notInterestedPmids.add(row.paper_pmid);
  }

  // Gather journal slugs / tokens seen in 👎ed papers for similarity penalty.
  const dislikedJournalSlugs = new Set<string>();
  const dislikedTokens = new Set<string>();
  if (notInterestedPmids.size > 0) {
    const { data: dislikedPapers } = await supabase
      .from("papers")
      .select("pmid, keywords, mesh_terms, journals!inner(slug)")
      .in("pmid", Array.from(notInterestedPmids).slice(0, 200));
    for (const p of dislikedPapers ?? []) {
      const slug = (p as { journals: { slug: string } | null }).journals?.slug;
      if (slug) dislikedJournalSlugs.add(slug);
      const keywords = Array.isArray(p.keywords) ? p.keywords : [];
      const mesh = Array.isArray(p.mesh_terms) ? p.mesh_terms : [];
      for (const token of [...keywords, ...mesh]) {
        if (typeof token === "string" && token.trim()) {
          dislikedTokens.add(token.toLowerCase());
        }
      }
    }
  }

  return {
    journalSlugs,
    keywordAlerts,
    interestedPmids,
    notInterestedPmids,
    dislikedJournalSlugs,
    dislikedTokens,
  };
}
