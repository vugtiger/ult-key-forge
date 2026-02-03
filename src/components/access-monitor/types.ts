export interface PasteOption {
  id: string;
  title: string | null;
  slug: string;
  ip_tracking_enabled: boolean | null;
}

export interface AccessLog {
  id: string;
  paste_id: string;
  ip_address: string;
  roblox_user_id: string | null;
  user_agent: string | null;
  access_type: string;
  is_active: boolean | null;
  last_seen_at: string;
  created_at: string;
  discord_user_id: string | null;
  discord_username: string | null;
  discord_avatar: string | null;
  discord_created_at: string | null;
}
