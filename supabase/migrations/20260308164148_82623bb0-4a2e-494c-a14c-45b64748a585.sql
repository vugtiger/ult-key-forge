
CREATE TABLE public.global_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ban_type text NOT NULL,
  ban_value text NOT NULL,
  reason text,
  banned_at timestamptz NOT NULL DEFAULT now(),
  banned_by uuid,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}',
  UNIQUE(ban_type, ban_value)
);

ALTER TABLE public.global_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage global bans" ON public.global_bans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.threat_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  threat_type text NOT NULL,
  source_ip text,
  roblox_user_id text,
  discord_user_id text,
  details jsonb DEFAULT '{}',
  severity text NOT NULL DEFAULT 'medium',
  resolved boolean NOT NULL DEFAULT false,
  auto_banned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.threat_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage threat logs" ON public.threat_log
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
