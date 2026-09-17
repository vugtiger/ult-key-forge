CREATE OR REPLACE FUNCTION public.guard_referral_code_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
     OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.code IS DISTINCT FROM OLD.code
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.total_referrals IS DISTINCT FROM OLD.total_referrals
     OR NEW.total_earnings IS DISTINCT FROM OLD.total_earnings THEN
    RAISE EXCEPTION 'Not allowed to modify referral ownership or earnings';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_referral_code_totals ON public.referral_codes;
CREATE TRIGGER guard_referral_code_totals
BEFORE UPDATE ON public.referral_codes
FOR EACH ROW EXECUTE FUNCTION public.guard_referral_code_totals();

CREATE OR REPLACE FUNCTION public.guard_v2_key_protected_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
     OR public.has_v2_role(auth.uid(), 'owner'::public.v2_app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.key_value IS DISTINCT FROM OLD.key_value
     OR NEW.bound_hwid IS DISTINCT FROM OLD.bound_hwid
     OR NEW.bound_ip IS DISTINCT FROM OLD.bound_ip
     OR NEW.bound_discord_id IS DISTINCT FROM OLD.bound_discord_id
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.hwid IS DISTINCT FROM OLD.hwid
     OR NEW.last_used_at IS DISTINCT FROM OLD.last_used_at
     OR NEW.uses_count IS DISTINCT FROM OLD.uses_count
     OR NEW.reset_count IS DISTINCT FROM OLD.reset_count
     OR NEW.discord_id IS DISTINCT FROM OLD.discord_id THEN
    RAISE EXCEPTION 'Not allowed to modify protected license key fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_v2_key_protected_columns ON public.v2_keys;
CREATE TRIGGER guard_v2_key_protected_columns
BEFORE UPDATE ON public.v2_keys
FOR EACH ROW EXECUTE FUNCTION public.guard_v2_key_protected_columns();