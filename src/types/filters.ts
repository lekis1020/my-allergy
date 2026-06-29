export type ArticleType =
  | "original"
  | "review"
  | "rct"
  | "systematic_review"
  | "meta_analysis"
  | "retrospective"
  | "case_report";

export const ARTICLE_TYPE_LABELS: Record<ArticleType, string> = {
  original: "Original Article",
  review: "Review",
  rct: "RCT",
  systematic_review: "Systematic Review",
  meta_analysis: "Meta-Analysis",
  retrospective: "Retrospective",
  case_report: "Case Report",
};

export const ARTICLE_TYPE_MESH: Record<ArticleType, string[]> = {
  original: ["Journal Article"],
  review: ["Review"],
  rct: ["Randomized Controlled Trial"],
  systematic_review: ["Systematic Review"],
  meta_analysis: ["Meta-Analysis"],
  retrospective: ["Retrospective Studies", "Retrospective"],
  case_report: ["Case Reports"],
};

export interface PaperFilters {
  q?: string;
  trial?: string;
  journals?: string[];
  from?: string;
  to?: string;
  sort?: "date_desc" | "date_asc" | "citations";
  page?: number;
  limit?: number;
  personalized?: boolean;
  articleType?: ArticleType;
}

export type TopicTag =
  | "asthma"
  | "rhinitis"
  | "urticaria"
  | "angioedema"
  | "anaphylaxis"
  | "atopic_dermatitis"
  | "drug_allergy"
  | "eosinophilic_disorders"
  | "immunodeficiency"
  | "food_allergy"
  | "allergen_immunotherapy"
  | "others";

export interface PapersResponse {
  papers: PaperWithJournal[];
  total: number;
  limit: number;
  hasMore: boolean;
  // Opaque keyset/offset cursor for the next page (papers feed); null when none.
  nextCursor?: string | null;
  // Legacy offset page number — still used by the agora feed.
  page?: number;
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
  // Total number of authors on the paper. The feed select fetches only the first
  // few `authors` for display, so this carries the real count for "N authors".
  authorCount: number;
  comment_count?: number;
  latest_comment_at?: string | null;
  ai_summary?: string | null;
  like_count?: number;
  bookmark_count?: number;
  connection_count?: number;
  is_bookmarked?: boolean;
  is_liked?: boolean;
}

export interface AuthorSummary {
  last_name: string;
  first_name: string | null;
  initials: string | null;
  affiliation: string | null;
  position: number;
}
