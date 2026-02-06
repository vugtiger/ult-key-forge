-- Add per-paste toggle for IP tracking
ALTER TABLE public.pastes
ADD COLUMN IF NOT EXISTS ip_tracking_enabled boolean NOT NULL DEFAULT true;

-- Allow users to delete access logs for their own pastes (needed for UI delete button)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'paste_access_logs'
      AND policyname = 'Users can delete access logs for their pastes'
  ) THEN
    CREATE POLICY "Users can delete access logs for their pastes"
    ON public.paste_access_logs
    FOR DELETE
    USING (
      EXISTS (
        SELECT 1
        FROM public.pastes
        WHERE pastes.id = paste_access_logs.paste_id
          AND pastes.user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- Dedupe existing logs so we can enforce uniqueness and avoid UI flooding
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY paste_id, ip_address, access_type, COALESCE(roblox_user_id, '')
      ORDER BY last_seen_at DESC
    ) AS rn
  FROM public.paste_access_logs
)
DELETE FROM public.paste_access_logs pal
USING ranked r
WHERE pal.id = r.id
  AND r.rn > 1;

-- Enforce uniqueness per paste+ip+accessType+robloxUserId (prevents duplicates / flooding)
CREATE UNIQUE INDEX IF NOT EXISTS paste_access_logs_unique_key
ON public.paste_access_logs (paste_id, ip_address, access_type, (COALESCE(roblox_user_id, '')));
