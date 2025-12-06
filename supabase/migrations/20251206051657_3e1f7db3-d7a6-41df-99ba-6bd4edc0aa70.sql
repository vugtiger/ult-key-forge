-- Add Discord fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS discord_user_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS discord_username TEXT;

-- Create index for faster Discord lookups
CREATE INDEX IF NOT EXISTS idx_profiles_discord_user_id ON public.profiles(discord_user_id);
