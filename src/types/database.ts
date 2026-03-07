import type { Database } from "./supabase";

// Re-export generated Database type
export type { Database };

// Convenience row-type aliases
export type Journal = Database["public"]["Tables"]["journals"]["Row"];
export type Paper = Database["public"]["Tables"]["papers"]["Row"];
export type PaperAuthor = Database["public"]["Tables"]["paper_authors"]["Row"];
export type SyncLog = Database["public"]["Tables"]["sync_logs"]["Row"];
export type EmailSubscription = Database["public"]["Tables"]["email_subscriptions"]["Row"];
export type KeywordAlert = Database["public"]["Tables"]["keyword_alerts"]["Row"];

export interface PaperWithDetails extends Paper {
  journal: Journal;
  authors: PaperAuthor[];
}
