export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      club_email_notifications: {
        Row: {
          attempts: number
          available_at: string
          club_id: string
          created_at: string
          deadline_snapshot: string | null
          dedupe_key: string
          id: string
          kind: Database["public"]["Enums"]["club_email_notification_kind"]
          last_error: string | null
          locked_at: string | null
          provider_message_id: string | null
          schedule_id: string
          sent_at: string | null
          state: Database["public"]["Enums"]["club_email_notification_state"]
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          club_id: string
          created_at?: string
          deadline_snapshot?: string | null
          dedupe_key: string
          id?: string
          kind: Database["public"]["Enums"]["club_email_notification_kind"]
          last_error?: string | null
          locked_at?: string | null
          provider_message_id?: string | null
          schedule_id: string
          sent_at?: string | null
          state?: Database["public"]["Enums"]["club_email_notification_state"]
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          available_at?: string
          club_id?: string
          created_at?: string
          deadline_snapshot?: string | null
          dedupe_key?: string
          id?: string
          kind?: Database["public"]["Enums"]["club_email_notification_kind"]
          last_error?: string | null
          locked_at?: string | null
          provider_message_id?: string | null
          schedule_id?: string
          sent_at?: string | null
          state?: Database["public"]["Enums"]["club_email_notification_state"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_email_notifications_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_email_notifications_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "club_paper_schedule"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_email_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_email_subscriptions: {
        Row: {
          club_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_email_subscriptions_club_id_user_id_fkey"
            columns: ["club_id", "user_id"]
            isOneToOne: true
            referencedRelation: "club_members"
            referencedColumns: ["club_id", "user_id"]
          },
        ]
      }
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
      club_join_requests: {
        Row: {
          club_id: string
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["club_join_request_status"]
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["club_join_request_status"]
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["club_join_request_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_join_requests_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_join_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_join_requests_user_id_fkey"
            columns: ["user_id"]
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
          page_count: number | null
          paper_id: string
          week_start: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          page_count?: number | null
          paper_id: string
          week_start?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          page_count?: number | null
          paper_id?: string
          week_start?: string | null
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
            foreignKeyName: "paper_annotations_schedule_paper_fkey"
            columns: ["schedule_id", "paper_id"]
            isOneToOne: false
            referencedRelation: "club_paper_schedule"
            referencedColumns: ["id", "paper_id"]
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
          manual_scope: string | null
          page_count: number | null
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
          manual_scope?: string | null
          page_count?: number | null
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
          manual_scope?: string | null
          page_count?: number | null
          pdf_url?: string | null
          published_at?: string | null
          source_type?: Database["public"]["Enums"]["paper_source_type"]
          source_updated_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      personal_papers: {
        Row: {
          created_at: string
          deadline: string | null
          id: string
          page_count: number | null
          paper_id: string
          read_at: string | null
          status: Database["public"]["Enums"]["paper_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          id?: string
          page_count?: number | null
          paper_id: string
          read_at?: string | null
          status?: Database["public"]["Enums"]["paper_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          id?: string
          page_count?: number | null
          paper_id?: string
          read_at?: string | null
          status?: Database["public"]["Enums"]["paper_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_papers_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_papers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_color: string
          avatar_id: string
          bio: string | null
          created_at: string
          display_name: string
          id: string
          is_public: boolean
          updated_at: string
        }
        Insert: {
          avatar_color?: string
          avatar_id?: string
          bio?: string | null
          created_at?: string
          display_name: string
          id: string
          is_public?: boolean
          updated_at?: string
        }
        Update: {
          avatar_color?: string
          avatar_id?: string
          bio?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_public?: boolean
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
      reading_sessions: {
        Row: {
          id: string
          logged_at: string
          pages_read: number
          personal_paper_id: string | null
          schedule_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          logged_at?: string
          pages_read: number
          personal_paper_id?: string | null
          schedule_id?: string | null
          user_id: string
        }
        Update: {
          id?: string
          logged_at?: string
          pages_read?: number
          personal_paper_id?: string | null
          schedule_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_sessions_personal_paper_id_fkey"
            columns: ["personal_paper_id"]
            isOneToOne: false
            referencedRelation: "personal_papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_sessions_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "club_paper_schedule"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_paper_statuses: {
        Row: {
          id: string
          read_at: string | null
          schedule_id: string
          status: Database["public"]["Enums"]["paper_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          read_at?: string | null
          schedule_id: string
          status?: Database["public"]["Enums"]["paper_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          read_at?: string | null
          schedule_id?: string
          status?: Database["public"]["Enums"]["paper_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_paper_statuses_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "club_paper_schedule"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_paper_statuses_user_id_fkey"
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
      add_personal_arxiv_paper: {
        Args: { p_arxiv_metadata: Json; p_deadline?: string }
        Returns: {
          created_at: string
          deadline: string | null
          id: string
          page_count: number | null
          paper_id: string
          read_at: string | null
          status: Database["public"]["Enums"]["paper_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "personal_papers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_personal_manual_paper: {
        Args: { p_deadline?: string; p_metadata: Json }
        Returns: {
          created_at: string
          deadline: string | null
          id: string
          page_count: number | null
          paper_id: string
          read_at: string | null
          status: Database["public"]["Enums"]["paper_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "personal_papers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_to_club: {
        Args: { p_club_id: string }
        Returns: {
          club_id: string
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["club_join_request_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "club_join_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_club_email_notifications: {
        Args: { p_limit?: number; p_now?: string }
        Returns: {
          attempt_count: number
          club_id: string
          club_name: string
          deadline: string
          notification_id: string
          notification_kind: Database["public"]["Enums"]["club_email_notification_kind"]
          paper_title: string
          recipient_email: string
          recipient_name: string
          schedule_id: string
        }[]
      }
      consume_arxiv_rate_limit: {
        Args: { p_user_id: string }
        Returns: {
          allowed: boolean
          remaining: number
          reset_at: string
        }[]
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
      delete_scheduled_paper: {
        Args: { p_schedule_id: string }
        Returns: {
          club_id: string
          created_at: string
          created_by: string
          id: string
          notes: string | null
          page_count: number | null
          paper_id: string
          week_start: string | null
        }
        SetofOptions: {
          from: "*"
          to: "club_paper_schedule"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_profile: {
        Args: {
          p_avatar_color?: string
          p_avatar_id?: string
          p_display_name: string
        }
        Returns: {
          avatar_color: string
          avatar_id: string
          bio: string | null
          created_at: string
          display_name: string
          id: string
          is_public: boolean
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_club_schedule_progress: {
        Args: { p_club_id: string }
        Returns: {
          current_user_pages_read: number
          current_user_read: boolean
          current_user_session_count: number
          current_user_status: Database["public"]["Enums"]["paper_status"]
          read_count: number
          schedule_id: string
          total_members: number
        }[]
      }
      import_arxiv_personal: {
        Args: { p_arxiv_metadata: Json; p_deadline?: string; p_user_id: string }
        Returns: {
          created_at: string
          deadline: string | null
          id: string
          page_count: number | null
          paper_id: string
          read_at: string | null
          status: Database["public"]["Enums"]["paper_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "personal_papers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      import_arxiv_schedule: {
        Args: {
          p_arxiv_metadata: Json
          p_club_id: string
          p_notes?: string
          p_user_id: string
          p_week_start: string
        }
        Returns: {
          club_id: string
          created_at: string
          created_by: string
          id: string
          notes: string | null
          page_count: number | null
          paper_id: string
          week_start: string | null
        }
        SetofOptions: {
          from: "*"
          to: "club_paper_schedule"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      leave_club: {
        Args: { p_club_id: string }
        Returns: {
          club_id: string
          deleted_club: boolean
        }[]
      }
      list_club_join_requests: {
        Args: { p_club_id: string }
        Returns: {
          avatar_color: string
          avatar_id: string
          bio: string
          created_at: string
          display_name: string
          request_id: string
          user_id: string
        }[]
      }
      list_discoverable_clubs: {
        Args: never
        Returns: {
          application_created_at: string
          application_status: Database["public"]["Enums"]["club_join_request_status"]
          description: string
          id: string
          member_count: number
          name: string
          viewer_role: Database["public"]["Enums"]["club_role"]
        }[]
      }
      log_personal_paper_reading_session: {
        Args: { p_pages_read: number; p_personal_paper_id: string }
        Returns: {
          id: string
          logged_at: string
          pages_read: number
          personal_paper_id: string | null
          schedule_id: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "reading_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      log_schedule_reading_session: {
        Args: { p_pages_read: number; p_schedule_id: string }
        Returns: {
          id: string
          logged_at: string
          pages_read: number
          personal_paper_id: string | null
          schedule_id: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "reading_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      queue_due_club_email_reminders: {
        Args: { p_now?: string }
        Returns: number
      }
      resolve_club_email_notification: {
        Args: {
          p_error?: string
          p_notification_id: string
          p_now?: string
          p_outcome: string
          p_provider_message_id?: string
          p_retry_at?: string
        }
        Returns: boolean
      }
      review_club_join_request: {
        Args: { p_decision: string; p_request_id: string }
        Returns: {
          club_id: string
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["club_join_request_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "club_join_requests"
          isOneToOne: true
          isSetofReturn: false
        }
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
      save_personal_reading_progress: {
        Args: {
          p_current_page: number
          p_personal_paper_id: string
          p_status: Database["public"]["Enums"]["paper_status"]
          p_total_pages: number
        }
        Returns: {
          context_id: string
          current_page: number
          read: boolean
          reading_session_id: string
          saved_status: Database["public"]["Enums"]["paper_status"]
          total_pages: number
        }[]
      }
      save_schedule_reading_progress: {
        Args: {
          p_current_page: number
          p_schedule_id: string
          p_status: Database["public"]["Enums"]["paper_status"]
          p_total_pages: number
        }
        Returns: {
          context_id: string
          current_page: number
          read: boolean
          reading_session_id: string
          saved_status: Database["public"]["Enums"]["paper_status"]
          total_pages: number
        }[]
      }
      schedule_arxiv_paper: {
        Args: {
          p_arxiv_metadata?: Json
          p_club_id: string
          p_notes?: string
          p_week_start?: string
        }
        Returns: {
          club_id: string
          created_at: string
          created_by: string
          id: string
          notes: string | null
          page_count: number | null
          paper_id: string
          week_start: string | null
        }
        SetofOptions: {
          from: "*"
          to: "club_paper_schedule"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      schedule_existing_paper: {
        Args: {
          p_club_id: string
          p_notes?: string
          p_paper_id: string
          p_week_start?: string
        }
        Returns: {
          club_id: string
          created_at: string
          created_by: string
          id: string
          notes: string | null
          page_count: number | null
          paper_id: string
          week_start: string | null
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
          p_metadata?: Json
          p_notes?: string
          p_week_start?: string
        }
        Returns: {
          club_id: string
          created_at: string
          created_by: string
          id: string
          notes: string | null
          page_count: number | null
          paper_id: string
          week_start: string | null
        }
        SetofOptions: {
          from: "*"
          to: "club_paper_schedule"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_club_member_role: {
        Args: {
          p_club_id: string
          p_role: Database["public"]["Enums"]["club_role"]
          p_user_id: string
        }
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
      set_personal_paper_status: {
        Args: {
          p_personal_paper_id: string
          p_status: Database["public"]["Enums"]["paper_status"]
        }
        Returns: {
          created_at: string
          deadline: string | null
          id: string
          page_count: number | null
          paper_id: string
          read_at: string | null
          status: Database["public"]["Enums"]["paper_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "personal_papers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_schedule_paper_status: {
        Args: {
          p_schedule_id: string
          p_status: Database["public"]["Enums"]["paper_status"]
        }
        Returns: {
          read: boolean
          reading_log_id: string
          schedule_id: string
          status: Database["public"]["Enums"]["paper_status"]
        }[]
      }
      soft_delete_comment: { Args: { p_comment_id: string }; Returns: string }
      soft_delete_paper_annotation: {
        Args: { p_annotation_id: string }
        Returns: string
      }
      soft_delete_paper_annotation_reply: {
        Args: { p_reply_id: string }
        Returns: string
      }
      toggle_personal_paper_read_status: {
        Args: { p_personal_paper_id: string; p_read: boolean }
        Returns: {
          created_at: string
          deadline: string | null
          id: string
          page_count: number | null
          paper_id: string
          read_at: string | null
          status: Database["public"]["Enums"]["paper_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "personal_papers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      toggle_read_status: {
        Args: { p_read: boolean; p_schedule_id: string }
        Returns: {
          read: boolean
          reading_log_id: string
          schedule_id: string
          status: Database["public"]["Enums"]["paper_status"]
        }[]
      }
      transfer_club_ownership: {
        Args: { p_club_id: string; p_new_owner_id: string }
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
      update_paper_page_count: {
        Args: { p_page_count: number; p_paper_id: string }
        Returns: {
          abstract: string | null
          abstract_url: string | null
          arxiv_id: string | null
          authors: Json
          created_at: string
          doi: string | null
          external_url: string | null
          id: string
          license: string | null
          manual_scope: string | null
          page_count: number | null
          pdf_url: string | null
          published_at: string | null
          source_type: Database["public"]["Enums"]["paper_source_type"]
          source_updated_at: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "papers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_scheduled_paper_deadline: {
        Args: { p_schedule_id: string; p_week_start?: string }
        Returns: {
          club_id: string
          created_at: string
          created_by: string
          id: string
          notes: string | null
          page_count: number | null
          paper_id: string
          week_start: string | null
        }
        SetofOptions: {
          from: "*"
          to: "club_paper_schedule"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      club_email_notification_kind: "scheduled" | "reminder_3d" | "reminder_1d"
      club_email_notification_state:
        | "pending"
        | "processing"
        | "sent"
        | "failed"
        | "cancelled"
      club_join_request_status: "pending" | "approved" | "rejected"
      club_role: "owner" | "member" | "admin"
      invite_status: "pending" | "accepted" | "revoked" | "expired"
      paper_annotation_kind: "highlight" | "question" | "explanation" | "note"
      paper_source_type: "arxiv" | "manual"
      paper_status: "planned" | "reading" | "on_hold" | "dropped" | "read"
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
      club_email_notification_kind: ["scheduled", "reminder_3d", "reminder_1d"],
      club_email_notification_state: [
        "pending",
        "processing",
        "sent",
        "failed",
        "cancelled",
      ],
      club_join_request_status: ["pending", "approved", "rejected"],
      club_role: ["owner", "member", "admin"],
      invite_status: ["pending", "accepted", "revoked", "expired"],
      paper_annotation_kind: ["highlight", "question", "explanation", "note"],
      paper_source_type: ["arxiv", "manual"],
      paper_status: ["planned", "reading", "on_hold", "dropped", "read"],
    },
  },
} as const
