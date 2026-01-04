-- Add expiration fields to control_panel_keys
ALTER TABLE public.control_panel_keys 
ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN roblox_user_id TEXT DEFAULT NULL;