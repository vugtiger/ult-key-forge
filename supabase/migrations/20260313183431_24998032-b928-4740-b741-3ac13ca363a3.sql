
-- Add protection_mode column to pastes (whitelist = existing, hwid = hardware ID lock, both = whitelist + hwid)
ALTER TABLE public.pastes ADD COLUMN IF NOT EXISTS protection_mode text NOT NULL DEFAULT 'whitelist';

-- Create HWID locks table
CREATE TABLE public.paste_hwid_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paste_id uuid NOT NULL REFERENCES public.pastes(id) ON DELETE CASCADE,
  roblox_user_id text NOT NULL,
  hwid text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(paste_id, roblox_user_id)
);

-- Enable RLS
ALTER TABLE public.paste_hwid_locks ENABLE ROW LEVEL SECURITY;

-- RLS policies for hwid locks
CREATE POLICY "Users can view HWID locks for their pastes"
  ON public.paste_hwid_locks FOR SELECT
  USING (EXISTS (SELECT 1 FROM pastes WHERE pastes.id = paste_hwid_locks.paste_id AND pastes.user_id = auth.uid()));

CREATE POLICY "Users can delete HWID locks for their pastes"
  ON public.paste_hwid_locks FOR DELETE
  USING (EXISTS (SELECT 1 FROM pastes WHERE pastes.id = paste_hwid_locks.paste_id AND pastes.user_id = auth.uid()));

CREATE POLICY "Deny direct HWID lock inserts"
  ON public.paste_hwid_locks FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Deny direct HWID lock updates"
  ON public.paste_hwid_locks FOR UPDATE
  USING (false);
