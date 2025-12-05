-- Create table for paste access control (whitelist/blacklist)
CREATE TABLE public.paste_access_control (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paste_id UUID NOT NULL REFERENCES public.pastes(id) ON DELETE CASCADE,
  roblox_user_id TEXT NOT NULL,
  access_type TEXT NOT NULL CHECK (access_type IN ('whitelist', 'blacklist')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(paste_id, roblox_user_id)
);

-- Add protection settings to pastes table
ALTER TABLE public.pastes 
ADD COLUMN protection_enabled BOOLEAN NOT NULL DEFAULT false;

-- Enable RLS
ALTER TABLE public.paste_access_control ENABLE ROW LEVEL SECURITY;

-- Users can manage access control for their own pastes
CREATE POLICY "Users can view access control for their pastes"
ON public.paste_access_control
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.pastes 
    WHERE pastes.id = paste_access_control.paste_id 
    AND pastes.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create access control for their pastes"
ON public.paste_access_control
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pastes 
    WHERE pastes.id = paste_access_control.paste_id 
    AND pastes.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete access control for their pastes"
ON public.paste_access_control
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.pastes 
    WHERE pastes.id = paste_access_control.paste_id 
    AND pastes.user_id = auth.uid()
  )
);