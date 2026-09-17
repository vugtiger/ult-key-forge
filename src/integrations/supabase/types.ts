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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_chat_messages: {
        Row: {
          content: Json
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: Json
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
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
      changelog_channels: {
        Row: {
          channel_id: string
          created_at: string | null
          guild_id: string
          id: string
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          guild_id: string
          id?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          guild_id?: string
          id?: string
          user_id?: string
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
          is_keysystem: boolean
          logo_url: string | null
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
          is_keysystem?: boolean
          logo_url?: string | null
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
          is_keysystem?: boolean
          logo_url?: string | null
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
          ip_address: string
        }
        Insert: {
          created_at?: string
          discord_avatar?: string | null
          discord_created_at?: string | null
          discord_user_id: string
          discord_username?: string | null
          expires_at?: string
          id?: string
          ip_address: string
        }
        Update: {
          created_at?: string
          discord_avatar?: string | null
          discord_created_at?: string | null
          discord_user_id?: string
          discord_username?: string | null
          expires_at?: string
          id?: string
          ip_address?: string
        }
        Relationships: []
      }
      discord_oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          ip_address: string
          paste_slug: string
          state: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          ip_address: string
          paste_slug: string
          state: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string
          paste_slug?: string
          state?: string
          used_at?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      global_bans: {
        Row: {
          ban_type: string
          ban_value: string
          banned_at: string
          banned_by: string | null
          id: string
          is_active: boolean
          metadata: Json | null
          reason: string | null
        }
        Insert: {
          ban_type: string
          ban_value: string
          banned_at?: string
          banned_by?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          reason?: string | null
        }
        Update: {
          ban_type?: string
          ban_value?: string
          banned_at?: string
          banned_by?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          reason?: string | null
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
          roblox_avatar_url: string | null
          roblox_badges: Json | null
          roblox_created_at: string | null
          roblox_description: string | null
          roblox_display_name: string | null
          roblox_favorites: Json | null
          roblox_followers_count: number | null
          roblox_following_count: number | null
          roblox_friends_count: number | null
          roblox_groups: Json | null
          roblox_is_banned: boolean | null
          roblox_user_id: string | null
          roblox_username: string | null
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
          roblox_avatar_url?: string | null
          roblox_badges?: Json | null
          roblox_created_at?: string | null
          roblox_description?: string | null
          roblox_display_name?: string | null
          roblox_favorites?: Json | null
          roblox_followers_count?: number | null
          roblox_following_count?: number | null
          roblox_friends_count?: number | null
          roblox_groups?: Json | null
          roblox_is_banned?: boolean | null
          roblox_user_id?: string | null
          roblox_username?: string | null
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
          roblox_avatar_url?: string | null
          roblox_badges?: Json | null
          roblox_created_at?: string | null
          roblox_description?: string | null
          roblox_display_name?: string | null
          roblox_favorites?: Json | null
          roblox_followers_count?: number | null
          roblox_following_count?: number | null
          roblox_friends_count?: number | null
          roblox_groups?: Json | null
          roblox_is_banned?: boolean | null
          roblox_user_id?: string | null
          roblox_username?: string | null
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
      paste_execution_counts: {
        Row: {
          count: number | null
          created_at: string | null
          id: string
          paste_id: string
          roblox_user_id: string
          window_start: string | null
        }
        Insert: {
          count?: number | null
          created_at?: string | null
          id?: string
          paste_id: string
          roblox_user_id: string
          window_start?: string | null
        }
        Update: {
          count?: number | null
          created_at?: string | null
          id?: string
          paste_id?: string
          roblox_user_id?: string
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paste_execution_counts_paste_id_fkey"
            columns: ["paste_id"]
            isOneToOne: false
            referencedRelation: "pastes"
            referencedColumns: ["id"]
          },
        ]
      }
      paste_execution_tokens: {
        Row: {
          bound_ip: string | null
          created_at: string
          expires_at: string
          id: string
          paste_id: string
          roblox_user_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          bound_ip?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          paste_id: string
          roblox_user_id: string
          token: string
          used_at?: string | null
        }
        Update: {
          bound_ip?: string | null
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
      paste_hwid_locks: {
        Row: {
          created_at: string
          hwid: string
          id: string
          paste_id: string
          roblox_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hwid: string
          id?: string
          paste_id: string
          roblox_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hwid?: string
          id?: string
          paste_id?: string
          roblox_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paste_hwid_locks_paste_id_fkey"
            columns: ["paste_id"]
            isOneToOne: false
            referencedRelation: "pastes"
            referencedColumns: ["id"]
          },
        ]
      }
      paste_multi_account_flags: {
        Row: {
          flagged_at: string | null
          hwid: string
          id: string
          is_blocked: boolean | null
          paste_id: string
          roblox_user_ids: string[] | null
        }
        Insert: {
          flagged_at?: string | null
          hwid: string
          id?: string
          is_blocked?: boolean | null
          paste_id: string
          roblox_user_ids?: string[] | null
        }
        Update: {
          flagged_at?: string | null
          hwid?: string
          id?: string
          is_blocked?: boolean | null
          paste_id?: string
          roblox_user_ids?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "paste_multi_account_flags_paste_id_fkey"
            columns: ["paste_id"]
            isOneToOne: false
            referencedRelation: "pastes"
            referencedColumns: ["id"]
          },
        ]
      }
      pastes: {
        Row: {
          anti_fetch_enabled: boolean | null
          background_protection: boolean | null
          content: string
          crash_detection_enabled: boolean | null
          created_at: string
          execution_limit_enabled: boolean | null
          execution_limit_per_user: number | null
          execution_limit_window: string | null
          game_restriction_enabled: boolean | null
          geo_blocked_countries: string[] | null
          geo_blocking_enabled: boolean | null
          hide_code: boolean | null
          id: string
          ip_tracking_enabled: boolean
          multi_account_detection: boolean | null
          obfuscation_on_delivery: boolean | null
          protection_enabled: boolean
          protection_mode: string
          public_protection: boolean | null
          show_loading_bar: boolean | null
          show_welcome_message: boolean | null
          slug: string
          time_bomb_enabled: boolean | null
          time_bomb_expires_at: string | null
          title: string | null
          updated_at: string
          user_id: string
          webhook_alerts_enabled: boolean | null
          webhook_events: Json | null
          webhook_url: string | null
        }
        Insert: {
          anti_fetch_enabled?: boolean | null
          background_protection?: boolean | null
          content: string
          crash_detection_enabled?: boolean | null
          created_at?: string
          execution_limit_enabled?: boolean | null
          execution_limit_per_user?: number | null
          execution_limit_window?: string | null
          game_restriction_enabled?: boolean | null
          geo_blocked_countries?: string[] | null
          geo_blocking_enabled?: boolean | null
          hide_code?: boolean | null
          id?: string
          ip_tracking_enabled?: boolean
          multi_account_detection?: boolean | null
          obfuscation_on_delivery?: boolean | null
          protection_enabled?: boolean
          protection_mode?: string
          public_protection?: boolean | null
          show_loading_bar?: boolean | null
          show_welcome_message?: boolean | null
          slug: string
          time_bomb_enabled?: boolean | null
          time_bomb_expires_at?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          webhook_alerts_enabled?: boolean | null
          webhook_events?: Json | null
          webhook_url?: string | null
        }
        Update: {
          anti_fetch_enabled?: boolean | null
          background_protection?: boolean | null
          content?: string
          crash_detection_enabled?: boolean | null
          created_at?: string
          execution_limit_enabled?: boolean | null
          execution_limit_per_user?: number | null
          execution_limit_window?: string | null
          game_restriction_enabled?: boolean | null
          geo_blocked_countries?: string[] | null
          geo_blocking_enabled?: boolean | null
          hide_code?: boolean | null
          id?: string
          ip_tracking_enabled?: boolean
          multi_account_detection?: boolean | null
          obfuscation_on_delivery?: boolean | null
          protection_enabled?: boolean
          protection_mode?: string
          public_protection?: boolean | null
          show_loading_bar?: boolean | null
          show_welcome_message?: boolean | null
          slug?: string
          time_bomb_enabled?: boolean | null
          time_bomb_expires_at?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          webhook_alerts_enabled?: boolean | null
          webhook_events?: Json | null
          webhook_url?: string | null
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
      protection_key_events: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          id: string
          ip_address: string | null
          key_id: string | null
          paste_id: string
          roblox_user_id: string | null
          roblox_username: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          key_id?: string | null
          paste_id: string
          roblox_user_id?: string | null
          roblox_username?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          key_id?: string | null
          paste_id?: string
          roblox_user_id?: string | null
          roblox_username?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "protection_key_events_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "protection_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protection_key_events_paste_id_fkey"
            columns: ["paste_id"]
            isOneToOne: false
            referencedRelation: "pastes"
            referencedColumns: ["id"]
          },
        ]
      }
      protection_keys: {
        Row: {
          bound_at: string | null
          bound_ip: string | null
          bound_roblox_user_id: string | null
          bound_roblox_username: string | null
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          key_value: string
          notes: string | null
          paste_id: string
        }
        Insert: {
          bound_at?: string | null
          bound_ip?: string | null
          bound_roblox_user_id?: string | null
          bound_roblox_username?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_value: string
          notes?: string | null
          paste_id: string
        }
        Update: {
          bound_at?: string | null
          bound_ip?: string | null
          bound_roblox_user_id?: string | null
          bound_roblox_username?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_value?: string
          notes?: string | null
          paste_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "protection_keys_paste_id_fkey"
            columns: ["paste_id"]
            isOneToOne: false
            referencedRelation: "pastes"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          action: string
          count: number | null
          created_at: string | null
          id: string
          identifier: string
          window_start: string | null
        }
        Insert: {
          action: string
          count?: number | null
          created_at?: string | null
          id?: string
          identifier: string
          window_start?: string | null
        }
        Update: {
          action?: string
          count?: number | null
          created_at?: string | null
          id?: string
          identifier?: string
          window_start?: string | null
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
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      threat_log: {
        Row: {
          auto_banned: boolean
          created_at: string
          details: Json | null
          discord_user_id: string | null
          id: string
          resolved: boolean
          roblox_user_id: string | null
          severity: string
          source_ip: string | null
          threat_type: string
        }
        Insert: {
          auto_banned?: boolean
          created_at?: string
          details?: Json | null
          discord_user_id?: string | null
          id?: string
          resolved?: boolean
          roblox_user_id?: string | null
          severity?: string
          source_ip?: string | null
          threat_type: string
        }
        Update: {
          auto_banned?: boolean
          created_at?: string
          details?: Json | null
          discord_user_id?: string | null
          id?: string
          resolved?: boolean
          roblox_user_id?: string | null
          severity?: string
          source_ip?: string | null
          threat_type?: string
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
          layout_preset: string
          neon_enabled: boolean | null
          primary_color: string
          tab_density: string
          tab_radius: number
          tab_shape: string
          ult_lua_style: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          layout_preset?: string
          neon_enabled?: boolean | null
          primary_color?: string
          tab_density?: string
          tab_radius?: number
          tab_shape?: string
          ult_lua_style?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          layout_preset?: string
          neon_enabled?: boolean | null
          primary_color?: string
          tab_density?: string
          tab_radius?: number
          tab_shape?: string
          ult_lua_style?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      v2_api_tokens: {
        Row: {
          created_at: string
          id: string
          last_used_at: string | null
          name: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          name: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          name?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      v2_blacklist: {
        Row: {
          created_at: string
          entry_type: string
          entry_value: string
          id: string
          project_id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_type: string
          entry_value: string
          id?: string
          project_id: string
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          entry_type?: string
          entry_value?: string
          id?: string
          project_id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_blacklist_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v2_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_checkpoint_progress: {
        Row: {
          completed_at: string
          hwid: string
          id: string
          ip: string | null
          project_id: string
          step_number: number
        }
        Insert: {
          completed_at?: string
          hwid: string
          id?: string
          ip?: string | null
          project_id: string
          step_number: number
        }
        Update: {
          completed_at?: string
          hwid?: string
          id?: string
          ip?: string | null
          project_id?: string
          step_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "v2_checkpoint_progress_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v2_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_checkpoints: {
        Row: {
          created_at: string
          id: string
          label: string
          project_id: string
          reward_days: number
          step_number: number
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          project_id: string
          reward_days?: number
          step_number: number
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          project_id?: string
          reward_days?: number
          step_number?: number
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_checkpoints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v2_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_discord_link_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          used: boolean
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          used?: boolean
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
      v2_exec_stats: {
        Row: {
          day: string
          exec_count: number
          id: string
          project_id: string
          unique_users: number
          user_id: string
        }
        Insert: {
          day: string
          exec_count?: number
          id?: string
          project_id: string
          unique_users?: number
          user_id: string
        }
        Update: {
          day?: string
          exec_count?: number
          id?: string
          project_id?: string
          unique_users?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_exec_stats_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v2_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_key_resets: {
        Row: {
          id: string
          key_id: string
          old_hwid: string | null
          reset_at: string
          reset_by: string | null
          user_id: string
        }
        Insert: {
          id?: string
          key_id: string
          old_hwid?: string | null
          reset_at?: string
          reset_by?: string | null
          user_id: string
        }
        Update: {
          id?: string
          key_id?: string
          old_hwid?: string | null
          reset_at?: string
          reset_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      v2_keys: {
        Row: {
          bound_discord_id: string | null
          bound_hwid: string | null
          bound_ip: string | null
          created_at: string
          discord_id: string | null
          expires_at: string | null
          hwid: string | null
          id: string
          is_active: boolean
          key_value: string
          last_used_at: string | null
          note: string | null
          project_id: string
          reset_count: number
          user_id: string
          uses_count: number
        }
        Insert: {
          bound_discord_id?: string | null
          bound_hwid?: string | null
          bound_ip?: string | null
          created_at?: string
          discord_id?: string | null
          expires_at?: string | null
          hwid?: string | null
          id?: string
          is_active?: boolean
          key_value: string
          last_used_at?: string | null
          note?: string | null
          project_id: string
          reset_count?: number
          user_id: string
          uses_count?: number
        }
        Update: {
          bound_discord_id?: string | null
          bound_hwid?: string | null
          bound_ip?: string | null
          created_at?: string
          discord_id?: string | null
          expires_at?: string | null
          hwid?: string | null
          id?: string
          is_active?: boolean
          key_value?: string
          last_used_at?: string | null
          note?: string | null
          project_id?: string
          reset_count?: number
          user_id?: string
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "v2_keys_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v2_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_logs: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          hwid: string | null
          id: string
          ip_address: string | null
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          hwid?: string | null
          id?: string
          ip_address?: string | null
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          hwid?: string | null
          id?: string
          ip_address?: string | null
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v2_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          discord_id: string | null
          discord_username: string | null
          display_name: string | null
          id: string
          plan: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          discord_id?: string | null
          discord_username?: string | null
          display_name?: string | null
          id: string
          plan?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          discord_id?: string | null
          discord_username?: string | null
          display_name?: string | null
          id?: string
          plan?: string
          updated_at?: string
        }
        Relationships: []
      }
      v2_projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      v2_resellers: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          permissions: Json
          project_id: string | null
          reseller_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          permissions?: Json
          project_id?: string | null
          reseller_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          permissions?: Json
          project_id?: string | null
          reseller_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_resellers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v2_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_scripts: {
        Row: {
          content: string
          created_at: string
          encryption_seed: string | null
          id: string
          name: string
          obfuscated: boolean
          project_id: string
          protection_level: string
          updated_at: string
          user_id: string
          watermark_seed: string | null
        }
        Insert: {
          content?: string
          created_at?: string
          encryption_seed?: string | null
          id?: string
          name: string
          obfuscated?: boolean
          project_id: string
          protection_level?: string
          updated_at?: string
          user_id: string
          watermark_seed?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          encryption_seed?: string | null
          id?: string
          name?: string
          obfuscated?: boolean
          project_id?: string
          protection_level?: string
          updated_at?: string
          user_id?: string
          watermark_seed?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_scripts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v2_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_settings: {
        Row: {
          accent_color: string
          created_at: string
          id: string
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accent_color?: string
          created_at?: string
          id?: string
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accent_color?: string
          created_at?: string
          id?: string
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      v2_user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["v2_app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["v2_app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["v2_app_role"]
          user_id?: string
        }
        Relationships: []
      }
      v2_webhooks: {
        Row: {
          created_at: string
          enabled: boolean
          events: Json
          id: string
          project_id: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          events?: Json
          id?: string
          project_id: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          events?: Json
          id?: string
          project_id?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_webhooks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v2_projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_control_panel_keys: { Args: never; Returns: undefined }
      cleanup_expired_discord_oauth: { Args: never; Returns: undefined }
      cleanup_expired_tokens: { Args: never; Returns: undefined }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_v2_role: {
        Args: {
          _role: Database["public"]["Enums"]["v2_app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      v2_app_role: "owner" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      v2_app_role: ["owner", "user"],
    },
  },
} as const
