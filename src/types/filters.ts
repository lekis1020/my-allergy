export interface PaperFilters {
  q?: string;
  journals?: string[];
  from?: string;
  to?: string;
  sort?: "date_desc" | "date_asc" | "citations";
  page?: number;
  limit?: number;
}

export type TopicTag =
  | "asthma"
  | "rhinitis"
  | "urticaria"
  | "atopic_dermatitis"
  | "drug_allergy"
  | "eosinophilic_disorders"
  | "immunodeficiency"
  | "food_allergy"
  | "others";

export interface PapersResponse {
  papers: PaperWithJournal[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface PaperWithJournal {
  id: string;
  pmid: string;
  doi: string | null;
  title: string;
  abstract: string | null;
  publication_date: string;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  keywords: string[];
  mesh_terms: string[];
  citation_count: number | null;
  journal_id: string;
  journal_name: string;
  journal_abbreviation: string;
  journal_color: string;
  journal_slug: string;
  topic_tags: TopicTag[];
  authors: AuthorSummary[];
}

export interface AuthorSummary {
  last_name: string;
  first_name: string | null;
  initials: string | null;
  affiliation: string | null;
  position: number;
}
