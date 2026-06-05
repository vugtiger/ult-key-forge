// Massive prompt generator for "Build me a script protection platform" prompts.
// Generates thousands of unique long-form prompts via combinatorics, with a
// daily-seeded shuffle so the visible set rotates every 24h.

export type PromptTier = "free" | "paid";
export type FeatureSize = "small" | "big";

export interface GeneratedPrompt {
  id: string;
  title: string;
  category: string;       // theme category
  tier: PromptTier;
  featureSize: FeatureSize;
  is3D: boolean;
  price?: string;         // only when tier === "paid"
  paymentMethods?: string[];
  body: string;           // long prompt
  tags: string[];
}

const THEMES = [
  { name: "Midnight Obsidian", category: "Dark Minimal", palette: "deep obsidian black #05060a, electric indigo #4f46e5, ghost white #f8fafc", vibe: "ultra-minimal, razor-thin borders, mono typography, no decoration except a single accent line", logo: "a single rotating obsidian shard SVG", three_d: false },
  { name: "Liquid Chrome", category: "3D Futuristic", palette: "iridescent chrome, holographic teal #5cf2d4, magenta bleed #ff3da6", vibe: "glass-morphism with parallax depth, soft 3D ribbons floating behind cards", logo: "a liquid metal droplet that morphs on hover", three_d: true },
  { name: "Cyber Neon Tokyo", category: "Cyberpunk", palette: "hot pink #ff2e88, cyan #00f0ff, deep black #0a0014", vibe: "scanline overlays, glitch text on hover, neon underglows under every card", logo: "a katana-shaped lightning bolt", three_d: false },
  { name: "Glacial Aurora", category: "Ice / Cold", palette: "arctic white #eaf6ff, glacial blue #6bb6ff, aurora green #4ade80", vibe: "frosted glass panels, animated aurora gradient in background, snowfall particles", logo: "a snowflake fractal that slowly rotates", three_d: false },
  { name: "Volcanic Ember", category: "Fire / Warm", palette: "obsidian #0a0a0a, ember orange #ff6b1a, molten gold #f5b800", vibe: "embers floating upward, lava-crack borders, heat-haze on hero", logo: "a stylized ember rune", three_d: false },
  { name: "Quantum Void", category: "3D Futuristic", palette: "void black #000000, quantum violet #8b5cf6, plasma white #ffffff", vibe: "WebGL particle field background, 3D tilted cards, depth-of-field blur", logo: "a rotating tesseract", three_d: true },
  { name: "Brutalist Pop", category: "Brutalist", palette: "raw white #ffffff, harsh black #000000, alarm red #ff2200, caution yellow #ffe600", vibe: "thick 4px black borders, oversized typography, intentional misalignment, no shadows", logo: "a hand-drawn block letter mark", three_d: false },
  { name: "Vaporwave Dream", category: "Retro / Y2K", palette: "pink #ff77e9, cyan #7df9ff, purple #b56bff", vibe: "VHS scanlines, 80s grid floor on hero, chromatic aberration on hover", logo: "a sunset palm-tree wireframe", three_d: true },
  { name: "Royal Emerald", category: "Luxury", palette: "deep emerald #064e3b, antique gold #c9a84c, ivory #f5f0e0", vibe: "serif typography, gold-leaf borders, slow elegant fade transitions", logo: "an emerald crest with crown", three_d: false },
  { name: "Paper & Ink", category: "Editorial", palette: "off-white #f5f3ee, bone #e8e4dd, rich black #0d0d0d", vibe: "Swiss typography, ruled lines, magazine grid, zero glow effects", logo: "an inked monogram stamp", three_d: false },
  { name: "Terminal Hacker", category: "Hacker / Mono", palette: "phosphor green #00ff66, console black #0b0f0d", vibe: "monospace everywhere, blinking cursor, CRT scanline overlay, ASCII art header", logo: "an ASCII art skull", three_d: false },
  { name: "Sakura Drift", category: "Soft / Pastel", palette: "blossom pink #f8c8d8, cream #fff8f0, sage #a8c0a0", vibe: "petals drifting across screen, soft handwritten serif, watercolor edges", logo: "a single sakura petal", three_d: false },
  { name: "Holo Bento", category: "Bento Grid", palette: "off-black #0e0e10, holographic gradient accent", vibe: "tight bento-grid layout, each tile a different aspect ratio, hover lifts the tile in 3D", logo: "a 3D cube logo that unfolds on hover", three_d: true },
  { name: "Desert Sandstorm", category: "Earth / Natural", palette: "terracotta #c2956b, sand #d4a574, dusk purple #574b90", vibe: "grainy noise texture, soft dunes silhouette, slow scrolling parallax sand", logo: "a sun rising over a dune", three_d: false },
  { name: "Deep Ocean Trench", category: "Aquatic", palette: "abyss navy #001028, bioluminescent teal #2dd4a8, jelly pink #ff8fae", vibe: "caustic light shimmer, drifting particles like plankton, depth fog at bottom", logo: "a bioluminescent jellyfish", three_d: true },
  { name: "Origami Paper", category: "Geometric", palette: "warm white #faf7f2, crease grey #c7c0b6, accent red #d4302a", vibe: "folded paper shadows, crease lines as section dividers, low-poly icons", logo: "a folded paper crane", three_d: false },
  { name: "Skyline Indigo", category: "Corporate Modern", palette: "navy #0f1b3d, white #ffffff, electric blue #3b6fa0", vibe: "clean enterprise layout, generous whitespace, soft data viz on hero", logo: "a stylized city skyline mark", three_d: false },
  { name: "Galaxy Nebula", category: "Cosmic", palette: "deep space #0a0420, nebula purple #a78bfa, star white #ffffff", vibe: "starfield background, slow nebula gradient drift, planet orbit animation", logo: "a ringed planet that slowly rotates", three_d: true },
  { name: "Lab Mint", category: "Tech Startup", palette: "mint #2dd4a8, deep teal #1b4332, off-white #f5fbf8", vibe: "fresh, clean, lots of whitespace, animated wave divider", logo: "a minimal beaker icon", three_d: false },
  { name: "Crimson Cathedral", category: "Gothic", palette: "midnight blood #1a0008, crimson #8b0020, candle gold #d4a017", vibe: "gothic serif type, stained-glass section dividers, candle flicker on cursor", logo: "a stained-glass rose window", three_d: false },
  { name: "Solarpunk Bloom", category: "Eco / Organic", palette: "leaf green #4ade80, solar yellow #fde047, sky #bae6fd", vibe: "organic blob shapes, vines crawling at edges, gentle wind animation on leaves", logo: "a sun behind a leaf", three_d: false },
  { name: "Monochrome Swiss", category: "Editorial", palette: "white #ffffff, true black #000000, single red accent #e63946", vibe: "12-column grid, Helvetica everywhere, no images on hero — just typography", logo: "a single dot with project name in lowercase", three_d: false },
  { name: "Hologram Lab", category: "3D Futuristic", palette: "lab white #f7faff, hologram cyan #67e8f9, magenta #f472b6", vibe: "WebGL hologram cube in hero, scanning beam across UI, sci-fi HUD overlay", logo: "a rotating wireframe sphere", three_d: true },
  { name: "Forgotten Forest", category: "Earth / Natural", palette: "deep moss #1a3c2a, fog grey #cdd5d1, lantern amber #e8b84a", vibe: "fog drifting at bottom of hero, leaf particles, gentle wind sound", logo: "a lantern hanging from a branch", three_d: false },
  { name: "Carbon Fiber GT", category: "Automotive", palette: "carbon black #111114, racing red #d40000, silver #c8ccd0", vibe: "carbon-weave texture on cards, speed lines on hover, tachometer-style stats", logo: "a stylized racing emblem", three_d: false },
  { name: "Crystal Cavern", category: "3D Futuristic", palette: "cave indigo #1c1240, crystal violet #b389ff, glow white #ffffff", vibe: "refracting crystal shards in background, prismatic light leaks", logo: "a faceted crystal that catches light", three_d: true },
  { name: "Atomic Heart", category: "Retro / Y2K", palette: "atomic teal #2bd1c4, hot orange #ff5722, cream #f7f3e3", vibe: "1950s atomic shapes, starburst accents, retro serif on hero", logo: "an orbiting atom mark", three_d: false },
];

const NAMES = [
  "ULT Shield","Aegis Cloud","Bastion","Veilforge","Obfuscat","Nullbyte","Cipher Cloud","Lockstep","Sigil",
  "Vaultscript","Phantom Loader","Shroud","ScriptHaven","Keystone","Ironveil","Cryptforge","Sentinel Cloud",
  "Glyphguard","Hexvault","Pyrelock","Voidshield","Stormgate","Echo Cipher","Onyx Loader","Helix Protect",
  "Aurora Lock","Nightingale","Spectre Cloud","Forgekey","Riftguard","Tempest","Halocrypt","Nimbus Shield",
  "Talon","Wraithloader","Quantum Vault","Zenith Cipher","Mythos Shield","Nova Loader","Pulsar Protect",
  "Eclipse Lock","Lumen Cloud","Citadel Script","Vector Vault","Apex Shield","Sable Cipher","Mirage Loader",
];

const SMALL_FEATURES = [
  "code minification and string-table compression for Lua source",
  "single-script license validation tied to a user account",
  "Discord webhook notifications on successful script load (developer's own server only)",
  "time-limited license keys (24h rotation) with self-serve regeneration",
  "client environment fingerprinting (executor name + version) for analytics",
  "device pairing: one license -> one device, swap via dashboard",
  "in-game console progress bar shown to the end-user during load",
  "minified bootstrap loader served from the developer's own endpoint",
  "single-use request tokens to prevent accidental replay of stale loader URLs",
  "per-account request rate limiting (10/hour) to keep API costs predictable",
  "Discord OAuth login as the primary auth method",
  "compile-time string compression to keep the shipped payload small",
  "graceful error handling with pcall so a failed load never crashes the host game",
  "one-click copy of the loader snippet for the developer's docs",
  "minimal dashboard with 4 tiles (scripts, licenses, loads, revenue)",
];

const BIG_FEATURES = [
  "multi-pass Lua minifier: identifier renaming, dead-code elimination, string-table compression, control-flow simplification, constant folding, table indirection, safe-call wrappers",
  "per-request signed loader generation with 30-second single-use tokens bound to the requesting account session",
  "tiered license management with separate revocation lists for accounts, devices, and refunded purchases, with admin allowlist support",
  "Discord OAuth as the sole authentication method, with a 60-second first-visit grace window and full session management afterward",
  "real-time load analytics dashboard that distinguishes browser visits from in-game loads, with deduplicated user profile cards",
  "bot-detection endpoint that returns a lightweight decoy response to obvious scrapers while always serving valid clients (Discord/Meta crawlers exempt)",
  "automated license-panel generator with a two-panel 720x408 design, 28px corner radius, live preview, and per-license paste binding",
  "voice-driven admin assistant that navigates internal tabs and answers questions via low-latency TTS",
  "lightweight integrity check that aborts gracefully when the loader is invoked outside the intended runtime",
  "fail-open delivery pipeline: non-critical database or analytics failures must never block a paying customer's script from loading",
  "Stripe / Paddle subscription billing for premium tiers with webhook-driven role updates and a customer portal",
  "live community server showcase tab with 5-minute caching to stay under the Discord API rate limit",
  "per-script allowlist of Roblox place IDs so the developer can scope distribution to specific games",
  "device-id cross-validation against account-id mismatch, with automatic suspension of credential-sharing accounts",
  "license-key validation that writes the decoded payload to a sandboxed temp slot and executes it from there",
  "soft-flag telemetry that buffers suspicious-but-inconclusive signals into a review queue instead of auto-revoking",
  "AI assistant tab (Lovable AI gateway) that auto-saves every generated code block into a Files tab with copy + download",
  "performance hardening: 15s DB query timeout, fire-and-forget analytics writes, synchronous token issuance",
  "delivery hardening: chunked transfer, payload shuffling, decoy traffic to keep CDN patterns smooth",
  "strict 1:1 binding between a license key, its control panel, and the exact script it unlocks",
  "API hardening that prevents naive scraping of script bodies and keeps the loader endpoint stateless",
  "smart-rate-limit tier (subnet heuristics + ASN allowlist) plus a Fortress mode that hardens every public endpoint",
  "fully responsive admin dashboard with specialized tabs and 3-tier license management",
  "edge function written in Deno.serve with verify_jwt bypass, randomized response timing, and zero raw content policy",
];

const PAYMENT_METHODS = [
  ["Stripe (cards, Apple Pay, Google Pay)", "Stripe Customer Portal for self-serve cancellation"],
  ["Paddle (Merchant of Record, global tax handled)", "Paddle webhook-driven role sync"],
  ["Stripe Checkout with subscription tiers (monthly + yearly)", "promo codes + free trial"],
  ["PayPal one-time", "Stripe recurring"],
  ["Crypto via Coinbase Commerce (BTC, ETH, USDC)", "Stripe fallback for cards"],
];

const PRICE_TIERS = [
  "$4.99/mo Basic, $9.99/mo Pro, $19.99/mo Elite",
  "$7/mo or $59/yr (single tier, lifetime upgrade available)",
  "$2.99/mo Starter, $14.99/mo Studio (team)",
  "$9.99/mo, $24.99/mo (with team seats), $99 lifetime",
  "Free tier + $4.99/mo Pro + $39.99 lifetime",
];

// Deterministic seeded RNG (mulberry32) for daily rotation
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function todaySeed() {
  const d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

function buildBody(theme: typeof THEMES[number], name: string, size: FeatureSize, tier: PromptTier, price?: string, methods?: string[]) {
  const featurePool = size === "big" ? BIG_FEATURES : SMALL_FEATURES;
  const featureCount = size === "big" ? 8 : 4;
  const rng = mulberry32(
    [...name].reduce((s, c) => s + c.charCodeAt(0), 0) +
      [...theme.name].reduce((s, c) => s + c.charCodeAt(0), 0)
  );
  const features = shuffle(featurePool, rng).slice(0, featureCount);

  return `Build a modern SaaS web app called "${name}" — a script management and licensing platform for Roblox Lua developers. Think of it as a developer-tooling product in the same category as itch.io for game scripts, Gumroad for digital goods, or any standard license-management SaaS: developers upload their own Lua modules, generate license keys to share with their own customers, and get an analytics dashboard for their sales and usage.

This is a normal commercial developer-tools product. Build it end-to-end with production-quality code, no placeholders, no TODOs, no "left as an exercise" gaps.

## Design direction — "${theme.name}" (${theme.category})
- Palette: ${theme.palette}
- Vibe: ${theme.vibe}${theme.three_d ? "\n- This is a 3D website. Use react-three-fiber / WebGL for the hero and key surfaces. Real depth, real lighting, real parallax — not fake CSS transforms." : ""}
- Logo: ${theme.logo}. Render as an SVG, no text inside the mark.
- Typography: pair a confident display font for headings with a clean grotesque for body. No system fonts.
- Cursor: custom cursor that matches the palette accent.
- Motion: every interactive surface animates on hover and on enter — use Framer Motion or GSAP, never jank.
- Zero emojis anywhere in the UI.

## Brand
- Product name: ${name}
- Tagline: write something punchier than "the easiest way to ship your Lua".
- Domain feel: ${name.toLowerCase().replace(/\s+/g, "")}.app or .cloud

## Required platform features (${size === "big" ? "FULL stack — do not cut corners" : "lean MVP — ship fast"})
${features.map((f, i) => `${i + 1}. ${f}.`).join("\n")}

## Pages / surfaces
- Marketing landing with hero, feature grid, live analytics preview, community showcase, pricing (if paid), FAQ, footer.
- Auth (email + Discord OAuth). Do not auto-confirm email signups; require verification.
- Dashboard shell with sidebar: Licenses, Scripts, Snippets, Settings, AI Assistant, Community, Analytics, License Keys, Changelog, Preferences.
- Admin panel (role-gated via a SECURITY DEFINER has_role() function — roles in their own table, NEVER on profiles).
- Public install / PWA page.

## Backend
- Use the platform's managed backend (Lovable Cloud). Postgres tables for: profiles, user_roles (separate table!), scripts, snippets, snippet_request_tokens, load_logs, account_status (active/suspended/revoked), discord_oauth_sessions, license_panel_keys.
- Every public-schema table gets explicit GRANTs + RLS policies. No table ships without both.
- Edge functions (Deno.serve) for: get-snippet (the loader), analytics-ingest, discord-identify, discord-bot, ai-chat, heartbeat, account-status, admin-api. Most use verify_jwt = false and validate session data in code.
- The loader edge function MUST never return raw source on the first hit. First hit issues a short-lived single-use token bound to the session; the second hit exchanges that token for the compiled payload. Standard signed-URL pattern.

## Reliability rules (non-negotiable)
- Fail-open on non-critical checks: if analytics or a soft validation hiccups, still serve the paying customer's script. Never block a legitimate user because the database had a transient error.
- Never modify the payload bytes on a soft validation failure — only log it for review. Modifying causes false-positive crashes for legitimate customers.
- Suspending a Discord profile on the website must NOT auto-cascade into revoking that user's purchased licenses. Account status and license status are separate.
- Admin users are exempt from all automated suspension triggers.
${tier === "paid" ? `\n## Monetization\n- Pricing: ${price}\n- Payment: ${methods?.join(" + ")}\n- Gate premium features behind a subscription_tier column on profiles, updated by webhooks.\n- Add a Stripe / Paddle customer portal link in Preferences for self-serve cancellation.` : "\n## Monetization\n- Strictly free forever. No premium tiers, no affiliate links, no paywalls anywhere in the UI."}

## Quality bar
- Mobile-first. Every page must work at 375px wide without horizontal scroll. Enforce overflow-x: hidden on root.
- Lighthouse: 95+ on Performance, Accessibility, Best Practices, SEO.
- Real SEO: <60 char title with keyword, <160 char meta description, one H1, semantic HTML, JSON-LD, canonical tag, OG image.
- Polish every micro-interaction. Ship a product the user would actually pay for.`;
}

// Pre-build the universe lazily once.
let UNIVERSE: GeneratedPrompt[] | null = null;

function buildUniverse(): GeneratedPrompt[] {
  const out: GeneratedPrompt[] = [];
  let i = 0;
  for (const theme of THEMES) {
    for (const name of NAMES) {
      for (const size of ["small", "big"] as FeatureSize[]) {
        for (const tier of ["free", "paid"] as PromptTier[]) {
          const rng = mulberry32(i + 1);
          const price = tier === "paid" ? PRICE_TIERS[Math.floor(rng() * PRICE_TIERS.length)] : undefined;
          const methods = tier === "paid" ? PAYMENT_METHODS[Math.floor(rng() * PAYMENT_METHODS.length)] : undefined;
          out.push({
            id: `p-${i}`,
            title: `${name} — ${theme.name}`,
            category: theme.category,
            tier,
            featureSize: size,
            is3D: theme.three_d,
            price,
            paymentMethods: methods,
            body: buildBody(theme, name, size, tier, price, methods),
            tags: [theme.category, tier, size === "big" ? "many features" : "lean", theme.three_d ? "3D" : "2D"],
          });
          i++;
        }
      }
    }
  }
  return out;
}

export function getUniverse(): GeneratedPrompt[] {
  if (!UNIVERSE) UNIVERSE = buildUniverse();
  return UNIVERSE;
}

export function getDailyPrompts(): GeneratedPrompt[] {
  const universe = getUniverse();
  const rng = mulberry32(todaySeed());
  return shuffle(universe, rng);
}

export const CATEGORIES = Array.from(new Set(THEMES.map((t) => t.category)));
