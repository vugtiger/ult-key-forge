-- Fix security issue: Remove overly permissive user_ips policies
-- All INSERT/UPDATE should happen via track-ip edge function with service role key
DROP POLICY IF EXISTS "System can insert IPs" ON public.user_ips;
DROP POLICY IF EXISTS "System can update IPs" ON public.user_ips;

-- Fix security issue: Remove overly permissive pastes policy
-- Public access should only happen through get-paste edge function
DROP POLICY IF EXISTS "Anyone can read pastes by slug" ON public.pastes;