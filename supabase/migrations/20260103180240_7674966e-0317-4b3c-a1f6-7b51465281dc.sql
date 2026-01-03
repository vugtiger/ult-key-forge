-- Create blocked_ips table to track permanently blocked IPs
CREATE TABLE public.blocked_ips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ip_address TEXT NOT NULL,
  blocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  blocked_by UUID NOT NULL,
  UNIQUE(user_id, ip_address)
);

-- Enable RLS
ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;

-- Only the account owner can view blocked IPs
CREATE POLICY "Users can view their own blocked IPs"
ON public.blocked_ips
FOR SELECT
USING (auth.uid() = user_id);

-- Only the account owner can insert blocked IPs
CREATE POLICY "Users can block IPs on their account"
ON public.blocked_ips
FOR INSERT
WITH CHECK (auth.uid() = user_id AND auth.uid() = blocked_by);

-- Only the account owner can delete blocked IPs
CREATE POLICY "Users can unblock IPs on their account"
ON public.blocked_ips
FOR DELETE
USING (auth.uid() = user_id);