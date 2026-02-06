-- Add unique constraint for discord_hawk_users to enable upsert
CREATE UNIQUE INDEX IF NOT EXISTS discord_hawk_users_unique_idx 
ON public.discord_hawk_users (user_id, guild_id, discord_user_id);