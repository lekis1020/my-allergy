import "server-only";
import { createAnonClient, createServerAuthClient } from "@/lib/supabase/server";
import { toPaperDto, type PaperRow } from "./transform";
import type { PaperWithJournal } from "@/types/filters";

interface ChatSessionItem {
  paper_pmid: string;
  message_count: number;
  updated_at: string;
}

export interface HistoryInitialData {
  bookmarkedPapers: PaperWithJournal[];
  bookmarkPmids: string[];
  chatSessions: ChatSessionItem[];
  chatPapers: PaperWithJournal[];
  authenticated: boolean;
}

export async function fetchHistoryData(): Promise<HistoryInitialData> {
  const empty: HistoryInitialData = {
    bookmarkedPapers: [],
    bookmarkPmids: [],
    chatSessions: [],
    chatPapers: [],
    authenticated: false,
  };

  const authClient = await createServerAuthClient();
  const { data: { session } } = await authClient.auth.getSession();

  if (!session?.user) {
    return empty;
  }

  const supabase = createAnonClient();
  const userId = session.user.id;

  // Parallel fetch: bookmarks + chat sessions
  const [bookmarkResult, chatResult] = await Promise.all([
    authClient
      .from("bookmarks")
      .select("pmid")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    authClient
      .from("chat_sessions")
      .select("paper_pmid, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
  ]);

  const bookmarkPmids = (bookmarkResult.data || []).map((b) => b.pmid as string);
  const chatSessions: ChatSessionItem[] = (chatResult.data || []).map((s) => ({
    paper_pmid: s.paper_pmid as string,
    message_count: 0,
    updated_at: s.updated_at as string,
  }));
  const chatPmids = chatSessions.map((s) => s.paper_pmid);

  // Combine unique pmids and fetch all papers in one query
  const allPmids = [...new Set([...bookmarkPmids, ...chatPmids])];

  if (allPmids.length === 0) {
    return { ...empty, authenticated: true };
  }

  const { data: papersData, error } = await supabase
    .from("papers")
    .select(
      `
      id, pmid, doi, title, abstract, publication_date, epub_date,
      volume, issue, pages, keywords, mesh_terms, citation_count, journal_id, publication_types,
      journals!inner (id, name, abbreviation, color, slug),
      paper_authors (last_name, first_name, initials, affiliation, position)
    `,
    )
    .in("pmid", allPmids)
    .order("position", { referencedTable: "paper_authors", ascending: true });

  if (error) {
    console.error("[fetchHistoryData] papers error:", error);
    return { ...empty, authenticated: true, bookmarkPmids };
  }

  const allPapers = (papersData || []).map((row) =>
    toPaperDto(row as unknown as PaperRow),
  );

  const bookmarkSet = new Set(bookmarkPmids);
  const chatPmidSet = new Set(chatPmids);

  // Split into bookmark papers and chat-only papers
  const bookmarkedPapers = allPapers.filter((p) => bookmarkSet.has(p.pmid));
  const chatOnlyPapers = allPapers.filter(
    (p) => chatPmidSet.has(p.pmid) && !bookmarkSet.has(p.pmid),
  );

  return {
    bookmarkedPapers,
    bookmarkPmids,
    chatSessions,
    chatPapers: chatOnlyPapers,
    authenticated: true,
  };
}
