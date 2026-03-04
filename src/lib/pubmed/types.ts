export interface PubMedSearchResult {
  count: number;
  idList: string[];
  webEnv?: string;
  queryKey?: string;
}

export interface PubMedArticle {
  pmid: string;
  title: string;
  abstract: string | null;
  authors: PubMedAuthor[];
  journalTitle: string;
  journalAbbreviation: string;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  publicationDate: string;
  epubDate: string | null;
  doi: string | null;
  keywords: string[];
  meshTerms: string[];
}

export interface PubMedAuthor {
  lastName: string;
  firstName: string | null;
  initials: string | null;
  affiliation: string | null;
}

export interface ESearchResponse {
  esearchresult: {
    count: string;
    idlist: string[];
    webenv?: string;
    querykey?: string;
  };
}
