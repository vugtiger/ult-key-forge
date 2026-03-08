-- Lock down permissive RLS policies: replace WITH CHECK (true) / USING (true) with false
-- These tables are only written by edge functions using service role key (which bypasses RLS)

-- control_panel_keys: remove open insert/update
DROP POLICY IF EXISTS "System can insert keys" ON public.control_panel_keys;
DROP POLICY IF EXISTS "System can update keys" ON public.control_panel_keys;
CREATE POLICY "Deny direct key inserts" ON public.control_panel_keys FOR INSERT WITH CHECK (false);
CREATE POLICY "Deny direct key updates" ON public.control_panel_keys FOR UPDATE USING (false);

-- paste_access_logs: remove open insert/update  
DROP POLICY IF EXISTS "System can insert access logs" ON public.paste_access_logs;
DROP POLICY IF EXISTS "System can update access logs" ON public.paste_access_logs;
CREATE POLICY "Deny direct log inserts" ON public.paste_access_logs FOR INSERT WITH CHECK (false);
CREATE POLICY "Deny direct log updates" ON public.paste_access_logs FOR UPDATE USING (false);

-- paste_executions: remove open insert
DROP POLICY IF EXISTS "System can insert executions" ON public.paste_executions;
CREATE POLICY "Deny direct execution inserts" ON public.paste_executions FOR INSERT WITH CHECK (false);

-- console_blacklist: remove open insert/delete
DROP POLICY IF EXISTS "System can insert blacklist entries" ON public.console_blacklist;
DROP POLICY IF EXISTS "System can delete blacklist entries" ON public.console_blacklist;
CREATE POLICY "Deny direct blacklist inserts" ON public.console_blacklist FOR INSERT WITH CHECK (false);
CREATE POLICY "Deny direct blacklist deletes" ON public.console_blacklist FOR DELETE USING (false);

-- referrals: remove open insert
DROP POLICY IF EXISTS "System can insert referrals" ON public.referrals;
CREATE POLICY "Deny direct referral inserts" ON public.referrals FOR INSERT WITH CHECK (false);