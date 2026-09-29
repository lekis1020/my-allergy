import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient, createAnonClient, createServiceClient } from "@/lib/supabase/server";

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
  direction: "references" | "cited_by" | "bidirectional" | null;
  mentions: MentionDetail[];
  similarity?: number;
}

interface Focal {
  pmid: string;
  title: string;
  journal_abbreviation: string;
  journal_color: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pmid: string }> }
) {
  const { pmid } = await params;
  const anon = createAnonClient();

  // Focal basics (always needed, even for the unauthenticated empty state).
  const { data: focalRow } = await anon
    .from("papers")
    .select("pmid, title, journals!inner(abbreviation, color)")
    .eq("pmid", pmid)
    .single();

  if (!focalRow) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  const focalJournal = focalRow.journals as unknown as { abbreviation: string; color: string };
  const focal: Focal = {
    pmid: String(focalRow.pmid),
    title: String(focalRow.title),
    journal_abbreviation: String(focalJournal.abbreviation),
    journal_color: String(focalJournal.color),
  };

  // Auth gate.
  const authClient = await createServerAuthClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ requiresAuth: true, focal, nodes: [], edges: [] });
  }

  // 1. The user's pmids from bookmarks + comments.
  const [bookmarks, comments] = await Promise.all([
    authClient.from("bookmarks").select("pmid").eq("user_id", user.id),
    authClient.from("paper_comments").select("paper_pmid").eq("user_id", user.id),
  ]);

  const bookmarkSet = new Set<string>();
  for (const row of bookmarks.data ?? []) {
    bookmarkSet.add(String(row.pmid));
  }
  const commentSet = new Set<string>();
  for (const row of comments.data ?? []) {
    commentSet.add(String(row.paper_pmid));
  }

  const userPmids = new Set<string>([...bookmarkSet, ...commentSet]);
  userPmids.delete(pmid);

  // 2. Focal similarity neighbours. RPC may not be deployed — degrade to empty.
  const simMap = new Map<string, number>();
  try {
    const { data: sims } = await anon.rpc("paper_similar_neighbors", {
      p_pmid: pmid,
      p_k: 40,
      p_threshold: 0.45,
    });
    for (const row of sims ?? []) {
      simMap.set(String(row.pmid), Number(row.similarity));
    }
  } catch {
    // RPC missing / failed → no similarity edges.
  }

  const edges: ConnectionEdge[] = [];
  const nodePmids = new Set<string>();

  // 3. Similarity/bookmark edges: focal ↔ user's papers that are similar.
  for (const p of userPmids) {
    if (!simMap.has(p)) continue;
    const type: ConnectionEdge["type"] = bookmarkSet.has(p) ? "bookmark" : "similarity";
    edges.push({
      source: pmid,
      target: p,
      type,
      direction: null,
      mentions: [],
      similarity: simMap.get(p),
    });
    nodePmids.add(p);
  }

  // 4. Mentions on the user's own comments that touch the focal paper.
  //    Service client to bypass RLS for the join (mirror connections route).
  const serviceClient = createServiceClient();
  const [{ data: mentionsFrom }, { data: mentionsTo }] = await Promise.all([
    serviceClient
      .from("paper_mentions")
      .select("mentioned_pmid, comment_id, paper_comments!inner(user_id, anon_id, content, created_at)")
      .eq("source_pmid", pmid)
      .eq("paper_comments.user_id", user.id),
    serviceClient
      .from("paper_mentions")
      .select("source_pmid, comment_id, paper_comments!inner(user_id, anon_id, content, created_at)")
      .eq("mentioned_pmid", pmid)
      .eq("paper_comments.user_id", user.id),
  ]);

  const mentionMap = new Map<string, MentionDetail[]>();
  for (const row of mentionsFrom ?? []) {
    const comment = row.paper_comments as unknown as { anon_id: string; content: string; created_at: string };
    const other = String(row.mentioned_pmid);
    if (other === pmid) continue;
    const arr = mentionMap.get(other) ?? [];
    arr.push({
      comment_id: String(row.comment_id),
      anon_id: comment.anon_id,
      content_snippet: comment.content.slice(0, 100),
      created_at: comment.created_at,
    });
    mentionMap.set(other, arr);
  }
  for (const row of mentionsTo ?? []) {
    const comment = row.paper_comments as unknown as { anon_id: string; content: string; created_at: string };
    const other = String(row.source_pmid);
    if (other === pmid) continue;
    const arr = mentionMap.get(other) ?? [];
    arr.push({
      comment_id: String(row.comment_id),
      anon_id: comment.anon_id,
      content_snippet: comment.content.slice(0, 100),
      created_at: comment.created_at,
    });
    mentionMap.set(other, arr);
  }

  for (const [other, mentions] of mentionMap) {
    edges.push({
      source: pmid,
      target: other,
      type: "mention",
      direction: "bidirectional",
      mentions,
    });
    nodePmids.add(other);
  }

  if (nodePmids.size === 0) {
    return NextResponse.json({ requiresAuth: false, focal, nodes: [], edges: [] });
  }

  // 5. Paper metadata for node pmids.
  const { data: relatedPapers } = await anon
    .from("papers")
    .select("pmid, title, publication_date, journals!inner(abbreviation, color)")
    .in("pmid", [...nodePmids]);

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

  // Drop edges whose node has no metadata; keep nodes that survive.
  const nodes: ConnectionNode[] = [];
  const keptPmids = new Set<string>();
  for (const p of nodePmids) {
    const node = paperMap.get(p);
    if (node) {
      nodes.push(node);
      keptPmids.add(p);
    }
  }
  const finalEdges = edges.filter((e) => keptPmids.has(e.target));

  return NextResponse.json({ requiresAuth: false, focal, nodes, edges: finalEdges });
}
