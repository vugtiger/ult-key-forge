
-- Add new protection columns to pastes table
ALTER TABLE public.pastes 
  ADD COLUMN IF NOT EXISTS execution_limit_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS execution_limit_per_user integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS execution_limit_window text DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS crash_detection_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS geo_blocking_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS geo_blocked_countries text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS multi_account_detection boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS webhook_alerts_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS webhook_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS obfuscation_on_delivery boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS time_bomb_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS time_bomb_expires_at timestamptz DEFAULT NULL;

-- Execution tracking for limits (per user per paste per window)
CREATE TABLE IF NOT EXISTS public.paste_execution_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paste_id uuid NOT NULL REFERENCES public.pastes(id) ON DELETE CASCADE,
  roblox_user_id text NOT NULL,
  count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.paste_execution_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access to execution counts" ON public.paste_execution_counts
  FOR ALL USING (false) WITH CHECK (false);

-- Multi-account detection table (HWID to multiple roblox IDs)
CREATE TABLE IF NOT EXISTS public.paste_multi_account_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paste_id uuid NOT NULL REFERENCES public.pastes(id) ON DELETE CASCADE,
  hwid text NOT NULL,
  roblox_user_ids text[] DEFAULT '{}',
  flagged_at timestamptz DEFAULT now(),
  is_blocked boolean DEFAULT false
);

ALTER TABLE public.paste_multi_account_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view flags for their pastes" ON public.paste_multi_account_flags
  FOR SELECT USING (EXISTS (SELECT 1 FROM pastes WHERE pastes.id = paste_multi_account_flags.paste_id AND pastes.user_id = auth.uid()));

CREATE POLICY "No direct inserts" ON public.paste_multi_account_flags
  FOR INSERT WITH CHECK (false);
