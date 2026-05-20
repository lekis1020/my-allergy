import { NextResponse } from "next/server";
import { createAnonClient, createServiceClient } from "@/lib/supabase/server";
import { buildInducedSubgraph } from "@/lib/graph/induced-subgraph";
import type { GraphNode, GraphResponse } from "@/lib/graph/types";

const NODE_CAP = 60;
const RECENT_WINDOW_DAYS = 90;

export async function GET() {
  const supabase = createAnonClient();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RECENT_WINDOW_DAYS);
  const fromDate = cutoff.toISOString().split("T")[0];

  // 1. Recent pmids — papers from the last RECENT_WINDOW_DAYS days. We still
  //    pull at most NODE_CAP and order by citation_count desc so the picked
  //    slice is biased toward papers more likely to share citation/mention
  //    edges (the graph would otherwise be visually empty for many windows),
  //    but no minimum citation threshold is required: a brand-new paper that
  //    was already mentioned in community comments can show up here.
  const { data: recent, error: recentError } = await supabase
    .from("papers")
    .select("pmid, title, publication_date, journals!inner(abbreviation, color)")
    .not("abstract", "is", null)
    .neq("abstract", "")
    .gte("epub_date", fromDate)
    .order("citation_count", { ascending: false, nullsFirst: false })
    .order("epub_date", { ascending: false })
    .limit(NODE_CAP);

  if (recentError) {
    console.error("recent connections query error:", recentError);
    return NextResponse.json<GraphResponse>({ nodes: [], edges: [] }, { status: 500 });
  }

  const paperMap = new Map<string, GraphNode>();
  for (const row of recent ?? []) {
    const journal = row.journals as unknown as { abbreviation: string; color: string };
    paperMap.set(String(row.pmid), {
      pmid: String(row.pmid),
      title: String(row.title),
      journal_abbreviation: String(journal.abbreviation),
      journal_color: String(journal.color),
      publication_date: String(row.publication_date),
    });
  }

  const pmidSet = new Set(paperMap.keys());

  if (pmidSet.size === 0) {
    return jsonWithCache({ nodes: [], edges: [] });
  }

  // 2. Citation + mention rows where both endpoints are in the recent set.
  //    paper_mentions has RLS that blocks anon; read via service client.
  const pmidList = [...pmidSet];
  const serviceClient = createServiceClient();
  const [{ data: citations }, { data: mentions }] = await Promise.all([
    supabase
      .from("paper_citations")
      .select("source_pmid, target_pmid")
      .in("source_pmid", pmidList)
      .in("target_pmid", pmidList),
    serviceClient
      .from("paper_mentions")
      .select("source_pmid, mentioned_pmid")
      .in("source_pmid", pmidList)
      .in("mentioned_pmid", pmidList),
  ]);

  // 3. Induced sub-graph; drop edgeless nodes.
  const { edges, connectedPmids } = buildInducedSubgraph(
    pmidSet,
    citations ?? [],
    mentions ?? []
  );
  const nodes = connectedPmids.map((p) => paperMap.get(p)!).filter(Boolean);

  return jsonWithCache({ nodes, edges });
}

function jsonWithCache(body: GraphResponse) {
  const response = NextResponse.json(body);
  response.headers.set(
    "Cache-Control",
    "public, s-maxage=300, stale-while-revalidate=600"
  );
  return response;
}
