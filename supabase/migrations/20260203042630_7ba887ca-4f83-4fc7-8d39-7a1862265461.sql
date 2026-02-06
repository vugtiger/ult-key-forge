-- Add discord_user_id column to paste_access_logs for storing linked/authed Discord info
ALTER TABLE public.paste_access_logs
ADD COLUMN IF NOT EXISTS discord_user_id text,
ADD COLUMN IF NOT EXISTS discord_username text,
ADD COLUMN IF NOT EXISTS discord_avatar text,
ADD COLUMN IF NOT EXISTS discord_created_at timestamp with time zone;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_paste_access_logs_discord ON public.paste_access_logs(discord_user_id) WHERE discord_user_id IS NOT NULL;