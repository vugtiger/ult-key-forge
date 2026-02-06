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
      changelog: {
        Row: {
          changes: Json | null
          created_at: string
          description: string
          id: string
          is_major: boolean | null
          title: string
          version: string
        }
        Insert: {
          changes?: Json | null
          created_at?: string
          description: string
          id?: string
          is_major?: boolean | null
          title: string
          version: string
        }
        Update: {
          changes?: Json | null
          created_at?: string
          description?: string
          id?: string
          is_major?: boolean | null
          title?: string
          version?: string
        }
        Relationships: []
      }
      console_blacklist: {
        Row: {
          blacklisted_at: string
          blacklisted_by: string
          discord_user_id: string
          id: string
          panel_id: string
          reason: string | null
        }
        Insert: {
          blacklisted_at?: string
          blacklisted_by: string
          discord_user_id: string
          id?: string
          panel_id: string
          reason?: string | null
        }
        Update: {
          blacklisted_at?: string
          blacklisted_by?: string
          discord_user_id?: string
          id?: string
          panel_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "console_blacklist_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "control_panels"
            referencedColumns: ["id"]
          },
        ]
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
      discord_hawk_settings: {
        Row: {
          created_at: string
          enabled: boolean
          guild_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          guild_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          guild_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      discord_hawk_users: {
        Row: {
          discord_avatar: string | null
          discord_created_at: string | null
          discord_user_id: string
          discord_username: string | null
          guild_id: string
          id: string
          is_active: boolean
          scanned_at: string
          user_id: string
        }
        Insert: {
          discord_avatar?: string | null
          discord_created_at?: string | null
          discord_user_id: string
          discord_username?: string | null
          guild_id: string
          id?: string
          is_active?: boolean
          scanned_at?: string
          user_id: string
        }
        Update: {
          discord_avatar?: string | null
          discord_created_at?: string | null
          discord_user_id?: string
          discord_username?: string | null
          guild_id?: string
          id?: string
          is_active?: boolean
          scanned_at?: string
          user_id?: string
        }
        Relationships: []
      }
      discord_oauth_sessions: {
        Row: {
          created_at: string
          discord_avatar: string | null
          discord_created_at: string | null
          discord_user_id: string
          discord_username: string | null
          expires_at: string
          id: string
          token: string
        }
        Insert: {
          created_at?: string
          discord_avatar?: string | null
          discord_created_at?: string | null
          discord_user_id: string
          discord_username?: string | null
          expires_at?: string
          id?: string
          token: string
        }
        Update: {
          created_at?: string
          discord_avatar?: string | null
          discord_created_at?: string | null
          discord_user_id?: string
          discord_username?: string | null
          expires_at?: string
          id?: string
          token?: string
        }
        Relationships: []
      }
      discord_oauth_states: {
        Row: {
          created_at: string
          id: string
          slug: string
          state: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          slug: string
          state: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          slug?: string
          state?: string
          used_at?: string | null
        }
        Relationships: []
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
      paste_access_logs: {
        Row: {
          access_type: string
          created_at: string
          discord_avatar: string | null
          discord_created_at: string | null
          discord_user_id: string | null
          discord_username: string | null
          id: string
          ip_address: string
          is_active: boolean | null
          last_seen_at: string
          paste_id: string
          roblox_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          access_type?: string
          created_at?: string
          discord_avatar?: string | null
          discord_created_at?: string | null
          discord_user_id?: string | null
          discord_username?: string | null
          id?: string
          ip_address: string
          is_active?: boolean | null
          last_seen_at?: string
          paste_id: string
          roblox_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          access_type?: string
          created_at?: string
          discord_avatar?: string | null
          discord_created_at?: string | null
          discord_user_id?: string | null
          discord_username?: string | null
          id?: string
          ip_address?: string
          is_active?: boolean | null
          last_seen_at?: string
          paste_id?: string
          roblox_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paste_access_logs_paste_id_fkey"
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
      paste_game_bindings: {
        Row: {
          created_at: string
          game_id: string
          game_name: string | null
          id: string
          paste_id: string
        }
        Insert: {
          created_at?: string
          game_id: string
          game_name?: string | null
          id?: string
          paste_id: string
        }
        Update: {
          created_at?: string
          game_id?: string
          game_name?: string | null
          id?: string
          paste_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paste_game_bindings_paste_id_fkey"
            columns: ["paste_id"]
            isOneToOne: false
            referencedRelation: "pastes"
            referencedColumns: ["id"]
          },
        ]
      }
      pastes: {
        Row: {
          background_protection: boolean | null
          content: string
          created_at: string
          game_restriction_enabled: boolean | null
          hide_code: boolean | null
          id: string
          ip_tracking_enabled: boolean
          protection_enabled: boolean
          public_protection: boolean | null
          slug: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          background_protection?: boolean | null
          content: string
          created_at?: string
          game_restriction_enabled?: boolean | null
          hide_code?: boolean | null
          id?: string
          ip_tracking_enabled?: boolean
          protection_enabled?: boolean
          public_protection?: boolean | null
          slug: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          background_protection?: boolean | null
          content?: string
          created_at?: string
          game_restriction_enabled?: boolean | null
          hide_code?: boolean | null
          id?: string
          ip_tracking_enabled?: boolean
          protection_enabled?: boolean
          public_protection?: boolean | null
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
          preferred_language: string | null
          tutorial_completed: boolean | null
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
          preferred_language?: string | null
          tutorial_completed?: boolean | null
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
          preferred_language?: string | null
          tutorial_completed?: boolean | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          total_earnings: number | null
          total_referrals: number | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          total_earnings?: number | null
          total_referrals?: number | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          total_earnings?: number | null
          total_referrals?: number | null
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referral_code: string
          referred_id: string
          referrer_id: string
          reward_claimed: boolean | null
          status: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          referral_code: string
          referred_id: string
          referrer_id: string
          reward_claimed?: boolean | null
          status?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          referral_code?: string
          referred_id?: string
          referrer_id?: string
          reward_claimed?: boolean | null
          status?: string | null
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
      subscription_tiers: {
        Row: {
          created_at: string
          features: Json | null
          id: string
          is_active: boolean | null
          name: string
          price: number
          stripe_price_id: string | null
        }
        Insert: {
          created_at?: string
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          price: number
          stripe_price_id?: string | null
        }
        Update: {
          created_at?: string
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          stripe_price_id?: string | null
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
      user_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "subscription_tiers"
            referencedColumns: ["id"]
          },
        ]
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
      cleanup_expired_discord_oauth: { Args: never; Returns: undefined }
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
