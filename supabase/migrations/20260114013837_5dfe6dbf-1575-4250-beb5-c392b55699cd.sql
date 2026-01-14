-- Add hide_code column to pastes table
ALTER TABLE public.pastes ADD COLUMN IF NOT EXISTS hide_code boolean DEFAULT false;

-- Update site_info to today's date
UPDATE public.site_info SET last_updated = now() WHERE id = (SELECT id FROM public.site_info LIMIT 1);