-- ============================================
-- 1. CLEANUP: drop unused mega-update artifacts
-- ============================================
DROP TABLE IF EXISTS public.paste_executor_blacklist CASCADE;
DROP TABLE IF EXISTS public.paste_versions CASCADE;
DROP TABLE IF EXISTS public.key_transfer_log CASCADE;
DROP TABLE IF EXISTS public.hwid_reset_log CASCADE;

ALTER TABLE public.pastes
  DROP COLUMN IF EXISTS executor_blacklist_enabled,
  DROP COLUMN IF EXISTS vm_detection_enabled,
  DROP COLUMN IF EXISTS hook_detection_enabled,
  DROP COLUMN IF EXISTS dev_console_loader,
  DROP COLUMN IF EXISTS force_latest_version,
  DROP COLUMN IF EXISTS current_version,
  DROP COLUMN IF EXISTS hwid_reset_cooldown_hours;

-- ============================================
-- 2. NEW: protection_keys table
-- ============================================
CREATE TABLE public.protection_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paste_id uuid NOT NULL REFERENCES public.pastes(id) ON DELETE CASCADE,
  key_value text NOT NULL,
  bound_roblox_user_id text,
  bound_roblox_username text,
  bound_at timestamptz,
  bound_ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  UNIQUE (paste_id, key_value)
);

CREATE INDEX idx_protection_keys_paste ON public.protection_keys(paste_id);
CREATE INDEX idx_protection_keys_value ON public.protection_keys(key_value);
CREATE INDEX idx_protection_keys_bound_user ON public.protection_keys(bound_roblox_user_id);

ALTER TABLE public.protection_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage protection keys"
  ON public.protection_keys
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.pastes p WHERE p.id = protection_keys.paste_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pastes p WHERE p.id = protection_keys.paste_id AND p.user_id = auth.uid()));

-- ============================================
-- 3. NEW: protection_key_events (analytics)
-- ============================================
CREATE TABLE public.protection_key_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id uuid REFERENCES public.protection_keys(id) ON DELETE CASCADE,
  paste_id uuid NOT NULL REFERENCES public.pastes(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- 'redeem' | 'success' | 'kick_invalid' | 'kick_spoof' | 'kick_expired'
  roblox_user_id text,
  roblox_username text,
  ip_address text,
  user_agent text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pk_events_paste ON public.protection_key_events(paste_id, created_at DESC);
CREATE INDEX idx_pk_events_key ON public.protection_key_events(key_id);

ALTER TABLE public.protection_key_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners view protection key events"
  ON public.protection_key_events
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.pastes p WHERE p.id = protection_key_events.paste_id AND p.user_id = auth.uid()));

CREATE POLICY "no direct event inserts"
  ON public.protection_key_events
  FOR INSERT
  WITH CHECK (false);