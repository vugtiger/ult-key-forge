
-- Trigger: Prevent admins from being banned on profiles table
CREATE OR REPLACE FUNCTION public.prevent_admin_ban()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If trying to set is_banned = true, check if user is admin
  IF NEW.is_banned = true AND OLD.is_banned IS DISTINCT FROM true THEN
    IF public.has_role(NEW.id, 'admin') THEN
      -- Silently prevent the ban
      NEW.is_banned := false;
      NEW.banned_at := NULL;
      NEW.ban_reason := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_admin_ban_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_admin_ban();

-- Also prevent admin IPs from being added to global_bans
CREATE OR REPLACE FUNCTION public.prevent_admin_global_ban()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_ip_exists boolean;
BEGIN
  -- Check if this IP belongs to any admin user
  IF NEW.ban_type = 'ip' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_ips ui
      JOIN public.user_roles ur ON ur.user_id = ui.user_id
      WHERE ui.ip_address = NEW.ban_value
      AND ur.role = 'admin'
    ) INTO admin_ip_exists;
    
    IF admin_ip_exists THEN
      RETURN NULL; -- Silently skip the insert
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_admin_global_ban_trigger
  BEFORE INSERT ON public.global_bans
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_admin_global_ban();
