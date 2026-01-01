-- Add expires_at column to paste_access_control for whitelist expiration
ALTER TABLE public.paste_access_control 
ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add is_eternal column for eternal whitelist
ALTER TABLE public.paste_access_control 
ADD COLUMN is_eternal BOOLEAN DEFAULT FALSE;

-- Create reviews table for fake and real reviews
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT NULL,
  username TEXT NOT NULL,
  content TEXT NOT NULL,
  stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
  is_fake BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read reviews
CREATE POLICY "Anyone can read reviews" 
ON public.reviews 
FOR SELECT 
USING (true);

-- Authenticated users can create their own real reviews
CREATE POLICY "Users can create reviews" 
ON public.reviews 
FOR INSERT 
WITH CHECK (auth.uid() = user_id AND is_fake = false);

-- Create control_panels table for Discord panels
CREATE TABLE public.control_panels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  paste_id UUID REFERENCES public.pastes(id) ON DELETE CASCADE,
  discord_role_id TEXT,
  discord_channel_id TEXT,
  discord_message_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on control_panels
ALTER TABLE public.control_panels ENABLE ROW LEVEL SECURITY;

-- Users can manage their own control panels
CREATE POLICY "Users can view their own control panels" 
ON public.control_panels 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create control panels" 
ON public.control_panels 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own control panels" 
ON public.control_panels 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own control panels" 
ON public.control_panels 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create control_panel_keys table for generated keys
CREATE TABLE public.control_panel_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  panel_id UUID NOT NULL REFERENCES public.control_panels(id) ON DELETE CASCADE,
  key_value TEXT NOT NULL UNIQUE,
  redeemed_by_discord_id TEXT DEFAULT NULL,
  redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on control_panel_keys
ALTER TABLE public.control_panel_keys ENABLE ROW LEVEL SECURITY;

-- Users can view keys for their panels
CREATE POLICY "Users can view keys for their panels" 
ON public.control_panel_keys 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.control_panels 
  WHERE control_panels.id = control_panel_keys.panel_id 
  AND control_panels.user_id = auth.uid()
));

-- System can insert and update keys (for bot)
CREATE POLICY "System can insert keys" 
ON public.control_panel_keys 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update keys" 
ON public.control_panel_keys 
FOR UPDATE 
USING (true);

-- Create paste_executions table for tracking script executions
CREATE TABLE public.paste_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paste_id UUID NOT NULL REFERENCES public.pastes(id) ON DELETE CASCADE,
  roblox_user_id TEXT NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on paste_executions
ALTER TABLE public.paste_executions ENABLE ROW LEVEL SECURITY;

-- Users can view executions for their pastes
CREATE POLICY "Users can view executions for their pastes" 
ON public.paste_executions 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.pastes 
  WHERE pastes.id = paste_executions.paste_id 
  AND pastes.user_id = auth.uid()
));

-- System can insert executions
CREATE POLICY "System can insert executions" 
ON public.paste_executions 
FOR INSERT 
WITH CHECK (true);

-- Create user_2fa table for two-factor authentication
CREATE TABLE public.user_2fa (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  secret TEXT NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_2fa
ALTER TABLE public.user_2fa ENABLE ROW LEVEL SECURITY;

-- Users can manage their own 2FA
CREATE POLICY "Users can view their own 2FA" 
ON public.user_2fa 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own 2FA" 
ON public.user_2fa 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own 2FA" 
ON public.user_2fa 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own 2FA" 
ON public.user_2fa 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create user_sessions table for session management
CREATE TABLE public.user_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  last_active TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_sessions
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view and manage their own sessions
CREATE POLICY "Users can view their own sessions" 
ON public.user_sessions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions" 
ON public.user_sessions 
FOR DELETE 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert sessions" 
ON public.user_sessions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update sessions" 
ON public.user_sessions 
FOR UPDATE 
USING (true);

-- Add last_updated column to site_info for tracking updates
CREATE TABLE public.site_info (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  version TEXT DEFAULT '1.0.0'
);

-- Insert initial site info
INSERT INTO public.site_info (last_updated, version) VALUES (now(), '1.0.0');

-- Enable RLS on site_info
ALTER TABLE public.site_info ENABLE ROW LEVEL SECURITY;

-- Anyone can read site info
CREATE POLICY "Anyone can read site info" 
ON public.site_info 
FOR SELECT 
USING (true);

-- Only admins can update site info
CREATE POLICY "Admins can update site info" 
ON public.site_info 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));