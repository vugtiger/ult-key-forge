-- Fix 1: Remove paste_access_logs from realtime publication (exposes sensitive data)
ALTER PUBLICATION supabase_realtime DROP TABLE public.paste_access_logs;

-- Fix 2: Scope keysystem-logos INSERT policy to user's own folder
DROP POLICY "Authenticated users can upload keysystem logos" ON storage.objects;
CREATE POLICY "Users can upload their own keysystem logos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'keysystem-logos'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- Fix 3: Ensure the hardcoded banned IPs are in global_bans table
INSERT INTO public.global_bans (ban_type, ban_value, reason, is_active)
VALUES 
  ('ip', '79.177.154.169', 'Permanent ban - persistent abuser', true),
  ('ip', '79.181.155.63', 'Permanent ban - same ISP range abuser', true),
  ('ip', '89.234.244.240', 'Permanent ban - frequent abuser', true),
  ('subnet', '79.177.154.', 'Subnet ban - persistent abuser range', true),
  ('subnet', '79.181.155.', 'Subnet ban - related abuser range', true)
ON CONFLICT DO NOTHING;