-- Collapse duplicate (user_id, ip_address) rows, keeping the newest last_used_at
DELETE FROM public.user_ips a
USING public.user_ips b
WHERE a.user_id = b.user_id
  AND a.ip_address = b.ip_address
  AND (
    a.last_used_at < b.last_used_at
    OR (a.last_used_at = b.last_used_at AND a.id < b.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS user_ips_user_id_ip_address_key
  ON public.user_ips (user_id, ip_address);