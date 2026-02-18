
-- Admin can view ALL profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can update ALL profiles (ban, etc)
CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can delete ALL profiles
CREATE POLICY "Admins can delete all profiles"
ON public.profiles FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can view ALL user_ips
CREATE POLICY "Admins can view all IPs"
ON public.user_ips FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can view ALL pastes
CREATE POLICY "Admins can view all pastes"
ON public.pastes FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can delete ALL pastes
CREATE POLICY "Admins can delete all pastes"
ON public.pastes FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can update ALL pastes
CREATE POLICY "Admins can update all pastes"
ON public.pastes FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can view ALL paste access logs
CREATE POLICY "Admins can view all access logs"
ON public.paste_access_logs FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can view ALL user activity
CREATE POLICY "Admins can view all activity"
ON public.user_activity FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can view ALL user sessions
CREATE POLICY "Admins can view all sessions"
ON public.user_sessions FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can view ALL blocked IPs
CREATE POLICY "Admins can view all blocked IPs"
ON public.blocked_ips FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));
