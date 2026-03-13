
-- Drop the restrictive insert/update policies and replace with service-role-friendly ones
DROP POLICY IF EXISTS "Deny direct HWID lock inserts" ON public.paste_hwid_locks;
DROP POLICY IF EXISTS "Deny direct HWID lock updates" ON public.paste_hwid_locks;

-- Allow service role to insert/update (edge functions use service role key)
-- No need for explicit policies since service role bypasses RLS
-- But we need to ensure anon/authenticated can't directly insert
CREATE POLICY "No direct HWID lock inserts from client"
  ON public.paste_hwid_locks FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "No direct HWID lock updates from client"
  ON public.paste_hwid_locks FOR UPDATE
  TO anon, authenticated
  USING (false);
