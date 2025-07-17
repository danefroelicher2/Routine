// ============================================
// COMPLETE DATABASE TYPES WITH AI INTEGRATION
// Replace your entire src/types/database.ts with this
// ============================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
          // NEW: Social features
          current_streak: number | null;
          longest_streak: number | null;
          last_streak_update: string | null;
          display_name: string | null;
          show_in_leaderboard: boolean | null;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
          // NEW: Social features
          current_streak?: number | null;
          longest_streak?: number | null;
          last_streak_update?: string | null;
          display_name?: string | null;
          show_in_leaderboard?: boolean | null;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
          // NEW: Social features
          current_streak?: number | null;
          longest_streak?: number | null;
          last_streak_update?: string | null;
          display_name?: string | null;
          show_in_leaderboard?: boolean | null;
        };
      };
      routine_templates: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          category: string | null;
          icon: string | null;
          is_default: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          category?: string | null;
          icon?: string | null;
          is_default?: boolean | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          category?: string | null;
          icon?: string | null;
          is_default?: boolean | null;
          created_at?: string;
        };
      };
      user_routines: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          icon: string | null;
          is_daily: boolean | null;
          is_weekly: boolean | null;
          target_value: number | null;
          target_unit: string | null;
          sort_order: number | null;
          is_active: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          icon?: string | null;
          is_daily?: boolean | null;
          is_weekly?: boolean | null;
          target_value?: number | null;
          target_unit?: string | null;
          sort_order?: number | null;
          is_active?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          icon?: string | null;
          is_daily?: boolean | null;
          is_weekly?: boolean | null;
          target_value?: number | null;
          target_unit?: string | null;
          sort_order?: number | null;
          is_active?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_day_routines: {
        Row: {
          id: string;
          user_id: string;
          routine_id: string;
          day_of_week: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          routine_id: string;
          day_of_week: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          routine_id?: string;
          day_of_week?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      routine_completions: {
        Row: {
          id: string;
          user_id: string;
          routine_id: string;
          completed_at: string;
          completion_date: string;
          actual_value: number | null;
          notes: string | null;
          week_start_date: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          routine_id: string;
          completed_at?: string;
          completion_date?: string;
          actual_value?: number | null;
          notes?: string | null;
          week_start_date?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          routine_id?: string;
          completed_at?: string;
          completion_date?: string;
          actual_value?: number | null;
          notes?: string | null;
          week_start_date?: string | null;
        };
      };
      notes: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          content: string | null;
          is_pinned: boolean | null;
          is_locked: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          content?: string | null;
          is_pinned?: boolean | null;
          is_locked?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          content?: string | null;
          is_pinned?: boolean | null;
          is_locked?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_settings: {
        Row: {
          id: string;
          user_id: string;
          dark_mode: boolean | null;
          notifications_enabled: boolean | null;
          weekly_reset_day: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          dark_mode?: boolean | null;
          notifications_enabled?: boolean | null;
          weekly_reset_day?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          dark_mode?: boolean | null;
          notifications_enabled?: boolean | null;
          weekly_reset_day?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      // NEW: Leaderboard view type (kept from your original)
      leaderboard_view: {
        Row: {
          id: string;
          display_name: string;
          current_streak: number;
          longest_streak: number;
          join_date: string;
          rank: number;
        };
      };
      // NEW: AI Chat Tables
      chat_sessions: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          created_at: string;
          updated_at: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
          is_active?: boolean;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          metadata: Record<string, any>;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          metadata?: Record<string, any>;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string;
          role?: 'user' | 'assistant' | 'system';
          content?: string;
          metadata?: Record<string, any>;
          created_at?: string;
        };
      };
    };
    Views: {
      leaderboard_view: {
        Row: {
          id: string;
          display_name: string;
          current_streak: number;
          longest_streak: number;
          join_date: string;
          rank: number;
        };
      };
    };
    Functions: {
      // Existing function (kept from your original)
      update_user_streaks: {
        Args: {
          user_id: string;
          new_current_streak: number;
          new_longest_streak: number;
        };
        Returns: void;
      };
      // NEW: AI function
      get_user_schedule_context: {
        Args: {
          target_user_id: string;
          target_day?: number;
        };
        Returns: Record<string, any>;
      };
    };
  };
}

// Additional types for the app (kept all your existing types)
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type UserRoutine = Database["public"]["Tables"]["user_routines"]["Row"];
export type RoutineTemplate =
  Database["public"]["Tables"]["routine_templates"]["Row"];
export type RoutineCompletion =
  Database["public"]["Tables"]["routine_completions"]["Row"];
export type Note = Database["public"]["Tables"]["notes"]["Row"];
export type UserSettings = Database["public"]["Tables"]["user_settings"]["Row"];
export type UserDayRoutine =
  Database["public"]["Tables"]["user_day_routines"]["Row"];

// NEW: Social types (kept from your original)
export type LeaderboardUser =
  Database["public"]["Views"]["leaderboard_view"]["Row"];

// NEW: AI Chat types
export type ChatSession = Database["public"]["Tables"]["chat_sessions"]["Row"];
export type ChatMessage = Database["public"]["Tables"]["chat_messages"]["Row"];

// NEW: AI Schedule Context interface
export interface ScheduleContext {
  user_profile: {
    display_name: string;
    current_streak: number;
    longest_streak: number;
  };
  routines: Array<{
    name: string;
    description: string;
    icon: string;
    is_daily: boolean;
    is_weekly: boolean;
    target_value: number;
    target_unit: string;
    scheduled_days: number[];
  }>;
  target_day: number | null;
  generated_at: string;
}