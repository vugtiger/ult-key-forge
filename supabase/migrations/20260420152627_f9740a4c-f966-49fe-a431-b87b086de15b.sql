-- Executor blacklist per paste
CREATE TABLE public.paste_executor_blacklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paste_id uuid NOT NULL REFERENCES public.pastes(id) ON DELETE CASCADE,
  executor_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (paste_id, executor_name)
);
ALTER TABLE public.paste_executor_blacklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage executor blacklist" ON public.paste_executor_blacklist
  FOR ALL USING (EXISTS (SELECT 1 FROM public.pastes p WHERE p.id = paste_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pastes p WHERE p.id = paste_id AND p.user_id = auth.uid()));

-- Script versions
CREATE TABLE public.paste_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paste_id uuid NOT NULL REFERENCES public.pastes(id) ON DELETE CASCADE,
  version text NOT NULL,
  content text NOT NULL,
  notes text,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (paste_id, version)
);
ALTER TABLE public.paste_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage paste versions" ON public.paste_versions
  FOR ALL USING (EXISTS (SELECT 1 FROM public.pastes p WHERE p.id = paste_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pastes p WHERE p.id = paste_id AND p.user_id = auth.uid()));

-- Key transfer log
CREATE TABLE public.key_transfer_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id uuid NOT NULL REFERENCES public.control_panel_keys(id) ON DELETE CASCADE,
  panel_id uuid NOT NULL REFERENCES public.control_panels(id) ON DELETE CASCADE,
  from_discord_id text,
  to_discord_id text,
  transferred_by uuid,
  transferred_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.key_transfer_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners view key transfers" ON public.key_transfer_log
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.control_panels cp WHERE cp.id = panel_id AND cp.user_id = auth.uid()));

-- HWID reset cooldown tracking
CREATE TABLE public.hwid_reset_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paste_id uuid NOT NULL REFERENCES public.pastes(id) ON DELETE CASCADE,
  roblox_user_id text NOT NULL,
  reset_at timestamptz NOT NULL DEFAULT now(),
  reset_by uuid
);
ALTER TABLE public.hwid_reset_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners view hwid resets" ON public.hwid_reset_log
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.pastes p WHERE p.id = paste_id AND p.user_id = auth.uid()));
CREATE INDEX idx_hwid_reset_lookup ON public.hwid_reset_log(paste_id, roblox_user_id, reset_at DESC);

-- New columns on pastes for the new toggles
ALTER TABLE public.pastes
  ADD COLUMN IF NOT EXISTS executor_blacklist_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS vm_detection_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS hook_detection_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS dev_console_loader boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS force_latest_version boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_version text,
  ADD COLUMN IF NOT EXISTS hwid_reset_cooldown_hours integer DEFAULT 24,
  ADD COLUMN IF NOT EXISTS webhook_events jsonb DEFAULT '["redeem","exec","ban","bypass"]'::jsonb;