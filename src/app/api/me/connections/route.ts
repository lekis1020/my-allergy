import { NextResponse } from "next/server";
import { createServerAuthClient, createAnonClient } from "@/lib/supabase/server";
import { buildInducedSubgraph } from "@/lib/graph/induced-subgraph";
import type { GraphNode, GraphResponse } from "@/lib/graph/types";

const PMID_CAP = 60;

export async function GET() {
  const authClient = await createServerAuthClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json<GraphResponse>({ nodes: [], edges: [] }, { status: 401 });
  }

  // 1. Collect the user's pmids from bookmarks, comments, likes — most recent
  //    interactions first. RLS lets the authed client read the user's own rows.
  const [bookmarks, comments, likes] = await Promise.all([
    authClient
      .from("bookmarks")
      .select("pmid, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(PMID_CAP),
    authClient
      .from("paper_comments")
      .select("paper_pmid, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(PMID_CAP),
    authClient
      .from("paper_likes")
      .select("paper_pmid, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(PMID_CAP),
  ]);

  // Merge by recency, dedupe, cap at PMID_CAP.
  const interactions: Array<{ pmid: string; at: string }> = [
    ...(bookmarks.data ?? []).map((r) => ({ pmid: String(r.pmid), at: String(r.created_at) })),
    ...(comments.data ?? []).map((r) => ({ pmid: String(r.paper_pmid), at: String(r.created_at) })),
    ...(likes.data ?? []).map((r) => ({ pmid: String(r.paper_pmid), at: String(r.created_at) })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const pmidSet = new Set<string>();
  for (const { pmid } of interactions) {
    if (pmidSet.size >= PMID_CAP) break;
    pmidSet.add(pmid);
  }

  if (pmidSet.size === 0) {
    return NextResponse.json<GraphResponse>({ nodes: [], edges: [] });
  }

  // 2. Paper metadata + edge rows. Reads are RLS-public, so use the anon client.
  const supabase = createAnonClient();
  const pmidList = [...pmidSet];

  const [{ data: papers }, { data: citations }, { data: mentions }] = await Promise.all([
    supabase
      .from("papers")
      .select("pmid, title, publication_date, journals!inner(abbreviation, color)")
      .in("pmid", pmidList),
    supabase
      .from("paper_citations")
      .select("source_pmid, target_pmid")
      .in("source_pmid", pmidList)
      .in("target_pmid", pmidList),
    supabase
      .from("paper_mentions")
      .select("source_pmid, mentioned_pmid")
      .in("source_pmid", pmidList)
      .in("mentioned_pmid", pmidList),
  ]);

  const paperMap = new Map<string, GraphNode>();
  for (const row of papers ?? []) {
    const journal = row.journals as unknown as { abbreviation: string; color: string };
    paperMap.set(String(row.pmid), {
      pmid: String(row.pmid),
      title: String(row.title),
      journal_abbreviation: String(journal.abbreviation),
      journal_color: String(journal.color),
      publication_date: String(row.publication_date),
    });
  }

  // 3. Induced sub-graph; drop edgeless nodes.
  const { edges, connectedPmids } = buildInducedSubgraph(
    pmidSet,
    citations ?? [],
    mentions ?? []
  );
  const nodes = connectedPmids
    .map((p) => paperMap.get(p))
    .filter((n): n is GraphNode => Boolean(n));

  return NextResponse.json<GraphResponse>({ nodes, edges });
}
