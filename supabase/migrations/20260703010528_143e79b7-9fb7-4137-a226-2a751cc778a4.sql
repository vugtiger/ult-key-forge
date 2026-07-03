-- Restrict global_bans SELECT to admins only
DROP POLICY IF EXISTS "Admins can view global bans" ON public.global_bans;
CREATE POLICY "Admins can view global bans" ON public.global_bans
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Restrict threat_log SELECT to admins only
DROP POLICY IF EXISTS "Admins can view threat log" ON public.threat_log;
CREATE POLICY "Admins can view threat log" ON public.threat_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Restrict ai-uploads storage SELECT to file owner (folder = auth.uid())
DROP POLICY IF EXISTS "Public read ai-uploads" ON storage.objects;
DROP POLICY IF EXISTS "ai-uploads public read" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read ai-uploads" ON storage.objects;
CREATE POLICY "Owners can read their ai-uploads" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'ai-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);