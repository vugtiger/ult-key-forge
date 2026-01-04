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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      blocked_ips: {
        Row: {
          blocked_at: string
          blocked_by: string
          id: string
          ip_address: string
          user_id: string
        }
        Insert: {
          blocked_at?: string
          blocked_by: string
          id?: string
          ip_address: string
          user_id: string
        }
        Update: {
          blocked_at?: string
          blocked_by?: string
          id?: string
          ip_address?: string
          user_id?: string
        }
        Relationships: []
      }
      control_panel_keys: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          key_value: string
          panel_id: string
          redeemed_at: string | null
          redeemed_by_discord_id: string | null
          roblox_user_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key_value: string
          panel_id: string
          redeemed_at?: string | null
          redeemed_by_discord_id?: string | null
          roblox_user_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key_value?: string
          panel_id?: string
          redeemed_at?: string | null
          redeemed_by_discord_id?: string | null
          roblox_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "control_panel_keys_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "control_panels"
            referencedColumns: ["id"]
          },
        ]
      }
      control_panels: {
        Row: {
          created_at: string
          discord_channel_id: string | null
          discord_message_id: string | null
          discord_role_id: string | null
          id: string
          name: string
          paste_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          discord_channel_id?: string | null
          discord_message_id?: string | null
          discord_role_id?: string | null
          id?: string
          name: string
          paste_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          discord_channel_id?: string | null
          discord_message_id?: string | null
          discord_role_id?: string | null
          id?: string
          name?: string
          paste_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "control_panels_paste_id_fkey"
            columns: ["paste_id"]
            isOneToOne: false
            referencedRelation: "pastes"
            referencedColumns: ["id"]
          },
        ]
      }
      key_systems: {
        Row: {
          ascii_text: string
          created_at: string | null
          generated_code: string
          id: string
          name: string
          num_keys: number
          theme_color: string
          user_id: string
        }
        Insert: {
          ascii_text: string
          created_at?: string | null
          generated_code: string
          id?: string
          name: string
          num_keys: number
          theme_color: string
          user_id: string
        }
        Update: {
          ascii_text?: string
          created_at?: string | null
          generated_code?: string
          id?: string
          name?: string
          num_keys?: number
          theme_color?: string
          user_id?: string
        }
        Relationships: []
      }
      paste_access_control: {
        Row: {
          access_type: string
          created_at: string
          expires_at: string | null
          id: string
          is_eternal: boolean | null
          paste_id: string
          roblox_user_id: string
        }
        Insert: {
          access_type: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_eternal?: boolean | null
          paste_id: string
          roblox_user_id: string
        }
        Update: {
          access_type?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_eternal?: boolean | null
          paste_id?: string
          roblox_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paste_access_control_paste_id_fkey"
            columns: ["paste_id"]
            isOneToOne: false
            referencedRelation: "pastes"
            referencedColumns: ["id"]
          },
        ]
      }
      paste_execution_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          paste_id: string
          roblox_user_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          paste_id: string
          roblox_user_id: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          paste_id?: string
          roblox_user_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paste_execution_tokens_paste_id_fkey"
            columns: ["paste_id"]
            isOneToOne: false
            referencedRelation: "pastes"
            referencedColumns: ["id"]
          },
        ]
      }
      paste_executions: {
        Row: {
          executed_at: string
          id: string
          paste_id: string
          roblox_user_id: string
        }
        Insert: {
          executed_at?: string
          id?: string
          paste_id: string
          roblox_user_id: string
        }
        Update: {
          executed_at?: string
          id?: string
          paste_id?: string
          roblox_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paste_executions_paste_id_fkey"
            columns: ["paste_id"]
            isOneToOne: false
            referencedRelation: "pastes"
            referencedColumns: ["id"]
          },
        ]
      }
      pastes: {
        Row: {
          content: string
          created_at: string
          id: string
          protection_enabled: boolean
          slug: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          protection_enabled?: boolean
          slug: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          protection_enabled?: boolean
          slug?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ban_reason: string | null
          banned_at: string | null
          created_at: string | null
          discord_user_id: string | null
          discord_username: string | null
          id: string
          is_banned: boolean | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          ban_reason?: string | null
          banned_at?: string | null
          created_at?: string | null
          discord_user_id?: string | null
          discord_username?: string | null
          id: string
          is_banned?: boolean | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          ban_reason?: string | null
          banned_at?: string | null
          created_at?: string | null
          discord_user_id?: string | null
          discord_username?: string | null
          id?: string
          is_banned?: boolean | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          content: string
          created_at: string
          id: string
          is_fake: boolean | null
          stars: number
          user_id: string | null
          username: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_fake?: boolean | null
          stars: number
          user_id?: string | null
          username: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_fake?: boolean | null
          stars?: number
          user_id?: string | null
          username?: string
        }
        Relationships: []
      }
      saved_scripts: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          script_content: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          script_content: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          script_content?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      site_info: {
        Row: {
          id: string
          last_updated: string
          version: string | null
        }
        Insert: {
          id?: string
          last_updated?: string
          version?: string | null
        }
        Update: {
          id?: string
          last_updated?: string
          version?: string | null
        }
        Relationships: []
      }
      user_2fa: {
        Row: {
          created_at: string
          enabled: boolean | null
          id: string
          secret: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean | null
          id?: string
          secret: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean | null
          id?: string
          secret?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_activity: {
        Row: {
          activity_data: Json | null
          activity_type: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          activity_data?: Json | null
          activity_type: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          activity_data?: Json | null
          activity_type?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_ips: {
        Row: {
          created_at: string
          id: string
          ip_address: string
          is_primary: boolean | null
          last_used_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address: string
          is_primary?: boolean | null
          last_used_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string
          is_primary?: boolean | null
          last_used_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          last_active: string
          session_token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          last_active?: string
          session_token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          last_active?: string
          session_token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_themes: {
        Row: {
          created_at: string | null
          id: string
          neon_enabled: boolean | null
          primary_color: string
          ult_lua_style: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          neon_enabled?: boolean | null
          primary_color?: string
          ult_lua_style?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          neon_enabled?: boolean | null
          primary_color?: string
          ult_lua_style?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_tokens: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
