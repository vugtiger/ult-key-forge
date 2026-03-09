UPDATE public.site_info SET last_updated = now(), version = '10.0.0' WHERE id = (SELECT id FROM public.site_info LIMIT 1);

INSERT INTO public.changelog (version, title, description, is_major, changes) VALUES (
  '10.0.0',
  'Phantom Shield - ULT Protection v10.0',
  'Revolutionary 6-layer protection system with never-before-seen defense mechanisms',
  true,
  '["Polymorphic Code Morphing - structurally different code every request", "Execution DNA Chain - runtime behavioral fingerprint that breaks on copy", "Self-Destructing Watermarks - invisible traceable markers for leak detection", "Ghost Code Injection - dormant traps activate on decompile/dump", "Post-Execution Memory Scramble - VM memory corruption after execution", "GC Sentinel, Stack Depth Validation, Metamorphic Self-Modification", "Quantum Token Pairs - entangled dual-token server validation", "Honeypot fixed - no longer auto-bans shared infrastructure IPs"]'::jsonb
);