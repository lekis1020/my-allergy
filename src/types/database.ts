export interface Journal {
  id: string;
  name: string;
  abbreviation: string;
  issn: string;
  e_issn: string | null;
  impact_factor: number | null;
  color: string;
  slug: string;
  created_at: string;
}

export interface Paper {
  id: string;
  journal_id: string;
  pmid: string;
  doi: string | null;
  title: string;
  abstract: string | null;
  publication_date: string;
  epub_date: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  keywords: string[];
  mesh_terms: string[];
  citation_count: number | null;
  crossref_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface PaperAuthor {
  id: string;
  paper_id: string;
  last_name: string;
  first_name: string | null;
  initials: string | null;
  affiliation: string | null;
  position: number;
}

export interface SyncLog {
  id: string;
  journal_id: string;
  sync_type: "full" | "incremental";
  status: "running" | "success" | "error";
  papers_found: number;
  papers_inserted: number;
  papers_updated: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface PaperWithDetails extends Paper {
  journal: Journal;
  authors: PaperAuthor[];
}
