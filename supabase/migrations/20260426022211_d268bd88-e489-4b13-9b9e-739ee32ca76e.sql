
ALTER TABLE public.v2_profiles
  ADD COLUMN IF NOT EXISTS discord_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS discord_username text;

CREATE TABLE IF NOT EXISTS public.v2_discord_link_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.v2_discord_link_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v2 users create own link codes"
  ON public.v2_discord_link_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "v2 users view own link codes"
  ON public.v2_discord_link_codes FOR SELECT
  USING (auth.uid() = user_id);
