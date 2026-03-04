export interface CrossRefWork {
  DOI: string;
  title: string[];
  "is-referenced-by-count": number;
  license?: Array<{
    URL: string;
    "content-version": string;
  }>;
  published?: {
    "date-parts": number[][];
  };
  type: string;
  subject?: string[];
}

export interface CrossRefResponse {
  status: string;
  "message-type": string;
  message: CrossRefWork;
}
