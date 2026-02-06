-- Create Discord OAuth states table for CSRF protection
CREATE TABLE IF NOT EXISTS public.discord_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text UNIQUE NOT NULL,
  paste_slug text NOT NULL,
  ip_address text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create Discord OAuth sessions table to store identified users by IP
CREATE TABLE IF NOT EXISTS public.discord_oauth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text UNIQUE NOT NULL,
  discord_user_id text NOT NULL,
  discord_username text,
  discord_avatar text,
  discord_created_at timestamp with time zone,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.discord_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discord_oauth_sessions ENABLE ROW LEVEL SECURITY;

-- Allow edge functions to manage these tables (service role)
-- No user-facing policies needed as these are only accessed by edge functions