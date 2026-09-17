-- 1. Prevent users from unbanning themselves / forging account status on profiles
CREATE OR REPLACE FUNCTION public.guard_profile_protected_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.is_banned IS DISTINCT FROM OLD.is_banned
     OR NEW.banned_at IS DISTINCT FROM OLD.banned_at
     OR NEW.ban_reason IS DISTINCT FROM OLD.ban_reason
     OR NEW.discord_user_id IS DISTINCT FROM OLD.discord_user_id
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Not allowed to modify moderation or identity fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_protected_columns ON public.profiles;
CREATE TRIGGER guard_profile_protected_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_protected_columns();

-- 2. Prevent users from upgrading their own subscription plan on v2_profiles
CREATE OR REPLACE FUNCTION public.guard_v2_profile_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_v2_role(auth.uid(), 'owner'::v2_app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.plan IS DISTINCT FROM OLD.plan OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Not allowed to modify billing plan';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_v2_profile_plan ON public.v2_profiles;
CREATE TRIGGER guard_v2_profile_plan
BEFORE UPDATE ON public.v2_profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_v2_profile_plan();

-- 3. Reviews: keep the public display name readable, stop exposing account linkage
REVOKE SELECT ON public.reviews FROM anon, authenticated;
GRANT SELECT (id, username, content, stars, is_fake, created_at) ON public.reviews TO anon, authenticated;
GRANT INSERT ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;

-- 4. Move the SECURITY DEFINER role helpers into a non-API schema.
-- public.has_role / public.has_v2_role stay as SECURITY INVOKER wrappers so all
-- existing RLS policies keep working, but no SECURITY DEFINER body is callable
-- through the exposed API schema anymore.
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION private.has_v2_role(_user_id uuid, _role public.v2_app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.v2_user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_v2_role(uuid, public.v2_app_role) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT private.has_role(_user_id, _role);
$$;

CREATE OR REPLACE FUNCTION public.has_v2_role(_user_id uuid, _role public.v2_app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT private.has_v2_role(_user_id, _role);
$$;
