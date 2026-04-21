export interface CommentDTO {
  id: string;
  paper_pmid: string;
  parent_id: string | null;
  anon_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  is_own: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface CommentThreadNode extends CommentDTO {
  children: CommentDTO[];
}

export interface CommentListResponse {
  thread: CommentThreadNode[];
}
