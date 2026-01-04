-- Create table for console/panel blacklisted users
CREATE TABLE public.console_blacklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  panel_id UUID NOT NULL REFERENCES public.control_panels(id) ON DELETE CASCADE,
  discord_user_id TEXT NOT NULL,
  blacklisted_by TEXT NOT NULL,
  blacklisted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reason TEXT,
  UNIQUE(panel_id, discord_user_id)
);

-- Enable RLS
ALTER TABLE public.console_blacklist ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view blacklist for their panels"
ON public.console_blacklist
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.control_panels
  WHERE control_panels.id = console_blacklist.panel_id
  AND control_panels.user_id = auth.uid()
));

CREATE POLICY "System can insert blacklist entries"
ON public.console_blacklist
FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can delete blacklist entries"
ON public.console_blacklist
FOR DELETE
USING (true);