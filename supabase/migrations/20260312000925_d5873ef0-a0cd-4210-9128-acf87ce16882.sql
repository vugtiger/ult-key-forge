-- Remove all false IP bans caused by token_theft_ip_mismatch (v10.4 fix)
-- These were legitimate users whose IP changed between the 2-phase token flow
UPDATE public.global_bans 
SET is_active = false 
WHERE is_active = true 
AND (
  reason LIKE '%token_theft_ip_mismatch%' 
  OR reason LIKE '%token_theft_protected%' 
  OR reason LIKE '%kbt_token_theft%'
);