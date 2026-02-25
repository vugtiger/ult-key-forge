-- Auto-cleanup expired control panel keys
-- Create a function that deletes expired keys
CREATE OR REPLACE FUNCTION public.cleanup_expired_control_panel_keys()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Delete expired keys (where expires_at is in the past)
  DELETE FROM public.control_panel_keys 
  WHERE expires_at IS NOT NULL 
    AND expires_at < now();
END;
$$;
