-- Create table to track user activity for password reset verification
CREATE TABLE public.user_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  activity_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table to track user IP addresses
CREATE TABLE public.user_ips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add theme style columns to user_themes
ALTER TABLE public.user_themes 
ADD COLUMN IF NOT EXISTS neon_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ult_lua_style BOOLEAN DEFAULT false;

-- Enable RLS on new tables
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_ips ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_activity
CREATE POLICY "Users can view their own activity" 
ON public.user_activity FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own activity" 
ON public.user_activity FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- RLS policies for user_ips (only viewable by the user)
CREATE POLICY "Users can view their own IPs" 
ON public.user_ips FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert IPs" 
ON public.user_ips FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update IPs" 
ON public.user_ips FOR UPDATE 
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_user_activity_user_id ON public.user_activity(user_id);
CREATE INDEX idx_user_ips_user_id ON public.user_ips(user_id);
CREATE INDEX idx_user_ips_ip_address ON public.user_ips(ip_address);