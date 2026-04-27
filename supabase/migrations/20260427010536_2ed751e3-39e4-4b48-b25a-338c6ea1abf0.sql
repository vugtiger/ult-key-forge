-- API tokens for public REST API
CREATE TABLE public.v2_api_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  token text NOT NULL UNIQUE,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.v2_api_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own api tokens" ON public.v2_api_tokens FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Resellers
CREATE TABLE public.v2_resellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  reseller_user_id uuid NOT NULL,
  project_id uuid REFERENCES public.v2_projects(id) ON DELETE CASCADE,
  permissions jsonb NOT NULL DEFAULT '{"keygen":true,"revoke":false,"blacklist":false}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, reseller_user_id, project_id)
);
ALTER TABLE public.v2_resellers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage resellers" ON public.v2_resellers FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "resellers see their assignments" ON public.v2_resellers FOR SELECT USING (auth.uid() = reseller_user_id);

-- Checkpoints (linkvertise-style)
CREATE TABLE public.v2_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.v2_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  step_number int NOT NULL,
  label text NOT NULL,
  url text NOT NULL,
  reward_days int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.v2_checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own checkpoints" ON public.v2_checkpoints FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "anyone reads active checkpoints" ON public.v2_checkpoints FOR SELECT USING (true);

CREATE TABLE public.v2_checkpoint_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.v2_projects(id) ON DELETE CASCADE,
  hwid text NOT NULL,
  ip text,
  step_number int NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.v2_checkpoint_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no direct progress access" ON public.v2_checkpoint_progress FOR ALL USING (false) WITH CHECK (false);

-- Daily execution analytics
CREATE TABLE public.v2_exec_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.v2_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  day date NOT NULL,
  exec_count int NOT NULL DEFAULT 0,
  unique_users int NOT NULL DEFAULT 0,
  UNIQUE(project_id, day)
);
ALTER TABLE public.v2_exec_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own stats" ON public.v2_exec_stats FOR SELECT USING (auth.uid() = user_id);

-- Key reset audit
CREATE TABLE public.v2_key_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id uuid NOT NULL,
  user_id uuid NOT NULL,
  old_hwid text,
  reset_at timestamptz NOT NULL DEFAULT now(),
  reset_by text
);
ALTER TABLE public.v2_key_resets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own resets" ON public.v2_key_resets FOR SELECT USING (auth.uid() = user_id);

-- Augment v2_scripts for watermarking + per-key encryption
ALTER TABLE public.v2_scripts
  ADD COLUMN IF NOT EXISTS watermark_seed text DEFAULT encode(gen_random_bytes(16), 'hex'),
  ADD COLUMN IF NOT EXISTS encryption_seed text DEFAULT encode(gen_random_bytes(32), 'hex'),
  ADD COLUMN IF NOT EXISTS protection_level text NOT NULL DEFAULT 'standard';

-- Augment v2_keys for HWID & usage tracking
ALTER TABLE public.v2_keys
  ADD COLUMN IF NOT EXISTS hwid text,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS uses_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reset_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS discord_id text;