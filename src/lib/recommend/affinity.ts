import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { AffinityProfile } from "./profile";
import type { ScoringContext } from "./score";
import { emptyProfile, applyDecay, DIMENSIONS } from "./profile";

type AuthedClient = SupabaseClient<Database>;

/**
 * Load the user's affinity profile and explicit feedback sets.
 * Applies time decay on load. Returns empty profile if none exists.
 */
export async function loadScoringContext(
  supabase: AuthedClient,
  userId: string
): Promise<ScoringContext> {
  const [profileRes, feedbackRes] = await Promise.all([
    supabase
      .from("user_affinity_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("paper_feedback")
      .select("paper_pmid, feedback")
      .eq("user_id", userId),
  ]);

  // Build explicit feedback sets
  const interestedPmids = new Set<string>();
  const notInterestedPmids = new Set<string>();
  for (const row of feedbackRes.data ?? []) {
    if (row.feedback === "interested") interestedPmids.add(row.paper_pmid);
    else if (row.feedback === "not_interested")
      notInterestedPmids.add(row.paper_pmid);
  }

  // Load or create profile
  let profile: AffinityProfile;
  if (profileRes.data) {
    profile = {
      topics: (profileRes.data.topics ?? {}) as Record<string, number>,
      authors: (profileRes.data.authors ?? {}) as Record<string, number>,
      keywords: (profileRes.data.keywords ?? {}) as Record<string, number>,
      mesh_terms: (profileRes.data.mesh_terms ?? {}) as Record<string, number>,
      journals: (profileRes.data.journals ?? {}) as Record<string, number>,
      article_types: (profileRes.data.article_types ?? {}) as Record<
        string,
        number
      >,
      feedback_count: profileRes.data.feedback_count ?? 0,
      updated_at: profileRes.data.updated_at ?? new Date().toISOString(),
    };

    // Apply time decay
    const lastUpdate = new Date(profile.updated_at);
    const daysSince = Math.max(
      0,
      (Date.now() - lastUpdate.getTime()) / 86_400_000
    );
    if (daysSince >= 1) {
      for (const dim of DIMENSIONS) {
        profile[dim] = applyDecay(profile[dim], daysSince);
      }
    }
  } else {
    profile = emptyProfile();
  }

  return { profile, interestedPmids, notInterestedPmids };
}

/**
 * Save the updated profile to the database (upsert).
 */
export async function saveProfile(
  supabase: AuthedClient,
  userId: string,
  profile: AffinityProfile
): Promise<void> {
  await supabase.from("user_affinity_profiles").upsert(
    {
      user_id: userId,
      topics: profile.topics,
      authors: profile.authors,
      keywords: profile.keywords,
      mesh_terms: profile.mesh_terms,
      journals: profile.journals,
      article_types: profile.article_types,
      feedback_count: profile.feedback_count,
      updated_at: profile.updated_at,
    },
    { onConflict: "user_id" }
  );
}
