-- Create rate_limits table for signup/paste creation cooldowns
CREATE TABLE public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  action text NOT NULL,
  count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_rate_limits_identifier_action ON public.rate_limits (identifier, action, window_start);

-- RLS: No direct client access, only service role
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access to rate_limits"
ON public.rate_limits
FOR ALL
USING (false)
WITH CHECK (false);