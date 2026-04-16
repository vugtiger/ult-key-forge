
-- 1. Prevent non-admin privilege escalation on user_roles
-- Add explicit deny INSERT for non-admin authenticated users
CREATE POLICY "Deny non-admin role inserts"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Deny anonymous access to threat_log
CREATE POLICY "Deny anon access to threat log"
  ON public.threat_log
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- 3. Prevent review tampering via UPDATE (block all updates)
CREATE POLICY "Deny all review updates"
  ON public.reviews
  FOR UPDATE
  USING (false);
