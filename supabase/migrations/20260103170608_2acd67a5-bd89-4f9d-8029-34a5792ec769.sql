-- Create table for one-time execution tokens
CREATE TABLE public.paste_execution_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paste_id UUID NOT NULL REFERENCES public.pastes(id) ON DELETE CASCADE,
  roblox_user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '30 seconds')
);

-- Index for fast token lookups
CREATE INDEX idx_paste_execution_tokens_token ON public.paste_execution_tokens(token);

-- Auto-cleanup old tokens (older than 5 minutes)
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM public.paste_execution_tokens 
  WHERE expires_at < now() - interval '5 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enable RLS
ALTER TABLE public.paste_execution_tokens ENABLE ROW LEVEL SECURITY;

-- No direct access - only through edge function with service role
CREATE POLICY "No direct access to tokens"
ON public.paste_execution_tokens
FOR ALL
USING (false);