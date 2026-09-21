CREATE TABLE public.user_public_hosts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  origin text NOT NULL CHECK (origin ~ '^https://[A-Za-z0-9.-]+(?::[0-9]+)?$'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_public_hosts TO authenticated;
GRANT ALL ON public.user_public_hosts TO service_role;

ALTER TABLE public.user_public_hosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own public host"
ON public.user_public_hosts
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

REVOKE UPDATE ON public.v2_profiles FROM authenticated;
GRANT UPDATE (display_name, avatar_url, discord_id, discord_username) ON public.v2_profiles TO authenticated;

DROP POLICY IF EXISTS "v2 update own profile" ON public.v2_profiles;
CREATE POLICY "v2 update own profile fields"
ON public.v2_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);