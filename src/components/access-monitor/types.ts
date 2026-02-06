export interface PasteOption {
  id: string;
  title: string | null;
  slug: string;
  ip_tracking_enabled: boolean | null;
}

export interface RobloxGroup {
  id: number;
  name: string;
  role: string;
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
  // Discord profile data
  discord_user_id: string | null;
  discord_username: string | null;
  discord_avatar: string | null;
  discord_created_at: string | null;
  // Roblox profile data
  roblox_username: string | null;
  roblox_display_name: string | null;
  roblox_avatar_url: string | null;
  roblox_created_at: string | null;
  roblox_description: string | null;
  roblox_is_banned: boolean | null;
  roblox_friends_count: number | null;
  roblox_followers_count: number | null;
  roblox_following_count: number | null;
  roblox_groups: RobloxGroup[] | null;
  roblox_badges: { id: number; name: string }[] | null;
  roblox_favorites: { id: number; name: string }[] | null;
}
