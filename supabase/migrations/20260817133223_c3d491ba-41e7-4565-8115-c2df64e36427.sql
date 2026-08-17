DELETE FROM public.global_bans
WHERE metadata->>'rule_id' = 'unauthorized_backend_access'
   OR reason ILIKE '%unauthorized_backend_access%'
   OR metadata->'evidence'->>'source' = 'raw_backend_browser_visit'
   OR metadata->>'source' = 'raw_backend_browser_visit'
   OR metadata->>'rule_id' IN ('banned_device_evasion', 'banned_account_evasion', 'banned_discord_user_new_ip')
   OR reason ILIKE '%banned_device_evasion%'
   OR reason ILIKE '%banned_account_evasion%'
   OR reason ILIKE '%banned_discord_user_new_ip%'
   OR reason ILIKE '%honeypot%'
   OR reason ILIKE '%unauthorized_supabase%';

UPDATE public.threat_log
SET resolved = true, auto_banned = false
WHERE threat_type ILIKE '%unauthorized_backend_access%'
   OR threat_type ILIKE '%banned_device_evasion%'
   OR threat_type ILIKE '%banned_account_evasion%';

DELETE FROM public.paste_access_logs
WHERE access_type = 'unauthorized_supabase';