// Massive prompt generator for "build me a SaaS" prompts.
// Every generated prompt is one of three honest, AI-buildable product shapes:
//   1) License-key SaaS for Lua modules (plaintext upload, key issuance, place-ID allowlist)
//   2) General digital-goods license platform (Gumroad-style, any file type)
//   3) Lua minifier SaaS (whitespace/comment strip + identifier shortening; source viewable by buyer)
//
// Thousands of variants come from combining product shape x theme x name x size x tier.

export type PromptTier = "free" | "paid";
export type FeatureSize = "small" | "big";
export type ProductShape = "lua-license" | "digital-goods" | "lua-minifier";

export interface GeneratedPrompt {
  id: string;
  title: string;
  category: string;
  tier: PromptTier;
  featureSize: FeatureSize;
  is3D: boolean;
  price?: string;
  paymentMethods?: string[];
  body: string;
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
  { name: "Terminal Hacker", category: "Hacker / Mono", palette: "phosphor green #00ff66, console black #0b0f0d", vibe: "monospace everywhere, blinking cursor, CRT scanline overlay, ASCII art header", logo: "an ASCII art mark", three_d: false },
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
  "Keystone","Licenseroom","Vendcraft","Modulekit","Shipline","Stockpile","Ledgerly","Paperboat",
  "Catalogue","Storefly","Tinybazaar","Indievault","Hatchsell","Quickstand","Modulemart","Goodstream",
  "Vendora","Pricelane","Sellforge","Distrokit","Modulehub","Skuhaus","Marketloop","Tradepost",
  "Bundlebar","Cratemark","Shipscript","Modulekey","Sourcepost","Crafted","Saltbox","Tinytap",
  "Codeshelf","Devmarket","Modline","Indiekit","Pricelet","Vendline","Storehaus","Modkit",
  "Slimline","Trimsource","Tidylua","Compactly","Pricepoint","Modulestore","Saletide","Goodsline",
];

// Generic, AI-safe small-feature pool (no obfuscation / no anti-analysis language).
const SMALL_FEATURES = [
  "email + Google OAuth authentication with required email verification",
  "license-key generation with one-click copy and per-key revocation",
  "a buyer dashboard listing all purchased products with re-download links",
  "a seller dashboard with total revenue, active licenses, and last 30 days of sales",
  "webhook notifications to a developer-supplied URL when a license is issued or revoked",
  "CSV export of licenses, customers, and sales",
  "self-serve license regeneration for the buyer if they lose their key",
  "per-product custom thank-you page and post-purchase instructions",
  "transactional emails (purchase receipt, license delivery, refund)",
  "a public product page per item with screenshots, description, changelog, and price",
  "basic per-account API rate limiting (60 req/min) to keep costs predictable",
  "soft-delete for products so removing one does not break existing buyer downloads",
  "a 'Files' tab where the buyer can re-download every version they have access to",
  "Markdown-rendered product descriptions and a public changelog feed",
  "a minimal admin panel: users, products, sales, refunds",
];

const BIG_FEATURES = [
  "subscription billing (monthly + yearly) with proration, customer portal, and dunning emails on failed cards",
  "team seats: a single subscription can invite N teammates, each with their own login and audit trail",
  "role-based access control with a separate user_roles table and a has_role() SECURITY DEFINER function",
  "version history per product: every upload is versioned, buyers can pick any version, defaults to latest",
  "a public REST API for sellers (list products, list sales, issue license, revoke license) with bearer tokens",
  "Stripe + Paddle as interchangeable billing backends, with webhook-driven subscription_tier sync",
  "tax handling via Stripe Tax / Paddle MoR so the seller does not have to register in each jurisdiction",
  "refund flow that auto-revokes the matching license and emails the buyer",
  "coupon and promo-code engine with per-coupon limits, expiry dates, and first-time-buyer rules",
  "affiliate / referral program with per-seller payout dashboards",
  "fully responsive admin dashboard with specialized tabs (Users, Products, Sales, Refunds, Coupons, Logs)",
  "analytics dashboard with daily revenue chart, MRR, churn, top products, and conversion funnel",
  "Discord OAuth login as an additional sign-in option (alongside email + Google)",
  "a public seller storefront page (gumroad.com/yourname style) with branding controls",
  "real-time sale notifications to the seller's Discord via webhook",
  "a 'Files' tab on the buyer dashboard with auto-saved download history and copy buttons",
  "an AI assistant tab (via Lovable AI gateway) that helps sellers write product descriptions and changelogs",
  "performance hardening: 15s DB query timeout, fire-and-forget analytics writes, indexed sales/license tables",
  "Postgres edge functions written in Deno.serve for: issue-license, validate-license, stripe-webhook, paddle-webhook, ai-assist",
  "full RLS on every public-schema table, with explicit GRANTs for anon / authenticated / service_role",
  "buyer-facing review and rating system with seller reply",
  "a community / showcase tab listing public products with category filters",
  "a public status page with uptime, recent incidents, and a 'subscribe to updates' email box",
  "white-label custom domain support per seller (CNAME -> storefront)",
];

// Minifier-specific feature pools (Lua minifier shape only)
const MIN_SMALL = [
  "paste-in or upload .lua file, click 'minify', download the result",
  "side-by-side before/after view with original and minified size + percent saved",
  "whitespace and comment stripping with a 'preserve license header' toggle",
  "identifier shortening for local variables only (globals untouched)",
  "per-account history of the last 20 minify jobs (re-download anytime)",
  "shareable read-only link for the buyer to view the minified source",
];

const MIN_BIG = [
  "batch minify: drag-and-drop a folder of .lua files, get a zip back",
  "per-file diff view (Monaco editor) showing original vs minified line-by-line",
  "a public REST API: POST /minify with the source, returns the minified source",
  "GitHub Action / CLI snippet generator so the user can run the minifier in CI",
  "team workspace with shared minify history and role-based access (admin / member)",
  "Stripe-backed Pro tier: unlimited files, batch mode, API access",
  "configurable rules per project: keep comments matching /^--!/, preserve specific identifiers, max line length",
  "version history for every minified output, with one-click rollback",
];

const PAYMENT_METHODS = [
  ["Stripe (cards, Apple Pay, Google Pay)", "Stripe Customer Portal for self-serve cancellation"],
  ["Paddle (Merchant of Record, global tax handled)", "Paddle webhook-driven role sync"],
  ["Stripe Checkout with subscription tiers (monthly + yearly)", "promo codes + free trial"],
  ["PayPal one-time", "Stripe recurring"],
];

const PRICE_TIERS = [
  "$4.99/mo Basic, $9.99/mo Pro, $19.99/mo Elite",
  "$7/mo or $59/yr (single tier, lifetime upgrade available)",
  "$2.99/mo Starter, $14.99/mo Studio (team)",
  "$9.99/mo, $24.99/mo (with team seats), $99 lifetime",
  "Free tier + $4.99/mo Pro + $39.99 lifetime",
];

const SHAPES: ProductShape[] = ["lua-license", "digital-goods", "lua-minifier"];

function shapeBlurb(shape: ProductShape, name: string): string {
  switch (shape) {
    case "lua-license":
      return `Build a modern SaaS web app called "${name}" — a license-key platform for Lua module developers. Developers upload their own Lua source files (plaintext, exactly as they wrote them), generate license keys to share with their own customers, and get an analytics dashboard for their sales and usage. When a buyer's app fetches the module with a valid key, the server returns the source code exactly as the developer uploaded it — no transformation, no obfuscation, no anti-analysis layer. Optional per-product allowlist of Roblox place IDs so a developer can scope distribution to specific games they own. Think Gumroad, but specialized for Lua modules.`;
    case "digital-goods":
      return `Build a modern SaaS web app called "${name}" — a general-purpose digital-goods license platform in the style of Gumroad / Lemon Squeezy. Sellers upload any kind of digital file (PDFs, zips, images, audio, video, source code, design assets, fonts, anything), set a price, and get a public product page plus a buyer dashboard for downloads and license keys. Buyers pay once or subscribe, get an email with their license + download link, and can re-download anytime from their account.`;
    case "lua-minifier":
      return `Build a modern SaaS web app called "${name}" — a hosted Lua minifier. Paste in (or upload) Lua source, hit minify, and get back a smaller version with whitespace and comments stripped and local-only identifier shortening. The minified source is fully readable, fully editable, and the buyer can download it as plain .lua. No control-flow rewriting, no encryption, no loader. Just a clean minifier-as-a-service with accounts, history, and an optional API.`;
  }
}

function shapeCategory(shape: ProductShape): string {
  switch (shape) {
    case "lua-license": return "Lua License SaaS";
    case "digital-goods": return "Digital Goods Marketplace";
    case "lua-minifier": return "Lua Minifier SaaS";
  }
}

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

function buildBody(
  shape: ProductShape,
  theme: typeof THEMES[number],
  name: string,
  size: FeatureSize,
  tier: PromptTier,
  price?: string,
  methods?: string[],
) {
  const isMin = shape === "lua-minifier";
  const pool = isMin
    ? (size === "big" ? [...MIN_BIG, ...BIG_FEATURES] : [...MIN_SMALL, ...SMALL_FEATURES])
    : (size === "big" ? BIG_FEATURES : SMALL_FEATURES);
  const featureCount = size === "big" ? 8 : 5;
  const rng = mulberry32(
    [...name].reduce((s, c) => s + c.charCodeAt(0), 0) +
      [...theme.name].reduce((s, c) => s + c.charCodeAt(0), 0) +
      shape.length * 17,
  );
  const features = shuffle(pool, rng).slice(0, featureCount);

  return `Design and build the website "${name}" in the "${theme.name}" style. This is a pure website design brief — focus everything on look, feel, layout and motion. Production-quality code, no placeholders, no TODOs.

## Design direction — "${theme.name}" (${theme.category})
- Overall layout & composition style: Wix-style — big confident hero, generous whitespace, oversized rounded cards (1.25rem+ radius), soft layered drop shadows, sticky floating navigation, full-bleed image/section blocks alternating with content, large pill-shaped CTAs, smooth scroll-triggered reveals between sections. The page should feel like a polished Wix Studio template, not a developer dashboard.
- Palette: ${theme.palette}
- Vibe: ${theme.vibe}${theme.three_d ? "\n- This is a 3D website. Use react-three-fiber / WebGL for the hero and key surfaces. Real depth, real lighting, real parallax — not fake CSS transforms." : ""}
- Logo: ${theme.logo}. Render as an SVG, no text inside the mark.
- Typography: pair a confident display font for headings (large, tight tracking) with a clean grotesque for body. No system fonts.
- Cursor: custom cursor that matches the palette accent.
- Motion: every interactive surface animates on hover and on enter — use Framer Motion or GSAP, never jank. Add subtle parallax on scroll like Wix templates do.
- Zero emojis anywhere in the UI.

## Brand
- Product name: ${name}
- Tagline: write something punchier than "ship your work, get paid".
- Domain feel: ${name.toLowerCase().replace(/\s+/g, "")}.app or .cloud

## Required platform features (${size === "big" ? "FULL stack — do not cut corners" : "lean MVP — ship fast"})
${features.map((f, i) => `${i + 1}. ${f}.`).join("\n")}

## Pages / surfaces
- Marketing landing with hero, feature grid, social proof, pricing (if paid), FAQ, footer.
- Auth (email + Google OAuth, plus Discord as a secondary option). Do not auto-confirm email signups; require verification.
- Buyer dashboard: Library / Downloads, License Keys, Receipts, Settings.
- Seller dashboard: Products, Sales, Customers, Coupons, Analytics, Settings.
- Admin panel (role-gated via a SECURITY DEFINER has_role() function — roles in their own table, NEVER on profiles).
- Public product / storefront pages, plus a /install PWA page.

## Backend
- Use the platform's managed backend (Lovable Cloud / Postgres). Tables for: profiles, user_roles (separate table!), products, product_versions, files, licenses, sales, refunds, coupons, webhooks_log, audit_log.
- Every public-schema table gets explicit GRANTs + RLS policies in the same migration. No table ships without both.
- Edge functions (Deno.serve) for: issue-license, validate-license, download-file (returns a signed time-limited URL), stripe-webhook, paddle-webhook, ai-assist.
- Standard signed-URL pattern for downloads: the API returns a short-lived signed URL, the client fetches the file directly.

## Reliability rules
- Fail-open on non-critical checks: if analytics or a soft validation hiccups, still serve the paying customer's download. Never block a legitimate buyer because the database had a transient error.
- Admin users are exempt from automated suspension triggers.
- Suspending a user's social login does NOT auto-revoke their purchased licenses. Account status and license status are separate.
${tier === "paid" ? `\n## Monetization\n- Pricing: ${price}\n- Payment: ${methods?.join(" + ")}\n- Gate premium features behind a subscription_tier column on profiles, updated by Stripe / Paddle webhooks.\n- Add a Stripe / Paddle customer portal link in Settings for self-serve cancellation.` : "\n## Monetization\n- Strictly free forever. No premium tiers, no affiliate links, no paywalls anywhere in the UI."}

## Quality bar
- Mobile-first. Every page must work at 375px wide without horizontal scroll. Enforce overflow-x: hidden on root.
- Lighthouse: 95+ on Performance, Accessibility, Best Practices, SEO.
- Real SEO: <60 char title with keyword, <160 char meta description, one H1, semantic HTML, JSON-LD, canonical tag, OG image.
- Polish every micro-interaction. Ship a product the user would actually pay for.`;
}

let UNIVERSE: GeneratedPrompt[] | null = null;

function buildUniverse(): GeneratedPrompt[] {
  const out: GeneratedPrompt[] = [];
  let i = 0;
  for (const shape of SHAPES) {
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
              category: shapeCategory(shape),
              tier,
              featureSize: size,
              is3D: theme.three_d,
              price,
              paymentMethods: methods,
              body: buildBody(shape, theme, name, size, tier, price, methods),
              tags: [shapeCategory(shape), theme.category, tier, size === "big" ? "many features" : "lean", theme.three_d ? "3D" : "2D"],
            });
            i++;
          }
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

export const CATEGORIES = Array.from(new Set([
  ...SHAPES.map(shapeCategory),
  ...THEMES.map((t) => t.category),
]));
