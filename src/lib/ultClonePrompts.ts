// 8,000 fully-detailed website build prompts.
// Each prompt tells an AI builder to create a script-protection platform in the
// spirit of ULT LUA — but with a unique brand name, theme, palette, layout,
// motion language and feature emphasis, and a quality bar that beats ULT.
//
// Generation is deterministic: prompt #N is always identical. 100 prefixes x
// 80 suffixes = 8,000 unique brand names, each paired with a rotating theme,
// layout, typography, motion and feature mix via coprime index stepping.

export interface UltPrompt {
  id: string;
  index: number;
  name: string;
  theme: string;
  category: string;
  is3D: boolean;
  scale: "lean" | "full" | "flagship";
  body: string;
}

const PREFIXES = [
  "Nova", "Aegis", "Cipher", "Vanta", "Orbit", "Helix", "Sentry", "Quartz", "Lumen", "Onyx",
  "Zenith", "Umbra", "Prism", "Vector", "Solis", "Kairo", "Nimbus", "Atlas", "Ember", "Frost",
  "Pulse", "Rune", "Titan", "Volt", "Wraith", "Axiom", "Bastion", "Citadel", "Drift", "Echo",
  "Fable", "Glyph", "Hollow", "Ionic", "Jade", "Kraken", "Lattice", "Mirage", "Nebula", "Oblique",
  "Pyre", "Quasar", "Raptor", "Spectre", "Tundra", "Ultra", "Verge", "Warden", "Xenon", "Yield",
  "Zephyr", "Anvil", "Beacon", "Cobalt", "Dusk", "Eclipse", "Flux", "Granite", "Harbor", "Iris",
  "Junction", "Keystone", "Lantern", "Monolith", "North", "Obsidian", "Palisade", "Quill", "Relay", "Summit",
  "Tesla", "Union", "Vigil", "Whisper", "Apex", "Blaze", "Crest", "Delta", "Element", "Forge",
  "Gale", "Haven", "Impulse", "Juno", "Kinetic", "Legion", "Meridian", "Nyx", "Orion", "Prime",
  "Quantum", "Ridge", "Stellar", "Torch", "Umbral", "Vertex", "Wisp", "Xerus", "Yonder", "Zodiac",
];

const SUFFIXES = [
  "Shield", "Vault", "Guard", "Lock", "Forge", "Core", "Gate", "Cloud", "Link", "Grid",
  "Node", "Keep", "Wall", "Watch", "Cage", "Anchor", "Bind", "Cover", "Dome", "Edge",
  "Field", "Frame", "Host", "Key", "Layer", "Mesh", "Net", "Orb", "Pass", "Port",
  "Proof", "Root", "Safe", "Seal", "Shell", "Sight", "Spine", "Stack", "Stone", "Trace",
  "Track", "Trust", "Veil", "Ward", "Wire", "Works", "Chain", "Circuit", "Crypt", "Deck",
  "Engine", "Fabric", "Halo", "Helm", "Hub", "Ink", "Labs", "Lens", "Loop", "Mark",
  "Matrix", "Mint", "Path", "Pillar", "Point", "Pulse", "Rail", "Realm", "Relay", "Ring",
  "Script", "Sector", "Signal", "Sphere", "Stream", "Studio", "Sync", "Tower", "Vault X", "Zone",
];

interface Theme {
  name: string;
  category: string;
  palette: string;
  vibe: string;
  logo: string;
  is3D: boolean;
}

const THEMES: Theme[] = [
  { name: "Midnight Obsidian", category: "Dark Minimal", palette: "obsidian #05060a, electric indigo #4f46e5, ghost white #f8fafc", vibe: "razor-thin borders, mono type, one accent hairline per section", logo: "a rotating obsidian shard", is3D: false },
  { name: "Liquid Chrome", category: "3D Futuristic", palette: "iridescent chrome, holo teal #5cf2d4, magenta bleed #ff3da6", vibe: "glassmorphism with parallax depth and floating 3D ribbons", logo: "a liquid metal droplet that morphs on hover", is3D: true },
  { name: "Cyber Neon Tokyo", category: "Cyberpunk", palette: "hot pink #ff2e88, cyan #00f0ff, void black #0a0014", vibe: "scanlines, glitch text on hover, neon underglow beneath cards", logo: "a katana-shaped lightning bolt", is3D: false },
  { name: "Glacial Aurora", category: "Ice", palette: "arctic white #eaf6ff, glacier blue #6bb6ff, aurora green #4ade80", vibe: "frosted panels, drifting aurora gradient, slow snowfall particles", logo: "a rotating snowflake fractal", is3D: false },
  { name: "Volcanic Ember", category: "Fire", palette: "obsidian #0a0a0a, ember orange #ff6b1a, molten gold #f5b800", vibe: "embers rising, lava-crack borders, heat haze over the hero", logo: "a stylized ember rune", is3D: false },
  { name: "Quantum Void", category: "3D Futuristic", palette: "void black #000000, quantum violet #8b5cf6, plasma white #ffffff", vibe: "WebGL particle field, tilted 3D cards, depth-of-field blur", logo: "a rotating tesseract", is3D: true },
  { name: "Brutalist Pop", category: "Brutalist", palette: "raw white #ffffff, hard black #000000, alarm red #ff2200, caution yellow #ffe600", vibe: "4px black borders, oversized type, deliberate misalignment, zero shadows", logo: "a hand-drawn block monogram", is3D: false },
  { name: "Vaporwave Dream", category: "Retro", palette: "pink #ff77e9, cyan #7df9ff, purple #b56bff", vibe: "VHS scanlines, 80s grid floor, chromatic aberration on hover", logo: "a palm-tree wireframe sunset", is3D: true },
  { name: "Royal Emerald", category: "Luxury", palette: "emerald #064e3b, antique gold #c9a84c, ivory #f5f0e0", vibe: "serif headlines, gold-leaf rules, slow elegant crossfades", logo: "an emerald crest", is3D: false },
  { name: "Paper & Ink", category: "Editorial", palette: "off-white #f5f3ee, bone #e8e4dd, rich black #0d0d0d", vibe: "Swiss grid, ruled lines, magazine columns, no glow anywhere", logo: "an inked monogram stamp", is3D: false },
  { name: "Terminal Green", category: "Hacker", palette: "phosphor green #00ff66, console black #0b0f0d", vibe: "monospace everything, blinking cursor, CRT curvature, ASCII header", logo: "an ASCII art mark", is3D: false },
  { name: "Sakura Drift", category: "Soft Pastel", palette: "blossom pink #f8c8d8, cream #fff8f0, sage #a8c0a0", vibe: "drifting petals, handwritten serif accents, watercolour edges", logo: "a single sakura petal", is3D: false },
  { name: "Holo Bento", category: "Bento Grid", palette: "off-black #0e0e10 with a holographic accent gradient", vibe: "tight bento grid, mixed tile ratios, tiles lift in 3D on hover", logo: "a cube that unfolds on hover", is3D: true },
  { name: "Desert Sandstorm", category: "Earth", palette: "terracotta #c2956b, sand #d4a574, dusk purple #574b90", vibe: "grain texture, dune silhouettes, slow parallax sand", logo: "a sun cresting a dune", is3D: false },
  { name: "Deep Ocean Trench", category: "Aquatic", palette: "abyss navy #001028, bioluminescent teal #2dd4a8, jelly pink #ff8fae", vibe: "caustic shimmer, plankton particles, depth fog at the fold", logo: "a bioluminescent jellyfish", is3D: true },
  { name: "Origami Paper", category: "Geometric", palette: "warm white #faf7f2, crease grey #c7c0b6, signal red #d4302a", vibe: "folded-paper shadows, crease-line dividers, low-poly icons", logo: "a folded paper crane", is3D: false },
  { name: "Skyline Indigo", category: "Corporate", palette: "navy #0f1b3d, white #ffffff, electric blue #3b6fa0", vibe: "enterprise clarity, generous whitespace, soft data-viz hero", logo: "a skyline mark", is3D: false },
  { name: "Galaxy Nebula", category: "Cosmic", palette: "deep space #0a0420, nebula purple #a78bfa, star white #ffffff", vibe: "starfield, drifting nebula gradient, orbiting planet accent", logo: "a ringed planet", is3D: true },
  { name: "Lab Mint", category: "Tech Startup", palette: "mint #2dd4a8, deep teal #1b4332, off-white #f5fbf8", vibe: "fresh and airy, wave dividers, oversized rounded cards", logo: "a minimal beaker", is3D: false },
  { name: "Crimson Cathedral", category: "Gothic", palette: "midnight blood #1a0008, crimson #8b0020, candle gold #d4a017", vibe: "gothic serif, stained-glass dividers, candle flicker near the cursor", logo: "a rose window", is3D: false },
  { name: "Solarpunk Bloom", category: "Eco", palette: "leaf green #4ade80, solar yellow #fde047, sky #bae6fd", vibe: "organic blobs, vines at the edges, gentle wind on leaves", logo: "a sun behind a leaf", is3D: false },
  { name: "Monochrome Swiss", category: "Editorial", palette: "white #ffffff, true black #000000, one red accent #e63946", vibe: "12-column grid, Helvetica, type-only hero", logo: "a dot plus lowercase wordmark", is3D: false },
  { name: "Hologram Lab", category: "3D Futuristic", palette: "lab white #f7faff, hologram cyan #67e8f9, magenta #f472b6", vibe: "WebGL hologram cube, scanning beam, sci-fi HUD overlays", logo: "a wireframe sphere", is3D: true },
  { name: "Forgotten Forest", category: "Earth", palette: "deep moss #1a3c2a, fog grey #cdd5d1, lantern amber #e8b84a", vibe: "fog at the fold, leaf particles, soft wind motion", logo: "a hanging lantern", is3D: false },
  { name: "Carbon Fiber GT", category: "Automotive", palette: "carbon black #111114, racing red #d40000, silver #c8ccd0", vibe: "carbon weave, speed lines on hover, tachometer stat dials", logo: "a racing emblem", is3D: false },
  { name: "Crystal Cavern", category: "3D Futuristic", palette: "cave indigo #1c1240, crystal violet #b389ff, glow white #ffffff", vibe: "refracting shards, prismatic light leaks, parallax depth", logo: "a faceted crystal", is3D: true },
  { name: "Atomic Heart", category: "Retro", palette: "atomic teal #2bd1c4, hot orange #ff5722, cream #f7f3e3", vibe: "1950s atomic shapes, starburst accents, retro serif hero", logo: "an orbiting atom", is3D: false },
  { name: "Mint & Peach", category: "Soft Modern", palette: "light mint #b9e7c9, light peach #ffd2b0, charcoal #23241f", vibe: "rounded geometric shapes, playful section blocks, friendly type", logo: "a rounded shield with a leaf cut-out", is3D: false },
  { name: "Steel Blueprint", category: "Technical", palette: "blueprint blue #0b2545, draft cyan #79c0ff, chalk #eef4fb", vibe: "graph-paper background, dimension lines, annotated callouts", logo: "a compass and rule mark", is3D: false },
  { name: "Noir Spotlight", category: "Dark Cinematic", palette: "ink #08080a, smoke grey #3a3a42, spotlight cream #f3e9d2", vibe: "single light source, long shadows, film grain, letterboxed hero", logo: "a spotlight cone", is3D: false },
  { name: "Candy Arcade", category: "Playful", palette: "bubblegum #ff6ec7, lime #b6ff4d, blueberry #5b6cff", vibe: "chunky buttons with hard shadows, pixel confetti, arcade sound cues", logo: "a pixel joystick", is3D: false },
  { name: "Molten Glass", category: "3D Futuristic", palette: "smoked glass #1b1d22, amber core #ffb347, cool white #e9eef5", vibe: "thick refractive glass panels, caustics, slow rotating 3D blob", logo: "a glass sphere with an amber core", is3D: true },
  { name: "Arctic Steel", category: "Industrial", palette: "gunmetal #2b2f36, ice #dce6f0, warning orange #ff7a1a", vibe: "riveted panels, hazard stripes, hard-edged data tables", logo: "a hexagonal bolt", is3D: false },
  { name: "Velvet Aubergine", category: "Luxury", palette: "aubergine #2c0f3a, velvet plum #7b2d8b, champagne #f0dcae", vibe: "soft velvet gradients, rounded serif headings, candle-warm glows", logo: "a crescent monogram", is3D: false },
  { name: "Signal Orange", category: "Bold Modern", palette: "jet #141414, signal orange #ff5a1f, concrete #d8d8d2", vibe: "huge numerals, split layouts, marquee ticker of live stats", logo: "a chevron stack", is3D: false },
  { name: "Aurora Glass", category: "Glassmorphism", palette: "slate #0f172a, aurora violet #a855f7, mist #e2e8f0", vibe: "backdrop-blur panels, animated aurora behind everything, soft rims", logo: "a blurred orb mark", is3D: false },
  { name: "Paper Terminal", category: "Hacker", palette: "cream paper #f4efe4, typewriter black #1b1b1b, stamp red #c1121f", vibe: "typewriter mono on paper, stamped badges, printed-report tables", logo: "a wax seal with a key", is3D: false },
  { name: "Neon Circuitry", category: "Cyberpunk", palette: "board green #0b1f16, trace gold #ffd166, laser cyan #00e5ff", vibe: "PCB trace patterns that animate current along the routes", logo: "a chip die with traces", is3D: false },
  { name: "Cloud Cathedral", category: "Ethereal", palette: "cloud white #f7f9ff, sky #9fc2ff, halo gold #ffe6a3", vibe: "volumetric clouds, light shafts, weightless floating cards", logo: "a cloud pierced by a beam", is3D: true },
  { name: "Rust & Bone", category: "Post-Industrial", palette: "rust #8a3b12, bone #e8e1d2, soot #23201d", vibe: "weathered textures, stencil type, cracked dividers", logo: "a stencilled shield", is3D: false },
];

const LAYOUTS = [
  "a full-bleed hero with a live animated background, then alternating left/right feature sections",
  "a bento-grid homepage where every product pillar is a differently sized tile",
  "a sticky split-screen: pinned visual on the left, scrolling copy on the right",
  "a single scrolling column with generous whitespace and big pull-quote stats",
  "a dashboard-style marketing page that previews the real product UI in every section",
  "a magazine layout with a 12-column grid, drop caps and inset pull quotes",
  "a horizontal scroll-snap section between two vertical sections for the feature tour",
  "an asymmetric broken grid where cards overlap and tilt slightly",
  "a sidebar-navigated docs-style landing page with anchored sections",
  "a full-width alternating band layout, each band a different surface tone",
];

const MOTIONS = [
  "scroll-reveal fade-and-rise on every section with staggered child delays",
  "a top scroll-progress bar plus an animated scroll cue under the hero",
  "cursor-following parallax on hero art, capped at 12px of travel",
  "count-up number animations on stats when they enter the viewport",
  "magnetic buttons that subtly pull toward the cursor",
  "section transitions using a soft clip-path wipe",
  "hover tilt on cards with a specular highlight that follows the pointer",
  "a marquee ticker of live protection stats that pauses on hover",
];

const FONTS = [
  "Space Grotesk headings with DM Sans body",
  "Syne headings with Plus Jakarta Sans body",
  "Outfit headings with Figtree body",
  "Sora headings with Manrope body",
  "Instrument Serif headings with Work Sans body",
  "Bebas Neue headings with Barlow body",
  "JetBrains Mono headings with Work Sans body",
  "Archivo Black headings with Hind body",
];

const CORE_FEATURES = [
  "email + password auth with verification, plus Google sign-in, and a password reset flow that always returns to the canonical site URL",
  "a paste/script vault: upload or paste Lua, name it, tag it, and get a short shareable loader link",
  "one-click loadstring generation with a copy button and a QR code for mobile",
  "source hiding: the public link never returns plaintext, only a short-lived loader that exchanges a one-time token for the payload",
  "per-script key system with generated keys, expiry dates, usage counters and instant revoke",
  "HWID / device locking with a per-key device limit and a self-serve reset cooldown",
  "per-game binding: allow a script to run only inside specific game IDs, with an allowlist editor",
  "a live access monitor showing every execution attempt with time, device, region and result",
  "permanent ban management for abusive devices, accounts and networks, with an unban flow",
  "a multi-layer Lua obfuscator with selectable strength levels and a before/after size report",
  "version history per script: every save is a version, buyers get the newest, you can roll back",
  "a Discord bot that issues keys, checks status, resets HWIDs and posts execution alerts",
  "an AI assistant tab that writes, fixes and explains Lua and web code in a chat with file uploads",
  "a public status page with uptime, incident history and an email subscribe box",
  "a changelog page generated from release entries, with RSS",
  "team seats so several people can manage the same scripts with separate logins and an audit trail",
  "webhooks fired on key issue, key revoke, execution success and execution block",
  "CSV export of keys, executions, devices and bans",
  "a searchable, filterable script list with bulk actions",
  "a customisable in-game key prompt window with live preview of colours, corner radius and copy",
];

const ADVANCED_FEATURES = [
  "rate limiting per IP and per account, with a friendly cooldown message instead of a hard error",
  "a role table separate from profiles, with a security-definer has_role() function used by every policy",
  "row-level security on every table plus explicit grants, so nothing is readable without a policy",
  "fail-open behaviour on non-critical checks: a monitoring hiccup must never block a legitimate execution",
  "an analytics dashboard with daily executions, unique devices, block reasons and top scripts",
  "an admin panel with tabs for users, scripts, keys, devices, bans and logs",
  "an installable progressive web app with an offline shell and a dedicated install page",
  "full keyboard navigation, visible focus rings and reduced-motion support throughout",
  "light and dark themes driven entirely by semantic design tokens, no hardcoded colours",
  "a public comparison page that honestly contrasts the product with competing tools",
  "a referral programme that rewards inviters with higher limits rather than cash",
  "an in-app onboarding checklist that tracks first script, first key and first execution",
  "localisation with a language switcher and translated UI strings",
  "an in-app notification centre for security events, with email digests",
];

const DIFFERENTIATORS = [
  "the loader must feel instant: no artificial waits, and the payload compiles before any loading UI is torn down",
  "every error the end user can see is written in plain language with a next step, never a raw code",
  "the key prompt window must look designed, not bolted on: consistent radius, real spacing rhythm, no stretched art",
  "mobile is the primary target: every table collapses into readable cards and nothing scrolls horizontally",
  "the dashboard must be navigable in three clicks or fewer to any action",
  "empty states are designed, with an illustration, one sentence and one obvious button",
  "loading states use skeletons that match the final layout, never spinners on blank pages",
  "destructive actions require typed confirmation and are always undoable for 30 seconds",
  "the marketing site and the product share one design system so the app never feels like a different site",
  "search is instant and fuzzy across scripts, keys and devices from a single command palette",
];

const AUDIENCES = [
  "Roblox script developers who sell or share hubs",
  "small game-tooling studios distributing internal modules",
  "solo creators who want piracy protection without a monthly bill",
  "community hub owners managing hundreds of users",
  "developers migrating off a paid licensing service",
];

const PRICING = [
  "completely free forever with no premium tier, no upsells and no payment forms anywhere",
  "free forever, funded by nothing — make the pricing page a single honest statement that everything is included",
  "free with generous limits published openly on a limits page, and no hidden throttling",
];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

function pickMany<T>(arr: T[], start: number, count: number, step: number): T[] {
  const out: T[] = [];
  for (let k = 0; k < count; k++) out.push(arr[(start + k * step) % arr.length]);
  return Array.from(new Set(out));
}

export const TOTAL_PROMPTS = PREFIXES.length * SUFFIXES.length; // 8000

function build(index: number): UltPrompt {
  const name = `${PREFIXES[Math.floor(index / SUFFIXES.length)]} ${SUFFIXES[index % SUFFIXES.length]}`;
  const theme = THEMES[(index * 7) % THEMES.length];
  const layout = pick(LAYOUTS, index * 3 + 1);
  const motion = pick(MOTIONS, index * 5 + 2);
  const font = pick(FONTS, index * 11 + 3);
  const audience = pick(AUDIENCES, index * 13 + 1);
  const pricing = pick(PRICING, index * 17 + 2);
  const scale: UltPrompt["scale"] = index % 3 === 0 ? "lean" : index % 3 === 1 ? "full" : "flagship";
  const coreCount = scale === "lean" ? 8 : scale === "full" ? 13 : 18;
  const advCount = scale === "lean" ? 4 : scale === "full" ? 8 : 12;
  const core = pickMany(CORE_FEATURES, index * 3, coreCount, 1);
  const adv = pickMany(ADVANCED_FEATURES, index * 5, advCount, 1);
  const diffs = pickMany(DIFFERENTIATORS, index * 7, 5, 1);
  const tagline = `${name} — ${theme.vibe.split(",")[0]} protection for Lua`;

  const body = `Build a complete, production-quality web app called "${name}".

WHAT IT IS
${name} is a Lua / Roblox script protection platform: creators upload a script, and ${name} gives them a short loader link, a key system, device locking and live execution monitoring, so their source is never handed out in plaintext. Target audience: ${audience}. Pricing: ${pricing}.
Tagline to use on the hero: "${tagline}".

BRAND & THEME
- Theme name: ${theme.name} (${theme.category}).
- Palette: ${theme.palette}. Put every one of these in the global stylesheet as semantic design tokens (background, foreground, primary, accent, muted, border, destructive) in HSL, and never hardcode a colour in a component.
- Visual language: ${theme.vibe}.
- Logo: ${theme.logo}, drawn as inline SVG, no text inside the mark, used in the header, favicon and install icons.
- Typography: ${font}. Set a clear type scale and stick to it.
${theme.is3D ? "- Include real depth: a lightweight WebGL or CSS-3D background that stays under 60fps budget, pauses when the tab is hidden, and degrades to a static gradient when WebGL is unavailable." : "- Keep it strictly 2D: no WebGL. Depth comes from layering, shadow and contrast only."}

LAYOUT & MOTION
- Homepage structure: ${layout}.
- Motion: ${motion}. Respect prefers-reduced-motion and disable non-essential animation when it is set.
- Sections on the marketing page: hero with primary CTA, three-pillar value row, feature tour, live product preview, comparison table, FAQ accordion, final CTA, footer with status and changelog links.

PAGES
/ (marketing), /auth (sign in + sign up), /dashboard (scripts overview), /scripts/:id (script detail with tabs), /keys, /devices, /monitor (live access log), /analytics, /settings, /changelog, /status, /compare, /install, and a designed 404.

CORE FEATURES — all of these must actually work, not be placeholders:
${core.map((f, i) => `${i + 1}. ${f}`).join("\n")}

ENGINEERING & HARDENING:
${adv.map((f) => `- ${f}`).join("\n")}

DATA MODEL (backend with auth, database, storage and serverless functions)
- profiles (id -> auth user, display name, avatar, created_at)
- user_roles (user_id, role) in its own table, never a column on profiles
- scripts (id, owner_id, name, slug, tags, hidden_source boolean, created_at, updated_at)
- script_versions (id, script_id, payload, size, created_at)
- keys (id, script_id, key, note, expires_at, max_devices, revoked_at)
- devices (id, key_id, hwid, first_seen, last_seen, blocked)
- executions (id, script_id, key_id, device_id, result, reason, region, created_at)
- bans (id, subject_type, subject_value, reason, created_at, expires_at)
Every table gets row-level security, owner-scoped policies and explicit grants. Serverless functions: issue-key, validate-key, get-loader, record-execution, reset-hwid, admin-actions.

QUALITY BAR — this is what separates ${name} from an average build:
${diffs.map((d) => `- ${d}`).join("\n")}

ACCEPTANCE CHECKS
- I can sign up, create a script, generate a key, copy the loader link, and see the execution appear in the live monitor within one session, with no console errors.
- Revoking a key immediately blocks the next execution and the monitor shows the reason.
- The whole app is usable one-handed on a 360px-wide phone.
- Lighthouse: performance and accessibility both 90+.
- SEO: unique title under 60 characters, meta description under 160, one H1 per page, Open Graph tags, alt text on every image, JSON-LD for the software application.

Build it end to end, wire every button, and do not leave any "coming soon" placeholders.`;

  return {
    id: `ult-${index + 1}`,
    index: index + 1,
    name,
    theme: theme.name,
    category: theme.category,
    is3D: theme.is3D,
    scale,
    body,
  };
}

let cache: UltPrompt[] | null = null;

export function getUltPrompts(): UltPrompt[] {
  if (!cache) {
    cache = Array.from({ length: TOTAL_PROMPTS }, (_, i) => build(i));
  }
  return cache;
}

export function getUltPrompt(index: number): UltPrompt {
  return build(index);
}

export const ULT_PROMPT_CATEGORIES = Array.from(new Set(THEMES.map((t) => t.category))).sort();
