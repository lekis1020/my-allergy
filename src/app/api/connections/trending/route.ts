import { NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/server";
import { buildInducedSubgraph } from "@/lib/graph/induced-subgraph";
import type { GraphNode, GraphResponse } from "@/lib/graph/types";

const NODE_CAP = 60;
const TRENDING_WINDOW_DAYS = 180;

export async function GET() {
  const supabase = createAnonClient();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - TRENDING_WINDOW_DAYS);
  const fromDate = cutoff.toISOString().split("T")[0];

  // 1. Top trending pmids — same selection basis as the trending feed.
  const { data: trending, error: trendingError } = await supabase
    .from("papers")
    .select("pmid, title, publication_date, journals!inner(abbreviation, color)")
    .not("abstract", "is", null)
    .neq("abstract", "")
    .gte("epub_date", fromDate)
    .gt("citation_count", 0)
    .order("citation_count", { ascending: false, nullsFirst: false })
    .order("epub_date", { ascending: false })
    .limit(NODE_CAP);

  if (trendingError) {
    console.error("trending connections query error:", trendingError);
    return NextResponse.json<GraphResponse>({ nodes: [], edges: [] }, { status: 500 });
  }

  const paperMap = new Map<string, GraphNode>();
  for (const row of trending ?? []) {
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

  // 2. Citation + mention rows where both endpoints are trending pmids.
  const pmidList = [...pmidSet];
  const [{ data: citations }, { data: mentions }] = await Promise.all([
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
