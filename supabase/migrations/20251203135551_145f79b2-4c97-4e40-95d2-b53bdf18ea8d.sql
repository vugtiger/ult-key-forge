-- Create pastes table for pastebin feature
CREATE TABLE public.pastes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pastes ENABLE ROW LEVEL SECURITY;

-- Users can view their own pastes
CREATE POLICY "Users can view their own pastes"
ON public.pastes
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create pastes
CREATE POLICY "Users can create pastes"
ON public.pastes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own pastes
CREATE POLICY "Users can update their own pastes"
ON public.pastes
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own pastes
CREATE POLICY "Users can delete their own pastes"
ON public.pastes
FOR DELETE
USING (auth.uid() = user_id);

-- Public can read pastes by slug (for raw access)
CREATE POLICY "Anyone can read pastes by slug"
ON public.pastes
FOR SELECT
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_pastes_updated_at
BEFORE UPDATE ON public.pastes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index on slug for fast lookups
CREATE INDEX idx_pastes_slug ON public.pastes(slug);