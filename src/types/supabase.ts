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
  public: {
    Tables: {
      bookmarks: {
        Row: {
          id: string
          user_id: string
          pmid: string
          created_at: string
          ai_summary: string | null
        }
        Insert: {
          id?: string
          user_id: string
          pmid: string
          created_at?: string
          ai_summary?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          pmid?: string
          created_at?: string
          ai_summary?: string | null
        }
        Relationships: []
      }
      email_subscriptions: {
        Row: {
          id: string
          user_id: string
          journal_slug: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          journal_slug: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          journal_slug?: string
          created_at?: string
        }
        Relationships: []
      }
      conferences: {
        Row: {
          id: string
          name: string
          name_ko: string | null
          start_date: string | null
          end_date: string | null
          location: string | null
          country: string | null
          tags: string[]
          website: string | null
          is_korean: boolean
          source_url: string | null
          scraped_at: string | null
          created_at: string
          updated_at: string
          date_confirmed: boolean
        }
        Insert: {
          id?: string
          name: string
          name_ko?: string | null
          start_date?: string | null
          end_date?: string | null
          location?: string | null
          country?: string | null
          tags?: string[]
          website?: string | null
          is_korean?: boolean
          source_url?: string | null
          scraped_at?: string | null
          created_at?: string
          updated_at?: string
          date_confirmed?: boolean
        }
        Update: {
          id?: string
          name?: string
          name_ko?: string | null
          start_date?: string | null
          end_date?: string | null
          location?: string | null
          country?: string | null
          tags?: string[]
          website?: string | null
          is_korean?: boolean
          source_url?: string | null
          scraped_at?: string | null
          created_at?: string
          updated_at?: string
          date_confirmed?: boolean
        }
        Relationships: []
      }
      keyword_alerts: {
        Row: {
          id: string
          user_id: string
          keyword: string
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          keyword: string
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          keyword?: string
          active?: boolean
          created_at?: string
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
          issn: string
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
          issn: string
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
          issn?: string
          name?: string
          slug?: string
        }
        Relationships: []
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
      papers: {
        Row: {
          abstract: string | null
          citation_count: number | null
          created_at: string
          crossref_data: Json | null
          doi: string | null
          epub_date: string | null
          id: string
          issue: string | null
          journal_id: string
          keywords: string[] | null
          mesh_terms: string[] | null
          pages: string | null
          pmid: string
          publication_date: string
          search_vector: unknown
          title: string
          updated_at: string
          volume: string | null
        }
        Insert: {
          abstract?: string | null
          citation_count?: number | null
          created_at?: string
          crossref_data?: Json | null
          doi?: string | null
          epub_date?: string | null
          id?: string
          issue?: string | null
          journal_id: string
          keywords?: string[] | null
          mesh_terms?: string[] | null
          pages?: string | null
          pmid: string
          publication_date: string
          search_vector?: unknown
          title: string
          updated_at?: string
          volume?: string | null
        }
        Update: {
          abstract?: string | null
          citation_count?: number | null
          created_at?: string
          crossref_data?: Json | null
          doi?: string | null
          epub_date?: string | null
          id?: string
          issue?: string | null
          journal_id?: string
          keywords?: string[] | null
          mesh_terms?: string[] | null
          pages?: string | null
          pmid?: string
          publication_date?: string
          search_vector?: unknown
          title?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
