import { NextRequest, NextResponse } from "next/server";
import { createAnonClient, createServiceClient } from "@/lib/supabase/server";

interface ConnectionNode {
  pmid: string;
  title: string;
  journal_abbreviation: string;
  journal_color: string;
  publication_date: string;
}

interface MentionDetail {
  comment_id: string;
  anon_id: string;
  content_snippet: string;
  created_at: string;
}

interface ConnectionEdge {
  source: string;
  target: string;
  type: "citation" | "mention" | "both" | "similarity" | "bookmark";
  direction: "references" | "cited_by" | "bidirectional";
  mentions: MentionDetail[];
  similarity?: number;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pmid: string }> }
) {
  const { pmid } = await params;
  const supabase = createAnonClient();

  // 1. Focal paper
  const { data: paper } = await supabase
    .from("papers")
    .select("pmid, title, journals!inner(abbreviation, color)")
    .eq("pmid", pmid)
    .single();

  if (!paper) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  // 2. Citations (both directions)
  const [{ data: outgoing }, { data: incoming }] = await Promise.all([
    supabase.from("paper_citations").select("target_pmid").eq("source_pmid", pmid),
    supabase.from("paper_citations").select("source_pmid").eq("target_pmid", pmid),
  ]);

  const citationMap = new Map<string, "references" | "cited_by" | "bidirectional">();
  for (const row of outgoing ?? []) {
    citationMap.set(row.target_pmid, "references");
  }
  for (const row of incoming ?? []) {
    const existing = citationMap.get(row.source_pmid);
    citationMap.set(row.source_pmid, existing === "references" ? "bidirectional" : "cited_by");
  }

  // 3. Mentions (both directions) — use service client to bypass RLS for join
  const serviceClient = createServiceClient();
  const [{ data: mentionsFrom }, { data: mentionsTo }] = await Promise.all([
    serviceClient
      .from("paper_mentions")
      .select("mentioned_pmid, comment_id, paper_comments!inner(anon_id, content, created_at)")
      .eq("source_pmid", pmid),
    serviceClient
      .from("paper_mentions")
      .select("source_pmid, comment_id, paper_comments!inner(anon_id, content, created_at)")
      .eq("mentioned_pmid", pmid),
  ]);

  const mentionMap = new Map<string, MentionDetail[]>();

  for (const row of mentionsFrom ?? []) {
    const comment = row.paper_comments as unknown as { anon_id: string; content: string; created_at: string };
    const arr = mentionMap.get(row.mentioned_pmid) ?? [];
    arr.push({
      comment_id: row.comment_id,
      anon_id: comment.anon_id,
      content_snippet: comment.content.slice(0, 100),
      created_at: comment.created_at,
    });
    mentionMap.set(row.mentioned_pmid, arr);
  }

  for (const row of mentionsTo ?? []) {
    const comment = row.paper_comments as unknown as { anon_id: string; content: string; created_at: string };
    const arr = mentionMap.get(row.source_pmid) ?? [];
    arr.push({
      comment_id: row.comment_id,
      anon_id: comment.anon_id,
      content_snippet: comment.content.slice(0, 100),
      created_at: comment.created_at,
    });
    mentionMap.set(row.source_pmid, arr);
  }

  // 4. Similarity neighbours (embedding cosine). The RPC may not be deployed
  //    yet — degrade to empty rather than throwing a 500.
  const similarityMap = new Map<string, number>();
  try {
    const { data: sims } = await supabase.rpc("paper_similar_neighbors", {
      p_pmid: pmid,
      p_k: 8,
      p_threshold: 0.5,
    });
    for (const row of sims ?? []) {
      similarityMap.set(String(row.pmid), Number(row.similarity));
    }
  } catch {
    // RPC missing / failed → treat as no similarity edges.
  }

  // 5. Collect all related PMIDs
  const allPmids = new Set([
    ...citationMap.keys(),
    ...mentionMap.keys(),
    ...similarityMap.keys(),
  ]);
  const journal = paper.journals as unknown as { abbreviation: string; color: string };

  if (allPmids.size === 0) {
    return NextResponse.json({
      focal: {
        pmid: paper.pmid,
        title: String(paper.title),
        journal_abbreviation: String(journal.abbreviation),
        journal_color: String(journal.color),
      },
      nodes: [],
      edges: [],
    });
  }

  // 5b. Fetch paper metadata for all related papers
  const { data: relatedPapers } = await supabase
    .from("papers")
    .select("pmid, title, publication_date, journals!inner(abbreviation, color)")
    .in("pmid", [...allPmids]);

  const paperMap = new Map<string, ConnectionNode>();
  for (const rp of relatedPapers ?? []) {
    const rpJournal = rp.journals as unknown as { abbreviation: string; color: string };
    paperMap.set(String(rp.pmid), {
      pmid: String(rp.pmid),
      title: String(rp.title),
      journal_abbreviation: String(rpJournal.abbreviation),
      journal_color: String(rpJournal.color),
      publication_date: String(rp.publication_date),
    });
  }

  // 6. Build edges
  const edges: ConnectionEdge[] = [];
  const processedPmids = new Set<string>();

  for (const relatedPmid of allPmids) {
    if (!paperMap.has(relatedPmid)) continue;
    processedPmids.add(relatedPmid);

    const hasCitation = citationMap.has(relatedPmid);
    const hasMention = mentionMap.has(relatedPmid);
    const hasSimilarity = similarityMap.has(relatedPmid);
    const type: ConnectionEdge["type"] =
      hasCitation && hasMention
        ? "both"
        : hasCitation
          ? "citation"
          : hasMention
            ? "mention"
            : "similarity";
    const direction = citationMap.get(relatedPmid) ?? "cited_by";

    edges.push({
      source: pmid,
      target: relatedPmid,
      type,
      direction,
      mentions: mentionMap.get(relatedPmid) ?? [],
      ...(hasSimilarity ? { similarity: similarityMap.get(relatedPmid) } : {}),
    });
  }

  const nodes = [...processedPmids].map((p) => paperMap.get(p)!);

  return NextResponse.json({
    focal: {
      pmid: paper.pmid,
      title: String(paper.title),
      journal_abbreviation: String(journal.abbreviation),
      journal_color: String(journal.color),
    },
    nodes,
    edges,
  });
}
