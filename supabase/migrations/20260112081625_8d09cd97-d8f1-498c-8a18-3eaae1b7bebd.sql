-- Add new protection options to pastes table
ALTER TABLE public.pastes 
ADD COLUMN IF NOT EXISTS background_protection boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS public_protection boolean DEFAULT false;

-- background_protection: Shows protected viewer with "Not authorized" message
-- public_protection: Protection enabled but no whitelist required (anyone can execute, blacklist still works)