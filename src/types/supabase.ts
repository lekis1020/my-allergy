export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bookmarks: {
        Row: {
          ai_summary: string | null
          created_at: string
          id: string
          pmid: string
          user_id: string
        }
        Insert: {
          ai_summary?: string | null
          created_at?: string
          id?: string
          pmid: string
          user_id: string
        }
        Update: {
          ai_summary?: string | null
          created_at?: string
          id?: string
          pmid?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          messages: Json
          paper_pmid: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          paper_pmid: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          paper_pmid?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_usage: {
        Row: {
          count: number
          paper_pmid: string
          used_at: string
          user_id: string
        }
        Insert: {
          count?: number
          paper_pmid: string
          used_at?: string
          user_id: string
        }
        Update: {
          count?: number
          paper_pmid?: string
          used_at?: string
          user_id?: string
        }
        Relationships: []
      }
      comment_reports: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          reason: string | null
          reporter_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          reason?: string | null
          reporter_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "paper_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      conference_proposals: {
        Row: {
          conference_id: string
          confidence: string | null
          created_at: string
          current_end_date: string | null
          current_start_date: string | null
          id: string
          proposed_end_date: string | null
          proposed_start_date: string | null
          reasoning: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_url: string | null
          status: string
        }
        Insert: {
          conference_id: string
          confidence?: string | null
          created_at?: string
          current_end_date?: string | null
          current_start_date?: string | null
          id?: string
          proposed_end_date?: string | null
          proposed_start_date?: string | null
          reasoning?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_url?: string | null
          status?: string
        }
        Update: {
          conference_id?: string
          confidence?: string | null
          created_at?: string
          current_end_date?: string | null
          current_start_date?: string | null
          id?: string
          proposed_end_date?: string | null
          proposed_start_date?: string | null
          reasoning?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "conference_proposals_conference_id_fkey"
            columns: ["conference_id"]
            isOneToOne: false
            referencedRelation: "conferences"
            referencedColumns: ["id"]
          },
        ]
      }
      conferences: {
        Row: {
          country: string | null
          created_at: string | null
          date_confirmed: boolean | null
          end_date: string | null
          id: string
          is_korean: boolean | null
          location: string | null
          name: string
          name_ko: string | null
          scraped_at: string | null
          source_url: string | null
          start_date: string | null
          tags: string[] | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          date_confirmed?: boolean | null
          end_date?: string | null
          id?: string
          is_korean?: boolean | null
          location?: string | null
          name: string
          name_ko?: string | null
          scraped_at?: string | null
          source_url?: string | null
          start_date?: string | null
          tags?: string[] | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string | null
          date_confirmed?: boolean | null
          end_date?: string | null
          id?: string
          is_korean?: boolean | null
          location?: string | null
          name?: string
          name_ko?: string | null
          scraped_at?: string | null
          source_url?: string | null
          start_date?: string | null
          tags?: string[] | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      geography_insights: {
        Row: {
          computed_at: string
          days: number
          from_date: string
          id: string
          locations: Json
          total_first_authors: number
        }
        Insert: {
          computed_at?: string
          days: number
          from_date: string
          id?: string
          locations?: Json
          total_first_authors?: number
        }
        Update: {
          computed_at?: string
          days?: number
          from_date?: string
          id?: string
          locations?: Json
          total_first_authors?: number
        }
        Relationships: []
      }
      journals: {
        Row: {
          abbreviation: string
          color: string
          created_at: string
          e_issn: string | null
          id: string
          impact_factor: number | null
          issn: string | null
          name: string
          slug: string
        }
        Insert: {
          abbreviation: string
          color?: string
          created_at?: string
          e_issn?: string | null
          id?: string
          impact_factor?: number | null
          issn?: string | null
          name: string
          slug: string
        }
        Update: {
          abbreviation?: string
          color?: string
          created_at?: string
          e_issn?: string | null
          id?: string
          impact_factor?: number | null
          issn?: string | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          paper_pmid: string
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          paper_pmid: string
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          paper_pmid?: string
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "paper_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      paper_authors: {
        Row: {
          affiliation: string | null
          first_name: string | null
          id: string
          initials: string | null
          last_name: string
          paper_id: string
          position: number
        }
        Insert: {
          affiliation?: string | null
          first_name?: string | null
          id?: string
          initials?: string | null
          last_name: string
          paper_id: string
          position?: number
        }
        Update: {
          affiliation?: string | null
          first_name?: string | null
          id?: string
          initials?: string | null
          last_name?: string
          paper_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "paper_authors_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "papers"
            referencedColumns: ["id"]
          },
        ]
      }
      paper_citations: {
        Row: {
          created_at: string
          source_pmid: string
          target_pmid: string
        }
        Insert: {
          created_at?: string
          source_pmid: string
          target_pmid: string
        }
        Update: {
          created_at?: string
          source_pmid?: string
          target_pmid?: string
        }
        Relationships: []
      }
      paper_comments: {
        Row: {
          anon_id: string
          content: string
          created_at: string
          deleted_at: string | null
          id: string
          paper_pmid: string
          parent_id: string | null
          report_count: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          anon_id: string
          content: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          paper_pmid: string
          parent_id?: string | null
          report_count?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          anon_id?: string
          content?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          paper_pmid?: string
          parent_id?: string | null
          report_count?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paper_comments_paper_pmid_fkey"
            columns: ["paper_pmid"]
            isOneToOne: false
            referencedRelation: "papers"
            referencedColumns: ["pmid"]
          },
          {
            foreignKeyName: "paper_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "paper_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      paper_feedback: {
        Row: {
          created_at: string
          feedback: Database["public"]["Enums"]["paper_feedback_kind"]
          paper_pmid: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback: Database["public"]["Enums"]["paper_feedback_kind"]
          paper_pmid: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          feedback?: Database["public"]["Enums"]["paper_feedback_kind"]
          paper_pmid?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      paper_graph_snapshots: {
        Row: {
          computed_at: string
          edge_count: number
          node_count: number
          payload: Json
          scope: string
        }
        Insert: {
          computed_at?: string
          edge_count: number
          node_count: number
          payload: Json
          scope: string
        }
        Update: {
          computed_at?: string
          edge_count?: number
          node_count?: number
          payload?: Json
          scope?: string
        }
        Relationships: []
      }
      paper_likes: {
        Row: {
          created_at: string
          id: string
          paper_pmid: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          paper_pmid: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          paper_pmid?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paper_likes_paper_pmid_fkey"
            columns: ["paper_pmid"]
            isOneToOne: false
            referencedRelation: "papers"
            referencedColumns: ["pmid"]
          },
        ]
      }
      paper_mentions: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          mentioned_pmid: string
          source_pmid: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          mentioned_pmid: string
          source_pmid: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          mentioned_pmid?: string
          source_pmid?: string
        }
        Relationships: [
          {
            foreignKeyName: "paper_mentions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "paper_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      papers: {
        Row: {
          abstract: string | null
          ai_summary: string | null
          citation_count: number | null
          created_at: string
          crossref_data: Json | null
          doi: string | null
          embedding: string | null
          epub_date: string | null
          id: string
          issue: string | null
          journal_id: string
          keywords: string[] | null
          mesh_terms: string[] | null
          pages: string | null
          pmid: string
          publication_date: string
          publication_types: string[]
          search_vector: unknown
          title: string
          topic_tags: string[] | null
          updated_at: string
          volume: string | null
        }
        Insert: {
          abstract?: string | null
          ai_summary?: string | null
          citation_count?: number | null
          created_at?: string
          crossref_data?: Json | null
          doi?: string | null
          embedding?: string | null
          epub_date?: string | null
          id?: string
          issue?: string | null
          journal_id: string
          keywords?: string[] | null
          mesh_terms?: string[] | null
          pages?: string | null
          pmid: string
          publication_date: string
          publication_types?: string[]
          search_vector?: unknown
          title: string
          topic_tags?: string[] | null
          updated_at?: string
          volume?: string | null
        }
        Update: {
          abstract?: string | null
          ai_summary?: string | null
          citation_count?: number | null
          created_at?: string
          crossref_data?: Json | null
          doi?: string | null
          embedding?: string | null
          epub_date?: string | null
          id?: string
          issue?: string | null
          journal_id?: string
          keywords?: string[] | null
          mesh_terms?: string[] | null
          pages?: string | null
          pmid?: string
          publication_date?: string
          publication_types?: string[]
          search_vector?: unknown
          title?: string
          topic_tags?: string[] | null
          updated_at?: string
          volume?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "papers_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
        ]
      }
      pubmed_query_cache: {
        Row: {
          fetched_at: string
          pmids: string[]
          query_hash: string
          ttl_seconds: number
        }
        Insert: {
          fetched_at?: string
          pmids?: string[]
          query_hash: string
          ttl_seconds?: number
        }
        Update: {
          fetched_at?: string
          pmids?: string[]
          query_hash?: string
          ttl_seconds?: number
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          journal_id: string
          papers_found: number
          papers_inserted: number
          papers_updated: number
          started_at: string
          status: string
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          journal_id: string
          papers_found?: number
          papers_inserted?: number
          papers_updated?: number
          started_at?: string
          status?: string
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          journal_id?: string
          papers_found?: number
          papers_inserted?: number
          papers_updated?: number
          started_at?: string
          status?: string
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
        ]
      }
      trending_analysis: {
        Row: {
          ai_summary: string
          created_at: string
          date: string
          id: string
          stats_json: Json
        }
        Insert: {
          ai_summary: string
          created_at?: string
          date: string
          id?: string
          stats_json?: Json
        }
        Update: {
          ai_summary?: string
          created_at?: string
          date?: string
          id?: string
          stats_json?: Json
        }
        Relationships: []
      }
      user_affinity_profiles: {
        Row: {
          article_types: Json
          authors: Json
          feedback_count: number
          journals: Json
          keywords: Json
          mesh_terms: Json
          topics: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          article_types?: Json
          authors?: Json
          feedback_count?: number
          journals?: Json
          keywords?: Json
          mesh_terms?: Json
          topics?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          article_types?: Json
          authors?: Json
          feedback_count?: number
          journals?: Json
          keywords?: Json
          mesh_terms?: Json
          topics?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_pubmed_query_cache: { Args: never; Returns: number }
      get_agora_papers: {
        Args: { p_limit: number; p_offset: number }
        Returns: {
          comment_count: number
          latest_comment_at: string
          paper_pmid: string
          total_count: number
        }[]
      }
      is_email_confirmed: { Args: never; Returns: boolean }
      paper_similarity_edges_topk: {
        Args: { p_k: number; p_threshold: number }
        Returns: {
          similarity: number
          source_pmid: string
          target_pmid: string
        }[]
      }
      search_papers: {
        Args: {
          date_from?: string
          date_to?: string
          journal_slugs?: string[]
          page_num?: number
          page_size?: number
          search_query?: string
          sort_by?: string
        }
        Returns: {
          abstract: string
          citation_count: number
          doi: string
          id: string
          issue: string
          journal_abbreviation: string
          journal_color: string
          journal_id: string
          journal_name: string
          journal_slug: string
          keywords: string[]
          mesh_terms: string[]
          pages: string
          pmid: string
          publication_date: string
          title: string
          total_count: number
          volume: string
        }[]
      }
    }
    Enums: {
      paper_feedback_kind: "interested" | "not_interested"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      paper_feedback_kind: ["interested", "not_interested"],
    },
  },
} as const
