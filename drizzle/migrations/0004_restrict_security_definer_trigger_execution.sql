REVOKE EXECUTE ON FUNCTION public.guard_profile_protected_columns() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_referral_code_totals() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_v2_key_protected_columns() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_v2_profile_plan() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.guard_profile_protected_columns() TO service_role;
GRANT EXECUTE ON FUNCTION public.guard_referral_code_totals() TO service_role;
GRANT EXECUTE ON FUNCTION public.guard_v2_key_protected_columns() TO service_role;
GRANT EXECUTE ON FUNCTION public.guard_v2_profile_plan() TO service_role;