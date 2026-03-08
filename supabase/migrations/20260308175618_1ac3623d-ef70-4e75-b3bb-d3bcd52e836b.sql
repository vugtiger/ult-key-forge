CREATE TABLE public.changelog_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  guild_id text NOT NULL,
  channel_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, guild_id)
);

ALTER TABLE public.changelog_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access to changelog_channels" ON public.changelog_channels
  FOR ALL USING (false) WITH CHECK (false);
