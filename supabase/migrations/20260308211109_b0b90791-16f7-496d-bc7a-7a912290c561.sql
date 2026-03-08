
-- Fix 1: Remove overly permissive "System can manage subscriptions" policy on user_subscriptions
DROP POLICY IF EXISTS "System can manage subscriptions" ON public.user_subscriptions;

-- Fix 2: Remove overly permissive session write policies on user_sessions
DROP POLICY IF EXISTS "System can insert sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "System can update sessions" ON public.user_sessions;
