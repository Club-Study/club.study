export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      club_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          club_id: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          status: Database["public"]["Enums"]["invite_status"]
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          club_id: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          status?: Database["public"]["Enums"]["invite_status"]
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          club_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          status?: Database["public"]["Enums"]["invite_status"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_invites_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_members: {
        Row: {
          club_id: string
          created_at: string
          role: Database["public"]["Enums"]["club_role"]
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          role?: Database["public"]["Enums"]["club_role"]
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          role?: Database["public"]["Enums"]["club_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_paper_schedule: {
        Row: {
          club_id: string
          created_at: string
          created_by: string
          id: string
          notes: string | null
          paper_id: string
          week_start: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          paper_id: string
          week_start: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          paper_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_paper_schedule_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_paper_schedule_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_paper_schedule_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "papers"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clubs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          schedule_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          schedule_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          schedule_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "club_paper_schedule"
            referencedColumns: ["id"]
          },
        ]
      }
      paper_annotation_replies: {
        Row: {
          annotation_id: string
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          updated_at: string
        }
        Insert: {
          annotation_id: string
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          annotation_id?: string
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paper_annotation_replies_annotation_id_fkey"
            columns: ["annotation_id"]
            isOneToOne: false
            referencedRelation: "paper_annotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paper_annotation_replies_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      paper_annotations: {
        Row: {
          author_id: string
          body: string | null
          color: string
          created_at: string
          deleted_at: string | null
          id: string
          kind: Database["public"]["Enums"]["paper_annotation_kind"]
          page_number: number
          paper_id: string
          position: Json
          quote: string | null
          schedule_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body?: string | null
          color?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["paper_annotation_kind"]
          page_number: number
          paper_id: string
          position: Json
          quote?: string | null
          schedule_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string | null
          color?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["paper_annotation_kind"]
          page_number?: number
          paper_id?: string
          position?: Json
          quote?: string | null
          schedule_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paper_annotations_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paper_annotations_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paper_annotations_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "club_paper_schedule"
            referencedColumns: ["id"]
          },
        ]
      }
      papers: {
        Row: {
          abstract: string | null
          abstract_url: string | null
          arxiv_id: string | null
          authors: Json
          created_at: string
          doi: string | null
          external_url: string | null
          id: string
          license: string | null
          pdf_url: string | null
          published_at: string | null
          source_type: Database["public"]["Enums"]["paper_source_type"]
          source_updated_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          abstract?: string | null
          abstract_url?: string | null
          arxiv_id?: string | null
          authors?: Json
          created_at?: string
          doi?: string | null
          external_url?: string | null
          id?: string
          license?: string | null
          pdf_url?: string | null
          published_at?: string | null
          source_type: Database["public"]["Enums"]["paper_source_type"]
          source_updated_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          abstract?: string | null
          abstract_url?: string | null
          arxiv_id?: string | null
          authors?: Json
          created_at?: string
          doi?: string | null
          external_url?: string | null
          id?: string
          license?: string | null
          pdf_url?: string | null
          published_at?: string | null
          source_type?: Database["public"]["Enums"]["paper_source_type"]
          source_updated_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_color: string
          avatar_id: string
          bio: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_color?: string
          avatar_id?: string
          bio?: string | null
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_color?: string
          avatar_id?: string
          bio?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      reading_logs: {
        Row: {
          id: string
          read_at: string
          schedule_id: string
          user_id: string
        }
        Insert: {
          id?: string
          read_at?: string
          schedule_id: string
          user_id: string
        }
        Update: {
          id?: string
          read_at?: string
          schedule_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_logs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "club_paper_schedule"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: {
        Args: { p_token: string }
        Returns: {
          club_id: string
          created_at: string
          role: Database["public"]["Enums"]["club_role"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "club_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_club: {
        Args: { p_description?: string; p_name: string; p_slug: string }
        Returns: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "clubs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_invite_link: {
        Args: { p_club_id: string; p_expires_at?: string }
        Returns: {
          created_at: string
          expires_at: string
          id: string
          token: string
        }[]
      }
      get_club_schedule_progress: {
        Args: { p_club_id: string }
        Returns: {
          current_user_read: boolean
          read_count: number
          schedule_id: string
          total_members: number
        }[]
      }
      revoke_invite_link: {
        Args: { p_invite_id: string }
        Returns: {
          accepted_at: string | null
          accepted_by: string | null
          club_id: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          status: Database["public"]["Enums"]["invite_status"]
          token_hash: string
        }
        SetofOptions: {
          from: "*"
          to: "club_invites"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      schedule_arxiv_paper: {
        Args: {
          p_arxiv_metadata: Json
          p_club_id: string
          p_notes?: string
          p_week_start: string
        }
        Returns: {
          club_id: string
          created_at: string
          created_by: string
          id: string
          notes: string | null
          paper_id: string
          week_start: string
        }
        SetofOptions: {
          from: "*"
          to: "club_paper_schedule"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      schedule_manual_paper: {
        Args: {
          p_club_id: string
          p_metadata: Json
          p_notes?: string
          p_week_start: string
        }
        Returns: {
          club_id: string
          created_at: string
          created_by: string
          id: string
          notes: string | null
          paper_id: string
          week_start: string
        }
        SetofOptions: {
          from: "*"
          to: "club_paper_schedule"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      toggle_read_status: {
        Args: { p_read: boolean; p_schedule_id: string }
        Returns: boolean
      }
    }
    Enums: {
      club_role: "owner" | "member"
      invite_status: "pending" | "accepted" | "revoked" | "expired"
      paper_annotation_kind: "highlight" | "question" | "explanation" | "note"
      paper_source_type: "arxiv" | "manual"
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
    Enums: {
      club_role: ["owner", "member"],
      invite_status: ["pending", "accepted", "revoked", "expired"],
      paper_source_type: ["arxiv", "manual"],
    },
  },
} as const
