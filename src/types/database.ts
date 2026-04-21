import type { Database } from "./supabase";

// Re-export generated Database type
export type { Database };

// Convenience row-type aliases
export type Journal = Database["public"]["Tables"]["journals"]["Row"];
export type Paper = Database["public"]["Tables"]["papers"]["Row"];
export type PaperAuthor = Database["public"]["Tables"]["paper_authors"]["Row"];
export type SyncLog = Database["public"]["Tables"]["sync_logs"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];

export interface PaperWithDetails extends Paper {
  journal: Journal;
  authors: PaperAuthor[];
}
