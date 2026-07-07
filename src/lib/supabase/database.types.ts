export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      club_invites: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          club_id: string;
          created_at: string;
          created_by: string;
          expires_at: string | null;
          id: string;
          status: Database["public"]["Enums"]["invite_status"];
          token_hash: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          club_id: string;
          created_at?: string;
          created_by: string;
          expires_at?: string | null;
          id?: string;
          status?: Database["public"]["Enums"]["invite_status"];
          token_hash: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          club_id?: string;
          created_at?: string;
          created_by?: string;
          expires_at?: string | null;
          id?: string;
          status?: Database["public"]["Enums"]["invite_status"];
          token_hash?: string;
        };
        Relationships: [];
      };
      club_members: {
        Row: {
          club_id: string;
          created_at: string;
          role: Database["public"]["Enums"]["club_role"];
          user_id: string;
        };
        Insert: {
          club_id: string;
          created_at?: string;
          role?: Database["public"]["Enums"]["club_role"];
          user_id: string;
        };
        Update: {
          club_id?: string;
          created_at?: string;
          role?: Database["public"]["Enums"]["club_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      club_paper_schedule: {
        Row: {
          club_id: string;
          created_at: string;
          created_by: string;
          id: string;
          notes: string | null;
          paper_id: string;
          week_start: string | null;
        };
        Insert: {
          club_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          notes?: string | null;
          paper_id: string;
          week_start?: string | null;
        };
        Update: {
          club_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          notes?: string | null;
          paper_id?: string;
          week_start?: string | null;
        };
        Relationships: [];
      };
      clubs: {
        Row: {
          created_at: string;
          created_by: string;
          description: string | null;
          id: string;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          description?: string | null;
          id?: string;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          description?: string | null;
          id?: string;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      comments: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          schedule_id: string;
          updated_at: string;
        };
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          schedule_id: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          schedule_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      paper_annotation_replies: {
        Row: {
          annotation_id: string;
          author_id: string;
          body: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          annotation_id: string;
          author_id: string;
          body: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          updated_at?: string;
        };
        Update: {
          annotation_id?: string;
          author_id?: string;
          body?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      paper_annotations: {
        Row: {
          author_id: string;
          body: string | null;
          color: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          kind: Database["public"]["Enums"]["paper_annotation_kind"];
          page_number: number;
          paper_id: string;
          position: Json;
          quote: string | null;
          schedule_id: string;
          updated_at: string;
        };
        Insert: {
          author_id: string;
          body?: string | null;
          color?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["paper_annotation_kind"];
          page_number: number;
          paper_id: string;
          position: Json;
          quote?: string | null;
          schedule_id: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string;
          body?: string | null;
          color?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["paper_annotation_kind"];
          page_number?: number;
          paper_id?: string;
          position?: Json;
          quote?: string | null;
          schedule_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      papers: {
        Row: {
          abstract: string | null;
          abstract_url: string | null;
          arxiv_id: string | null;
          authors: Json;
          created_at: string;
          doi: string | null;
          external_url: string | null;
          id: string;
          license: string | null;
          page_count: number | null;
          pdf_url: string | null;
          published_at: string | null;
          source_type: Database["public"]["Enums"]["paper_source_type"];
          source_updated_at: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          abstract?: string | null;
          abstract_url?: string | null;
          arxiv_id?: string | null;
          authors?: Json;
          created_at?: string;
          doi?: string | null;
          external_url?: string | null;
          id?: string;
          license?: string | null;
          page_count?: number | null;
          pdf_url?: string | null;
          published_at?: string | null;
          source_type: Database["public"]["Enums"]["paper_source_type"];
          source_updated_at?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          abstract?: string | null;
          abstract_url?: string | null;
          arxiv_id?: string | null;
          authors?: Json;
          created_at?: string;
          doi?: string | null;
          external_url?: string | null;
          id?: string;
          license?: string | null;
          page_count?: number | null;
          pdf_url?: string | null;
          published_at?: string | null;
          source_type?: Database["public"]["Enums"]["paper_source_type"];
          source_updated_at?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      personal_papers: {
        Row: {
          created_at: string;
          deadline: string | null;
          id: string;
          paper_id: string;
          read_at: string | null;
          status: Database["public"]["Enums"]["paper_status"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          deadline?: string | null;
          id?: string;
          paper_id: string;
          read_at?: string | null;
          status?: Database["public"]["Enums"]["paper_status"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          deadline?: string | null;
          id?: string;
          paper_id?: string;
          read_at?: string | null;
          status?: Database["public"]["Enums"]["paper_status"];
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_color: string;
          avatar_id: string;
          bio: string | null;
          created_at: string;
          display_name: string;
          id: string;
          is_public: boolean;
          updated_at: string;
        };
        Insert: {
          avatar_color?: string;
          avatar_id?: string;
          bio?: string | null;
          created_at?: string;
          display_name: string;
          id: string;
          is_public?: boolean;
          updated_at?: string;
        };
        Update: {
          avatar_color?: string;
          avatar_id?: string;
          bio?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          is_public?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      reading_logs: {
        Row: {
          id: string;
          read_at: string;
          schedule_id: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          read_at?: string;
          schedule_id: string;
          user_id: string;
        };
        Update: {
          id?: string;
          read_at?: string;
          schedule_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      reading_sessions: {
        Row: {
          id: string;
          logged_at: string;
          pages_read: number;
          personal_paper_id: string | null;
          schedule_id: string | null;
          user_id: string;
        };
        Insert: {
          id?: string;
          logged_at?: string;
          pages_read: number;
          personal_paper_id?: string | null;
          schedule_id?: string | null;
          user_id: string;
        };
        Update: {
          id?: string;
          logged_at?: string;
          pages_read?: number;
          personal_paper_id?: string | null;
          schedule_id?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      schedule_paper_statuses: {
        Row: {
          id: string;
          read_at: string | null;
          schedule_id: string;
          status: Database["public"]["Enums"]["paper_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          read_at?: string | null;
          schedule_id: string;
          status?: Database["public"]["Enums"]["paper_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          read_at?: string | null;
          schedule_id?: string;
          status?: Database["public"]["Enums"]["paper_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invite: {
        Args: { p_token: string };
        Returns: Database["public"]["Tables"]["club_members"]["Row"];
      };
      add_personal_arxiv_paper: {
        Args: { p_arxiv_metadata: Json; p_deadline?: string | null };
        Returns: Database["public"]["Tables"]["personal_papers"]["Row"];
      };
      add_personal_manual_paper: {
        Args: { p_deadline?: string | null; p_metadata: Json };
        Returns: Database["public"]["Tables"]["personal_papers"]["Row"];
      };
      create_club: {
        Args: { p_description?: string | null; p_name: string; p_slug: string };
        Returns: Database["public"]["Tables"]["clubs"]["Row"];
      };
      create_invite_link: {
        Args: { p_club_id: string; p_expires_at?: string | null };
        Returns: {
          created_at: string;
          expires_at: string;
          id: string;
          token: string;
        }[];
      };
      delete_scheduled_paper: {
        Args: { p_schedule_id: string };
        Returns: Database["public"]["Tables"]["club_paper_schedule"]["Row"];
      };
      get_club_schedule_progress: {
        Args: { p_club_id: string };
        Returns: {
          current_user_pages_read: number;
          current_user_read: boolean;
          current_user_session_count: number;
          current_user_status: Database["public"]["Enums"]["paper_status"];
          read_count: number;
          schedule_id: string;
          total_members: number;
        }[];
      };
      leave_club: {
        Args: { p_club_id: string };
        Returns: {
          club_id: string;
          deleted_club: boolean;
        }[];
      };
      log_personal_paper_reading_session: {
        Args: { p_pages_read: number; p_personal_paper_id: string };
        Returns: Database["public"]["Tables"]["reading_sessions"]["Row"];
      };
      log_schedule_reading_session: {
        Args: { p_pages_read: number; p_schedule_id: string };
        Returns: Database["public"]["Tables"]["reading_sessions"]["Row"];
      };
      revoke_invite_link: {
        Args: { p_invite_id: string };
        Returns: Database["public"]["Tables"]["club_invites"]["Row"];
      };
      set_club_member_role: {
        Args: {
          p_club_id: string;
          p_role: Database["public"]["Enums"]["club_role"];
          p_user_id: string;
        };
        Returns: Database["public"]["Tables"]["club_members"]["Row"];
      };
      schedule_arxiv_paper: {
        Args: {
          p_arxiv_metadata: Json;
          p_club_id: string;
          p_notes?: string | null;
          p_week_start?: string | null;
        };
        Returns: Database["public"]["Tables"]["club_paper_schedule"]["Row"];
      };
      schedule_existing_paper: {
        Args: {
          p_club_id: string;
          p_notes?: string | null;
          p_paper_id: string;
          p_week_start?: string | null;
        };
        Returns: Database["public"]["Tables"]["club_paper_schedule"]["Row"];
      };
      schedule_manual_paper: {
        Args: {
          p_club_id: string;
          p_metadata: Json;
          p_notes?: string | null;
          p_week_start?: string | null;
        };
        Returns: Database["public"]["Tables"]["club_paper_schedule"]["Row"];
      };
      set_personal_paper_status: {
        Args: {
          p_personal_paper_id: string;
          p_status: Database["public"]["Enums"]["paper_status"];
        };
        Returns: Database["public"]["Tables"]["personal_papers"]["Row"];
      };
      set_schedule_paper_status: {
        Args: {
          p_schedule_id: string;
          p_status: Database["public"]["Enums"]["paper_status"];
        };
        Returns: {
          read: boolean;
          reading_log_id: string | null;
          schedule_id: string;
          status: Database["public"]["Enums"]["paper_status"];
        }[];
      };
      transfer_club_ownership: {
        Args: { p_club_id: string; p_new_owner_id: string };
        Returns: Database["public"]["Tables"]["club_members"]["Row"];
      };
      toggle_personal_paper_read_status: {
        Args: { p_personal_paper_id: string; p_read: boolean };
        Returns: Database["public"]["Tables"]["personal_papers"]["Row"];
      };
      toggle_read_status: {
        Args: { p_read: boolean; p_schedule_id: string };
        Returns: {
          read: boolean;
          reading_log_id: string | null;
          schedule_id: string;
          status: Database["public"]["Enums"]["paper_status"];
        }[];
      };
      update_paper_page_count: {
        Args: { p_page_count: number; p_paper_id: string };
        Returns: Database["public"]["Tables"]["papers"]["Row"];
      };
      update_scheduled_paper_deadline: {
        Args: { p_schedule_id: string; p_week_start?: string | null };
        Returns: Database["public"]["Tables"]["club_paper_schedule"]["Row"];
      };
    };
    Enums: {
      club_role: "owner" | "admin" | "member";
      invite_status: "pending" | "accepted" | "revoked" | "expired";
      paper_annotation_kind: "highlight" | "question" | "explanation" | "note";
      paper_source_type: "arxiv" | "manual";
      paper_status: "planned" | "reading" | "on_hold" | "dropped" | "read";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      club_role: ["owner", "admin", "member"],
      invite_status: ["pending", "accepted", "revoked", "expired"],
      paper_annotation_kind: ["highlight", "question", "explanation", "note"],
      paper_source_type: ["arxiv", "manual"],
      paper_status: ["planned", "reading", "on_hold", "dropped", "read"],
    },
  },
} as const;
