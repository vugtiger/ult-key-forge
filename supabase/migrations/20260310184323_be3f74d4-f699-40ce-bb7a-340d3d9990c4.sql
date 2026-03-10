UPDATE public.site_info SET version = '10.2.0', last_updated = now() WHERE id = (SELECT id FROM public.site_info LIMIT 1);

INSERT INTO public.changelog (title, version, description, is_major, changes) VALUES (
  'Anti-Loadstring-Hook Shield',
  '10.2.0',
  'Defeats loadstring hooking bypass with chunked encryption and decoy flooding',
  true,
  '["Chunked Encryption: Code split into 8-40 shuffled encrypted fragments", "Decoy Flooding: 100 fake Roblox scripts flood hooked loadstring", "Shuffle Scrambling: Chunks in randomized order via Lehmer PRNG", "Per-Chunk Keys: Each fragment uses unique derived encryption key"]'::jsonb
);