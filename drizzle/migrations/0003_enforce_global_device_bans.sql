CREATE TABLE public.user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id text NOT NULL CHECK (device_id ~ '^[A-Za-z0-9_-]{16,128}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);

GRANT SELECT ON public.user_devices TO authenticated;
GRANT ALL ON public.user_devices TO service_role;

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own devices"
ON public.user_devices FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX user_devices_device_id_idx ON public.user_devices(device_id);

DROP TRIGGER IF EXISTS prevent_admin_ban_trigger ON public.profiles;
DROP TRIGGER IF EXISTS prevent_admin_global_ban_trigger ON public.global_bans;