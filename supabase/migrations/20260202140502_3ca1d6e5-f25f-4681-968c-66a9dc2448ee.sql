-- Table for tracking paste access/execution logs
CREATE TABLE public.paste_access_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paste_id UUID NOT NULL REFERENCES public.pastes(id) ON DELETE CASCADE,
  ip_address TEXT NOT NULL,
  roblox_user_id TEXT,
  user_agent TEXT,
  access_type TEXT NOT NULL DEFAULT 'execution', -- 'execution' or 'browser'
  is_active BOOLEAN DEFAULT false,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.paste_access_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for paste_access_logs
CREATE POLICY "System can insert access logs"
  ON public.paste_access_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update access logs"
  ON public.paste_access_logs FOR UPDATE
  USING (true);

CREATE POLICY "Users can view access logs for their pastes"
  ON public.paste_access_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM pastes
    WHERE pastes.id = paste_access_logs.paste_id
    AND pastes.user_id = auth.uid()
  ));

-- Enable realtime for access logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.paste_access_logs;

-- Table for game ID bindings
CREATE TABLE public.paste_game_bindings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paste_id UUID NOT NULL REFERENCES public.pastes(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  game_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(paste_id, game_id)
);

-- Enable RLS
ALTER TABLE public.paste_game_bindings ENABLE ROW LEVEL SECURITY;

-- RLS policies for game bindings
CREATE POLICY "Users can view game bindings for their pastes"
  ON public.paste_game_bindings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM pastes
    WHERE pastes.id = paste_game_bindings.paste_id
    AND pastes.user_id = auth.uid()
  ));

CREATE POLICY "Users can create game bindings for their pastes"
  ON public.paste_game_bindings FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM pastes
    WHERE pastes.id = paste_game_bindings.paste_id
    AND pastes.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete game bindings for their pastes"
  ON public.paste_game_bindings FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM pastes
    WHERE pastes.id = paste_game_bindings.paste_id
    AND pastes.user_id = auth.uid()
  ));

-- Add game_restriction_enabled to pastes
ALTER TABLE public.pastes ADD COLUMN game_restriction_enabled BOOLEAN DEFAULT false;