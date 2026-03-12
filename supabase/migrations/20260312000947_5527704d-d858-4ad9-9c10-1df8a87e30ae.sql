UPDATE public.site_info SET version = '10.4.0', last_updated = now() WHERE id = (SELECT id FROM public.site_info LIMIT 1);

INSERT INTO public.changelog (version, title, description, is_major, changes) VALUES (
  '10.4.0',
  'False Ban Fix — Smart IP Mismatch Detection',
  'Fixed the token IP mismatch system that was falsely banning 69+ legitimate users. The system now only auto-bans after 3+ repeated IP mismatches within 10 minutes (actual token theft pattern), instead of banning on every single mismatch. VPN users and mobile users will no longer get falsely banned.',
  true,
  '["Removed instant auto-ban on first IP mismatch — now gives fresh loader instead", "Added IP mismatch tracking: only bans after 3+ mismatches in 10 minutes (real attack pattern)", "Unbanned all 69 falsely banned IPs from token_theft_ip_mismatch", "Fixed all 3 token validation paths: normal, KBT bypass, and protected paste tokens", "Legitimate VPN/mobile users now seamlessly retry with their current IP"]'::jsonb
);