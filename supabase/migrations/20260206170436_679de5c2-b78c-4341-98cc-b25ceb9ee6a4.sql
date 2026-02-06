-- Fix schema drift: align Discord OAuth tables with the oauth handler expectations

-- 1) discord_oauth_states: ensure required columns exist and names match
DO $$
BEGIN
  -- If an older version used `slug`, rename it to `paste_slug`
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='discord_oauth_states' AND column_name='slug'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='discord_oauth_states' AND column_name='paste_slug'
  ) THEN
    EXECUTE 'ALTER TABLE public.discord_oauth_states RENAME COLUMN slug TO paste_slug';
  END IF;
END $$;

ALTER TABLE public.discord_oauth_states
  ADD COLUMN IF NOT EXISTS paste_slug text,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone;

-- Backfill for any existing rows
UPDATE public.discord_oauth_states
SET expires_at = COALESCE(expires_at, created_at + interval '10 minutes')
WHERE expires_at IS NULL;

UPDATE public.discord_oauth_states
SET ip_address = COALESCE(ip_address, 'unknown')
WHERE ip_address IS NULL;

-- Make required columns NOT NULL (safe after backfill)
ALTER TABLE public.discord_oauth_states
  ALTER COLUMN paste_slug SET NOT NULL,
  ALTER COLUMN ip_address SET NOT NULL,
  ALTER COLUMN expires_at SET NOT NULL;

-- Ensure state is unique (for upsert/single lookups)
CREATE UNIQUE INDEX IF NOT EXISTS discord_oauth_states_state_key
ON public.discord_oauth_states(state);

-- 2) discord_oauth_sessions: older version used `token` instead of `ip_address`
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='discord_oauth_sessions' AND column_name='token'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='discord_oauth_sessions' AND column_name='ip_address'
  ) THEN
    EXECUTE 'ALTER TABLE public.discord_oauth_sessions RENAME COLUMN token TO ip_address';
  END IF;
END $$;

ALTER TABLE public.discord_oauth_sessions
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone;

UPDATE public.discord_oauth_sessions
SET ip_address = COALESCE(ip_address, 'unknown')
WHERE ip_address IS NULL;

-- Make ip_address unique so the edge function upsert works
CREATE UNIQUE INDEX IF NOT EXISTS discord_oauth_sessions_ip_address_key
ON public.discord_oauth_sessions(ip_address);

-- Ensure RLS is enabled (edge functions use service role; no public policies needed)
ALTER TABLE public.discord_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discord_oauth_sessions ENABLE ROW LEVEL SECURITY;
