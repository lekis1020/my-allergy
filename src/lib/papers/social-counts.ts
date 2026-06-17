import type { createServiceClient } from "@/lib/supabase/server";

type ServiceClient = ReturnType<typeof createServiceClient>;

export interface SocialCounts {
  like: number;
  bookmark: number;
  comment: number;
  connection: number;
}

/**
 * Aggregate like / bookmark / comment / connection counts in a single RPC
 * round-trip instead of fetching every matching row across 5 tables and
 * counting them in JS. The function returns one row per input pmid.
 *
 * Callers must pass a service client — `bookmarks` and `paper_comments`
 * RLS restricts SELECT to the row owner / authed users, which would zero
 * out the counts under an anon client. Only aggregate numbers are exposed,
 * never row data.
 */
export async function fetchSocialCounts(
  statsClient: ServiceClient,
  pmids: string[],
): Promise<Map<string, SocialCounts>> {
  const countMap = new Map<string, SocialCounts>();
  if (pmids.length === 0) return countMap;

  // `get_paper_social_counts` (migration 00036) is absent from the generated
  // Database types, so the call shape is typed manually. Cast the CLIENT (not
  // the method) and call `.rpc()` as a member so `this` stays bound to the
  // client — hoisting `statsClient.rpc` into a variable detaches `this` and
  // crashes inside supabase-js with "Cannot read properties of undefined
  // (reading 'rest')".
  const rpcClient = statsClient as unknown as {
    rpc: (
      fn: "get_paper_social_counts",
      args: { p_pmids: string[] },
    ) => PromiseLike<{
      data: Array<{
        pmid: string;
        like_count: number;
        bookmark_count: number;
        comment_count: number;
        connection_count: number;
      }> | null;
      error: { message: string } | null;
    }>;
  };
  const { data: countRows, error: countErr } = await rpcClient.rpc(
    "get_paper_social_counts",
    { p_pmids: pmids },
  );
  if (countErr) {
    console.warn("[Papers] social counts RPC failed:", countErr);
  }
  for (const row of countRows ?? []) {
    countMap.set(row.pmid, {
      like: Number(row.like_count) || 0,
      bookmark: Number(row.bookmark_count) || 0,
      comment: Number(row.comment_count) || 0,
      connection: Number(row.connection_count) || 0,
    });
  }
  return countMap;
}

/**
 * Per-user social state (which of the given papers the user bookmarked
 * or liked). Service client for the same RLS reason as above; the rows
 * are filtered to the verified user id.
 */
export async function fetchUserSocialState(
  statsClient: ServiceClient,
  userId: string,
  pmids: string[],
): Promise<{ bookmarked: Set<string>; liked: Set<string> }> {
  const bookmarked = new Set<string>();
  const liked = new Set<string>();
  if (pmids.length === 0) return { bookmarked, liked };

  const [{ data: myBookmarks }, { data: myLikes }] = await Promise.all([
    statsClient.from("bookmarks")
      .select("pmid")
      .eq("user_id", userId)
      .in("pmid", pmids),
    statsClient.from("paper_likes")
      .select("paper_pmid")
      .eq("user_id", userId)
      .in("paper_pmid", pmids),
  ]);
  for (const row of myBookmarks ?? []) bookmarked.add(row.pmid);
  for (const row of myLikes ?? []) liked.add(row.paper_pmid);
  return { bookmarked, liked };
}
