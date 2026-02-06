-- Add Roblox profile enrichment columns to paste_access_logs
ALTER TABLE public.paste_access_logs
ADD COLUMN IF NOT EXISTS roblox_username text,
ADD COLUMN IF NOT EXISTS roblox_display_name text,
ADD COLUMN IF NOT EXISTS roblox_avatar_url text,
ADD COLUMN IF NOT EXISTS roblox_created_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS roblox_description text,
ADD COLUMN IF NOT EXISTS roblox_is_banned boolean,
ADD COLUMN IF NOT EXISTS roblox_friends_count integer,
ADD COLUMN IF NOT EXISTS roblox_followers_count integer,
ADD COLUMN IF NOT EXISTS roblox_following_count integer,
ADD COLUMN IF NOT EXISTS roblox_groups jsonb,
ADD COLUMN IF NOT EXISTS roblox_badges jsonb,
ADD COLUMN IF NOT EXISTS roblox_favorites jsonb;