-- Create table for hawk-tracked Discord users (scanned server members)
CREATE TABLE public.discord_hawk_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guild_id TEXT NOT NULL,
  discord_user_id TEXT NOT NULL,
  discord_username TEXT,
  discord_avatar TEXT,
  discord_created_at TIMESTAMPTZ,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(user_id, guild_id, discord_user_id)
);

-- Create index for fast lookups
CREATE INDEX idx_discord_hawk_users_lookup ON public.discord_hawk_users(discord_user_id);
CREATE INDEX idx_discord_hawk_users_guild ON public.discord_hawk_users(user_id, guild_id);

-- Enable RLS
ALTER TABLE public.discord_hawk_users ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own hawk data"
ON public.discord_hawk_users FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own hawk data"
ON public.discord_hawk_users FOR ALL
USING (auth.uid() = user_id);

-- Create hawk settings table per guild
CREATE TABLE public.discord_hawk_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guild_id TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, guild_id)
);

-- Enable RLS for settings
ALTER TABLE public.discord_hawk_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own hawk settings"
ON public.discord_hawk_settings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own hawk settings"
ON public.discord_hawk_settings FOR ALL
USING (auth.uid() = user_id);