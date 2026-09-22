import { createClient } from 'npm:@supabase/supabase-js@2';

// MODULE-LEVEL Supabase client — reused across requests in the same isolate
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

// Hardcoded ban lists removed — all bans are managed via the global_bans DB table

// In-memory cache of DB global bans (refreshed every 60s)
let globalBanCache: { ips: Set<string>; subnets: string[]; robloxIds: Set<string>; discordIds: Set<string>; hwids: Set<string>; lastRefresh: number } = {
  ips: new Set(), subnets: [], robloxIds: new Set(), discordIds: new Set(), hwids: new Set(), lastRefresh: 0
};

async function refreshGlobalBans() {
  if (Date.now() - globalBanCache.lastRefresh < 60_000) return; // Cache for 60s
  try {
    const { data } = await supabase.from('global_bans').select('ban_type, ban_value').eq('is_active', true);
    const ips = new Set<string>();
    const subnets: string[] = [];
    const robloxIds = new Set<string>();
    const discordIds = new Set<string>();
    const hwids = new Set<string>();
    for (const ban of data || []) {
      if (ban.ban_type === 'ip') ips.add(ban.ban_value);
      else if (ban.ban_type === 'subnet') subnets.push(ban.ban_value);
      else if (ban.ban_type === 'roblox_id') robloxIds.add(ban.ban_value);
      else if (ban.ban_type === 'discord_id') discordIds.add(ban.ban_value);
      else if (ban.ban_type === 'hwid') hwids.add(ban.ban_value);
    }
    globalBanCache = { ips, subnets, robloxIds, discordIds, hwids, lastRefresh: Date.now() };
    // Also refresh admin IPs so they're never banned
    await refreshAdminIps();
  } catch (e) {
    console.error('Failed to refresh global bans:', e);
  }
}

function isPermanentlyBanned(ip: string): boolean {
  // Check DB global bans cache
  if (globalBanCache.ips.has(ip)) return true;
  for (const subnet of globalBanCache.subnets) {
    if (ip.startsWith(subnet)) return true;
  }
  return false;
}

function isRobloxIdBanned(robloxUserId: string): boolean {
  return globalBanCache.robloxIds.has(robloxUserId);
}

function isDiscordIdBanned(discordUserId: string): boolean {
  return globalBanCache.discordIds.has(discordUserId);
}

// v16: device-level (HWID) ban — blocks the machine, not just the account
function isHwidBanned(hwid: string | null): boolean {
  if (!hwid || hwid.length < 4) return false;
  return globalBanCache.hwids.has(hwid);
}


// Log threat to DB (fire-and-forget)
function logThreat(type: string, ip: string | null, robloxId: string | null, discordId: string | null, details: any, severity: string, autoResolve = false) {
  supabase.from('threat_log').insert({
    threat_type: type, source_ip: ip, roblox_user_id: robloxId,
    discord_user_id: discordId, details, severity,
    resolved: autoResolve, auto_banned: autoResolve,
  }).then(() => {}, (e: any) => console.error('Threat log failed:', e));
}

// ===== AUTO-BAN: When a globally banned user connects from a new IP, ban that IP too =====
// In-memory set to avoid duplicate insert attempts within same isolate
const autoBannedIpsThisSession = new Set<string>();

// In-memory admin IP whitelist (refreshed with global bans)
let adminIpWhitelist = new Set<string>();

async function refreshAdminIps() {
  try {
    const { data } = await supabase
      .from('user_ips')
      .select('ip_address, user_id')
      .in('user_id', 
        (await supabase.from('user_roles').select('user_id').eq('role', 'admin')).data?.map(r => r.user_id) || []
      );
    adminIpWhitelist = new Set((data || []).map(d => d.ip_address));
  } catch (e) {
    console.error('Failed to refresh admin IPs:', e);
  }
}

function isAdminIp(ip: string): boolean {
  return adminIpWhitelist.has(ip);
}

function autoBanNewIp(ip: string, reason: string, robloxId: string | null, discordId: string | null) {
  if (!ip || ip === 'unknown') return;
  // NEVER ban admin IPs
  if (isAdminIp(ip)) {
    console.log(`[AUTO-BAN] SKIPPED: ${ip} is an admin IP`);
    return;
  }
  // Already in cache or already auto-banned this session? Skip.
  if (globalBanCache.ips.has(ip) || autoBannedIpsThisSession.has(ip)) return;
  // Check subnets too
  for (const subnet of globalBanCache.subnets) {
    if (ip.startsWith(subnet)) return; // Already covered by subnet ban
  }
  
  autoBannedIpsThisSession.add(ip);
  // Add to in-memory cache immediately so it's blocked for subsequent requests
  globalBanCache.ips.add(ip);
  
  const banReason = `Auto-banned: ${reason}${robloxId ? ` (roblox:${robloxId})` : ''}${discordId ? ` (discord:${discordId})` : ''}`;
  
  // Insert into DB (fire-and-forget, upsert to avoid conflicts)
  supabase.from('global_bans').upsert({
    ban_type: 'ip',
    ban_value: ip,
    reason: banReason,
    is_active: true,
  }, { onConflict: 'ban_type,ban_value' })
    .then(() => console.log(`[AUTO-BAN] IP ${ip} banned: ${banReason}`))
.then(undefined, (e: any) => console.error('Auto-ban insert failed:', e));
  
  // Log threat
  logThreat('auto_ban_vpn_ip', ip, robloxId, discordId, { 
    action: 'new_ip_auto_banned', 
    reason: banReason 
  }, 'high', true);
}

// ===== v17: UNIFIED PERMANENT BAN ENGINE =====
// One entry point for every auto-ban path. Bans EVERY identifier tied to the
// offender (ip, roblox id, discord id, device/hwid) permanently, expands to
// every linked identity we have ever seen, and stores full evidence.
type BanIdentity = {
  ip?: string | null;
  robloxId?: string | null;
  discordId?: string | null;
  hwid?: string | null;
};

const bannedIdentifiersThisSession = new Set<string>();

function isValidRobloxId(id: string | null | undefined): id is string {
  return !!id && /^\d+$/.test(id) && parseInt(id) > 1000;
}

async function writeBan(
  banType: 'ip' | 'roblox_id' | 'discord_id' | 'hwid',
  value: string,
  reason: string,
  metadata: Record<string, unknown>,
) {
  const cacheKey = `${banType}:${value}`;
  if (bannedIdentifiersThisSession.has(cacheKey)) return false;
  bannedIdentifiersThisSession.add(cacheKey);

  // Update in-memory cache instantly so the very next request is blocked
  if (banType === 'ip') globalBanCache.ips.add(value);
  else if (banType === 'roblox_id') globalBanCache.robloxIds.add(value);
  else if (banType === 'discord_id') globalBanCache.discordIds.add(value);
  else if (banType === 'hwid') globalBanCache.hwids.add(value);

  try {
    await supabase.from('global_bans').upsert({
      ban_type: banType,
      ban_value: value,
      reason,
      is_active: true,
      metadata,
    }, { onConflict: 'ban_type,ban_value' });
    return true;
  } catch (e) {
    console.error(`[BAN-ENGINE] failed to persist ${cacheKey}:`, e);
    return false;
  }
}

/**
 * Permanently ban an offender across every identifier we can link to them.
 * ruleId  — stable machine-readable rule name (e.g. "exfil_webhook")
 * evidence — raw signal payload preserved for review (never trimmed away)
 */
async function banIdentity(
  identity: BanIdentity,
  ruleId: string,
  evidence: Record<string, unknown>,
): Promise<{ banned: string[] }> {
  const banned: string[] = [];
  const seedIp = identity.ip && identity.ip !== 'unknown' ? identity.ip : null;
  const seedRoblox = isValidRobloxId(identity.robloxId) ? identity.robloxId : null;
  const seedDiscord = identity.discordId || null;
  const seedHwid = identity.hwid && identity.hwid.length >= 4 ? identity.hwid : null;

  const reason = `Permanent ban [${ruleId}]`;
  const baseMeta = {
    rule_id: ruleId,
    permanent: true,
    banned_at: new Date().toISOString(),
    seed: { ip: seedIp, roblox_id: seedRoblox, discord_id: seedDiscord, hwid: seedHwid },
    evidence,
  };

  const ips = new Set<string>();
  const robloxIds = new Set<string>();
  const discordIds = new Set<string>();
  const hwids = new Set<string>();
  if (seedIp) ips.add(seedIp);
  if (seedRoblox) robloxIds.add(seedRoblox);
  if (seedDiscord) discordIds.add(seedDiscord);
  if (seedHwid) hwids.add(seedHwid);

  // ---- Identity expansion: everything this offender has ever been seen as ----
  try {
    const orFilters: string[] = [];
    if (seedRoblox) orFilters.push(`roblox_user_id.eq.${seedRoblox}`);
    if (seedDiscord) orFilters.push(`discord_user_id.eq.${seedDiscord}`);
    if (seedIp) orFilters.push(`ip_address.eq.${seedIp}`);
    if (orFilters.length) {
      const { data: linked } = await supabase
        .from('paste_access_logs')
        .select('ip_address, roblox_user_id, discord_user_id')
        .or(orFilters.join(','))
        .limit(500);
      for (const row of linked || []) {
        if (row.ip_address) ips.add(row.ip_address);
        if (isValidRobloxId(row.roblox_user_id)) robloxIds.add(row.roblox_user_id);
        if (row.discord_user_id) discordIds.add(row.discord_user_id);
      }
    }

    // Device linkage — the machine and every account that ever used it
    const hwidFilters: string[] = [];
    if (seedHwid) hwidFilters.push(`hwid.eq.${seedHwid}`);
    for (const rid of robloxIds) hwidFilters.push(`roblox_user_id.eq.${rid}`);
    if (hwidFilters.length) {
      const { data: locks } = await supabase
        .from('paste_hwid_locks')
        .select('hwid, roblox_user_id')
        .or(hwidFilters.slice(0, 40).join(','))
        .limit(500);
      for (const row of locks || []) {
        if (row.hwid && row.hwid.length >= 4) hwids.add(row.hwid);
        if (isValidRobloxId(row.roblox_user_id)) robloxIds.add(row.roblox_user_id);
      }
    }
  } catch (e) {
    console.error('[BAN-ENGINE] identity expansion failed (banning seeds only):', e);
  }

  // ---- Apply the bans ----
  for (const ip of ips) {
    if (await writeBan('ip', ip, reason, { ...baseMeta, linked_via: ip === seedIp ? 'seed' : 'identity_graph' })) {
      autoBannedIpsThisSession.add(ip);
      banned.push(`ip:${ip}`);
    }
  }
  for (const rid of robloxIds) {
    if (await writeBan('roblox_id', rid, reason, { ...baseMeta, linked_via: rid === seedRoblox ? 'seed' : 'identity_graph' })) {
      banned.push(`roblox_id:${rid}`);
    }
  }
  for (const did of discordIds) {
    if (await writeBan('discord_id', did, reason, { ...baseMeta, linked_via: did === seedDiscord ? 'seed' : 'identity_graph' })) {
      banned.push(`discord_id:${did}`);
    }
  }
  for (const h of hwids) {
    if (await writeBan('hwid', h, reason, { ...baseMeta, linked_via: h === seedHwid ? 'seed' : 'identity_graph' })) {
      banned.push(`hwid:${h}`);
    }
  }

  logThreat(`ban_engine_${ruleId}`, seedIp, seedRoblox, seedDiscord, {
    rule_id: ruleId,
    evidence,
    identifiers_banned: banned,
    counts: { ips: ips.size, roblox: robloxIds.size, discord: discordIds.size, hwids: hwids.size },
  }, 'critical', true);

  console.log(`[BAN-ENGINE] ${ruleId} -> ${banned.length} identifiers banned`);
  return { banned };
}



// Enhanced rate limiting with IP tracking (persists within isolate lifetime)
const rateLimits = new Map<string, { count: number; resetTime: number; blocked: boolean }>();
const suspiciousIps = new Map<string, { strikes: number; lastStrike: number }>();
// v9: Session trust scores - tracks behavioral scoring per IP
const trustScores = new Map<string, { score: number; lastUpdate: number; requestTimes: number[] }>();

// v10.4: Track IP mismatch attempts — only ban after repeated mismatches (prevents false bans on VPN/mobile users)
const ipMismatchTracker = new Map<string, { count: number; firstSeen: number }>();
const IP_MISMATCH_BAN_THRESHOLD = 3; // 3 mismatches within window = ban
const IP_MISMATCH_WINDOW = 10 * 60 * 1000; // 10 minute window

function shouldBanForIpMismatch(ip: string): boolean {
  if (!ip || ip === 'unknown') return false;
  if (isAdminIp(ip)) return false;
  const now = Date.now();
  const entry = ipMismatchTracker.get(ip);
  if (!entry || (now - entry.firstSeen > IP_MISMATCH_WINDOW)) {
    ipMismatchTracker.set(ip, { count: 1, firstSeen: now });
    return false;
  }
  entry.count++;
  return entry.count >= IP_MISMATCH_BAN_THRESHOLD;
}

// Per-IP-per-slug throttle: max 3 requests per 30 seconds for the same slug from same IP
const slugThrottle = new Map<string, { count: number; resetTime: number }>();
const SLUG_THROTTLE_MAX = 8;
const SLUG_THROTTLE_WINDOW = 30_000; // 30 seconds

// Global request counter to shed load when overwhelmed
let globalRequestCount = 0;
let globalResetTime = Date.now() + 10_000;
const GLOBAL_MAX_RPS = 50; // max 50 requests per 10 seconds across ALL IPs

// Response cache — cache paste lookups to avoid hammering DB
const pasteCache = new Map<string, { data: any; timestamp: number }>();
const PASTE_CACHE_TTL = 30_000; // 30 seconds (increased from 10s)

function getCachedPaste(slug: string): any | null {
  const cached = pasteCache.get(slug);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > PASTE_CACHE_TTL) {
    pasteCache.delete(slug);
    return null;
  }
  return cached.data;
}

function setCachedPaste(slug: string, data: any) {
  // Keep cache small
  if (pasteCache.size > 100) {
    const oldest = pasteCache.keys().next().value;
    if (oldest) pasteCache.delete(oldest);
  }
  pasteCache.set(slug, { data, timestamp: Date.now() });
}

// ===== ANTI-FETCH PROTECTION =====
const BLOCKED_USER_AGENTS = [
  'discordbot', 'discord.js', 'discord-http', 'discord', 'eris', 'oceanic',
  'axios', 'node-fetch', 'got', 'undici', 'needle', 'superagent',
  'httpie', 'curl', 'wget', 'python-requests', 'python-urllib', 'aiohttp',
  'httpx', 'libcurl', 'php', 'perl', 'ruby', 'java/', 'apache-httpclient',
  'okhttp', 'retrofit', 'unirest', 'restsharp', 'flurl',
  'puppeteer', 'playwright', 'selenium', 'phantomjs', 'headless',
  'crawler', 'spider', 'scraper',
  'postman', 'insomnia', 'thunder client', 'hoppscotch', 'paw/',
  'luajit', 'resty', 'openresty',
  // Additional bot frameworks
  'd.js', 'oceanic.js', 'discordeno', 'harmony', 'droff',
  'sapphire', 'klasa', 'commando', 'akairo',
  'revolt.js', 'guilded.js',
  'fetch/', 'http-client', 'rest-client',
  'bot/', 'spider/', 'scrape',
];

const SUSPICIOUS_UA_PATTERNS = [
  /^$/,
  /^\s*$/,
  /^[a-z]+\/\d+\.\d+$/i,
  /python/i,
  /java/i,
  /perl/i,
  /ruby/i,
  /php/i,
  /go-http/i,
  /libwww/i,
  /httpunit/i,
  /nutch/i,
  /httrack/i,
  /larbin/i,
  /webcopier/i,
  /teleport/i,
  /voideye/i,
  /collector/i,
  /linkextractor/i,
  /website-quester/i,
];

const DISCORD_BOT_PATTERNS = [
  /discord/i,
  /deno\//i,
  /bun\//i,
  /node\//i,
  /cloudflare-workers/i,
  // Catch common bot library UAs
  /^undici\//i,
  /^got\//i,
  /^axios\//i,
  /^node-fetch/i,
];

// Known Discord/bot hosting datacenter IP ranges (common prefixes)
const BOT_HOSTING_INDICATORS = [
  // Headers that indicate a proxied/bot request
  'cf-worker', 'x-discord', 'x-bot', 'x-automation',
];

const KNOWN_EXECUTOR_UA_PATTERNS = [
  /^Delta (?:iOS|Android)\/[\w.-]+$/i,
  /^Delta\/[\w.-]+$/i,
  /^Xeno\/[\w.-]+$/i,
  /^Solara\/[\w.-]+$/i,
  /^Krnl\/[\w.-]+$/i,
  /^Fluxus\/[\w.-]+$/i,
  /^Evon\/[\w.-]+$/i,
  /^Codex\/[\w.-]+$/i,
  /^Hydrogen\/[\w.-]+$/i,
  /^Arceus(?:\s+X)?\/[\w.-]+$/i,
  /^Electron\/[\w.-]+$/i,
];

function isKnownExecutorUserAgent(ua: string): boolean {
  const normalizedUa = ua.trim();
  if (!normalizedUa) return false;
  return KNOWN_EXECUTOR_UA_PATTERNS.some((pattern) => pattern.test(normalizedUa));
}

function isRobloxLikeUserAgent(ua: string): boolean {
  if (!ua) return false;
  const uaLower = ua.toLowerCase();
  return isKnownExecutorUserAgent(ua) ||
         uaLower.includes('roblox') ||
         ua.includes('HttpService') ||
         ua.includes('WinInet') ||
         ua.includes('RobloxApp') ||
         /^Mozilla\/5\.0 \(\d+MB;/.test(ua);
}

function isLikelyBrowserRequest(headers: Headers): boolean {
  const ua = headers.get('user-agent') || '';
  const accept = headers.get('accept') || '';
  const secFetchMode = headers.get('sec-fetch-mode') || '';
  const secFetchDest = headers.get('sec-fetch-dest') || '';
  const origin = headers.get('origin') || '';
  const referer = headers.get('referer') || '';

  if (isRobloxLikeUserAgent(ua)) return false;

  return Boolean(secFetchMode) ||
         Boolean(secFetchDest) ||
         accept.includes('text/html') ||
         Boolean(origin) ||
         Boolean(referer) ||
         (/Mozilla\/\d/.test(ua) && /AppleWebKit|Gecko|Chrome|Safari|Firefox|Edge/.test(ua));
}

function isDirectSlugBrowserView(url: URL): boolean {
  const params = Array.from(url.searchParams.keys());
  return params.length > 0 && params.every((key) => key === 'slug');
}

const QUIET_ACCESS_DENIED_LUA = '-- Access denied';
const PROTECTED_BROWSER_PLACEHOLDER = '-- Protected by ULT LUA';

// Mint & peach site theme, inlined so the backend page looks identical to the site.
const PAGE_STYLE = `
:root{--bg:#fbfaf6;--fg:#141f1d;--muted:#5d6b68;--card:rgba(255,255,255,.78);
--border:rgba(20,31,29,.10);--primary:#2c9464;--accent:#ef7429;--danger:#c0392b}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:var(--bg);color:var(--fg);
font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
background-image:radial-gradient(circle at 12% 18%,rgba(44,148,100,.10),transparent 45%),
radial-gradient(circle at 88% 8%,rgba(239,116,41,.10),transparent 45%);
background-attachment:fixed;padding:40px 16px}
.wrap{max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:20px}
.card{background:var(--card);backdrop-filter:blur(18px);border:1px solid var(--border);
border-radius:20px;padding:24px;box-shadow:0 10px 30px rgba(20,31,29,.06)}
h1{margin:6px 0 8px;font-size:28px}h2{margin:0 0 6px;font-size:18px}
h3{margin:0 0 6px;font-size:14px}p{margin:0;color:var(--muted);font-size:14px;line-height:1.55}
.pill{display:inline-block;font-size:10px;letter-spacing:.12em;text-transform:uppercase;
border:1px solid var(--border);border-radius:999px;padding:4px 10px;color:var(--muted)}
pre{overflow-x:auto;background:rgba(20,31,29,.05);border:1px solid var(--border);
border-radius:14px;padding:16px;margin:16px 0;font-size:13px;white-space:pre-wrap;word-break:break-all}
button,a.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;
border:0;border-radius:12px;padding:12px 16px;font-size:14px;font-weight:600;cursor:pointer;
background:var(--primary);color:#fff;text-decoration:none}
a.ghost{background:transparent;color:var(--fg);border:1px solid var(--border)}
.grid{display:grid;gap:12px;grid-template-columns:1fr}
@media(min-width:640px){.grid{grid-template-columns:1fr 1fr}}
.tile{border:1px solid var(--border);border-radius:14px;padding:14px;background:rgba(255,255,255,.5)}
.tile h3{color:var(--primary)}
.ban h1{color:var(--danger)}
`;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

/** Host the visitor actually used, when it is not the raw delivery host. */
function resolvePublicHost(req: Request, url: URL): string | null {
  const forwarded = (req.headers.get('x-forwarded-host') || '').toLowerCase().split(',')[0].trim();
  if (!forwarded || !/^[a-z0-9.-]+(?::\d+)?$/.test(forwarded)) return null;
  if (forwarded === url.host.toLowerCase()) return null;
  if (forwarded.endsWith('.supabase.co') || forwarded.endsWith('.supabase.in')) return null;
  return forwarded;
}

function generateBrandedLoaderPage(slug: string, host: string): string {
  const site = `https://${host}`;

  const loadstring = `loadstring(game:HttpGet("${site}/s/${slug}"))()`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Protected script loader | ULT LUA</title>
<meta name="description" content="Official loadstring for this protected script.">
<style>${PAGE_STYLE}</style></head><body><div class="wrap">
<a class="btn ghost" href="/">&larr; Back to homepage</a>
<div class="card"><span class="pill">Protected script</span>
<h1>Loadstring</h1>
<p>This is the official link for this script. Copy it and run it in your executor — nothing else is needed.</p>
<pre id="ls">${escapeHtml(loadstring)}</pre>
<button onclick="navigator.clipboard.writeText(document.getElementById('ls').innerText);this.innerText='Copied'">Copy loadstring</button>
</div>
<div class="card"><h2>Why bypassing this is a bad afternoon</h2>
<p>A short version — the details stay ours.</p><div class="grid" style="margin-top:14px">
<div class="tile"><h3>Nothing is served in plain text</h3><p>Every delivery is encrypted and single-use. What you fetch once is never valid again.</p></div>
<div class="tile"><h3>The request is bound to you</h3><p>Session, device and network fingerprints are tied together before a single line is released.</p></div>
<div class="tile"><h3>Tampering answers back</h3><p>Hooked functions, dumps and relays are recognised on the spot and the session is dropped.</p></div>
<div class="tile"><h3>One strike is permanent</h3><p>Unauthorized entry points are watched. Touch one and every identifier you own is retired for good.</p></div>
</div></div></div></body></html>`;
}

function generatePermanentBanPage(): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Permanently banned | ULT LUA</title>
<style>${PAGE_STYLE}</style></head><body><div class="wrap ban">
<div class="card"><span class="pill">Unauthorized entry point</span>
<h1>You are permanently banned</h1>
<p>You reached an internal endpoint that is not an authorized entry point. Your account, network and
device identifiers have been retired permanently. New accounts, new networks and reset devices do not
change this — every script protected by ULT LUA will refuse to run for you from now on.</p></div>
</div></body></html>`;
}


function shouldAutoBanBypassReason(reason: string, details: string): boolean {
  const normalizedReason = (reason || '').toLowerCase().trim();
  const normalizedDetails = (details || '').toLowerCase().trim();

  // IMPORTANT: use an allowlist, not a denylist.
  // New detector names get added frequently and many of them can false-fire on normal executors.
  // Only auto-ban when we have explicit exfiltration/webhook evidence from the loader itself.
  const exactHardBanReasons = new Set([
    'writefile_exfil',
    'exfil_webhook',
    'http_func_exfil_active',
    'gc_exfil_combo',
  ]);

  if (exactHardBanReasons.has(normalizedReason)) {
    return true;
  }

  const hardBanReasonPrefixes = [
    'exfil_in_hook_',
    'exfil_global_',
  ];

  if (hardBanReasonPrefixes.some((prefix) => normalizedReason.startsWith(prefix))) {
    return true;
  }

  const hardBanDetailSignals = [
    'http_func_exfil_',
    'webhook_url_in_',
    'exfiltration_url_in_upvalue',
    'writefile_upvalue_has_exfil_url',
    'function_with_loadstring_and_webhook_in_gc',
    'exfiltration_function_in_globals',
  ];

  return hardBanDetailSignals.some((signal) => normalizedDetails.includes(signal));
}

function isBlockedUserAgent(ua: string): boolean {
  if (isKnownExecutorUserAgent(ua)) return false;
  const lowerUa = ua.toLowerCase();
  for (const blocked of BLOCKED_USER_AGENTS) {
    if (lowerUa.includes(blocked)) return true;
  }
  for (const pattern of SUSPICIOUS_UA_PATTERNS) {
    if (pattern.test(ua)) return true;
  }
  return false;
}

function isDiscordBotRequest(headers: Headers): boolean {
  const ua = headers.get('user-agent') || '';
  if (isKnownExecutorUserAgent(ua)) return false;
  for (const pattern of DISCORD_BOT_PATTERNS) {
    if (pattern.test(ua)) return true;
  }
  const via = headers.get('via') || '';
  const xForwardedFor = headers.get('x-forwarded-for') || '';
  if (via.toLowerCase().includes('discord') || xForwardedFor.includes('discord')) return true;
  // Check for bot hosting indicators in headers
  for (const indicator of BOT_HOSTING_INDICATORS) {
    if (headers.get(indicator)) return true;
  }
  return false;
}

// Detect if a "Roblox" request is actually a spoofed bot
function isSpookedRobloxRequest(headers: Headers): { spoofed: boolean; reason: string } {
  const ua = headers.get('user-agent') || '';
  const uaLower = ua.toLowerCase();
  
  // Real Roblox requests have specific UA patterns
  const isRobloxUA = uaLower.includes('roblox') || ua.includes('HttpService') || ua.includes('WinInet');
  if (!isRobloxUA) return { spoofed: false, reason: 'not_roblox' };
  
  // IMPORTANT: Most Roblox executors send short UAs — this is NORMAL behavior.
  // Only flag as spoofed if the UA is suspiciously generic AND combined with other signals.
  // Previously we banned ua.length < 30 which caused 196+ false positives.
  
  // Check 1: Only flag if UA is literally just "Roblox" with nothing else (< 8 chars)
  // Real executors at minimum send "Roblox/WinInet" or "RobloxStudio" etc.
  if (ua.trim().toLowerCase() === 'roblox' || ua.length < 8) {
    return { spoofed: true, reason: 'bare_roblox_ua' };
  }
  
  // Check 2: Roblox UA combined with bot-like patterns
  if (uaLower.includes('curl') || uaLower.includes('wget') || uaLower.includes('python') || 
      uaLower.includes('node') || uaLower.includes('deno') || uaLower.includes('bun')) {
    return { spoofed: true, reason: 'roblox_with_bot_ua' };
  }
  
  // Check 3: Real Roblox requests don't have certain headers
  const authorization = headers.get('authorization');
  if (authorization && !authorization.includes('supabase')) {
    return { spoofed: true, reason: 'roblox_with_auth_header' };
  }
  
  // Check 4: Content-Type on GET requests is suspicious
  const contentType = headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return { spoofed: true, reason: 'roblox_with_json_content_type' };
  }
  
  return { spoofed: false, reason: 'legitimate_roblox' };
}

function validateRobloxExecutor(headers: Headers): { valid: boolean; reason: string } {
  const ua = headers.get('user-agent') || '';
  const accept = headers.get('accept') || '';
  const secFetchMode = headers.get('sec-fetch-mode');
  const secFetchDest = headers.get('sec-fetch-dest');
  const secFetchSite = headers.get('sec-fetch-site');
  const secChUa = headers.get('sec-ch-ua');
  const origin = headers.get('origin');
  const referer = headers.get('referer');

  // IMPORTANT: Check for Roblox UA FIRST before any bot detection
  // This prevents legitimate Roblox executor requests from being flagged
  const isRobloxUA = isKnownExecutorUserAgent(ua) ||
                     ua.toLowerCase().includes('roblox') || 
                     ua.includes('HttpService') ||
                     ua.includes('WinInet') ||
                     ua.includes('RobloxApp');

  if (isRobloxUA) {
    // Still check for browser headers on Roblox UAs (spoofed browser pretending to be Roblox)
    if (secFetchMode || secFetchDest || secFetchSite || secChUa) {
      return { valid: false, reason: 'browser_headers' };
    }
    const acceptLanguage = headers.get('accept-language');
    if (acceptLanguage && acceptLanguage.split(',').length > 5) {
      return { valid: false, reason: 'complex_accept_language' };
    }
    return { valid: true, reason: 'roblox_ua' };
  }

  if (secFetchMode || secFetchDest || secFetchSite || secChUa) {
    return { valid: false, reason: 'browser_headers' };
  }
  if (accept.includes('text/html')) return { valid: false, reason: 'html_accept' };
  if (origin || referer) return { valid: false, reason: 'origin_referer' };
  if (isBlockedUserAgent(ua)) return { valid: false, reason: 'blocked_ua' };
  if (isDiscordBotRequest(headers)) return { valid: false, reason: 'discord_bot' };

  if (!ua || ua.length < 5) return { valid: false, reason: 'minimal_ua' };
  return { valid: true, reason: 'executor_client' };
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimits.get(ip);
  const suspicious = suspiciousIps.get(ip);
  if (suspicious && suspicious.strikes >= 3) {
    if (now - suspicious.lastStrike < 3600000) return false;
    suspiciousIps.delete(ip);
  }
  if (!limit || now > limit.resetTime) {
    rateLimits.set(ip, { count: 1, resetTime: now + 60000, blocked: false });
    return true;
  }
  if (limit.count >= 10) { // reduced from 20 to 10 per minute
    const currentStrikes = suspicious?.strikes || 0;
    suspiciousIps.set(ip, { strikes: currentStrikes + 1, lastStrike: now });
    return false;
  }
  limit.count++;
  return true;
}

function checkSlugThrottle(ip: string, slug: string): boolean {
  const key = `${ip}:${slug}`;
  const now = Date.now();
  const entry = slugThrottle.get(key);
  if (!entry || now > entry.resetTime) {
    slugThrottle.set(key, { count: 1, resetTime: now + SLUG_THROTTLE_WINDOW });
    return true;
  }
  if (entry.count >= SLUG_THROTTLE_MAX) return false;
  entry.count++;
  return true;
}

function checkGlobalLoad(): boolean {
  const now = Date.now();
  if (now > globalResetTime) {
    globalRequestCount = 0;
    globalResetTime = now + 10_000;
  }
  globalRequestCount++;
  return globalRequestCount <= GLOBAL_MAX_RPS;
}

// Periodic cleanup of stale maps (every 5 min)
let lastCleanup = Date.now();
function cleanupMaps() {
  const now = Date.now();
  if (now - lastCleanup < 300_000) return;
  lastCleanup = now;
  for (const [k, v] of rateLimits) { if (now > v.resetTime) rateLimits.delete(k); }
  for (const [k, v] of suspiciousIps) { if (now - v.lastStrike > 3600000) suspiciousIps.delete(k); }
  for (const [k, v] of slugThrottle) { if (now > v.resetTime) slugThrottle.delete(k); }
  for (const [k, v] of trustScores) { if (now - v.lastUpdate > 3600000) trustScores.delete(k); }
  for (const [k, v] of pasteCache) { if (now - v.timestamp > PASTE_CACHE_TTL) pasteCache.delete(k); }
  for (const [k, v] of ipMismatchTracker) { if (now - v.firstSeen > IP_MISMATCH_WINDOW) ipMismatchTracker.delete(k); }
}

// v9: Behavioral trust scoring
function getTrustScore(ip: string): number {
  const data = trustScores.get(ip);
  if (!data) return 100; // default trust
  // Decay old scores toward 100
  const ageMs = Date.now() - data.lastUpdate;
  if (ageMs > 3600000) { trustScores.delete(ip); return 100; }
  return data.score;
}

function updateTrustScore(ip: string, delta: number) {
  const now = Date.now();
  const data = trustScores.get(ip) || { score: 100, lastUpdate: now, requestTimes: [] };
  data.score = Math.max(0, Math.min(100, data.score + delta));
  data.lastUpdate = now;
  data.requestTimes.push(now);
  // Keep only last 20 request times
  if (data.requestTimes.length > 20) data.requestTimes = data.requestTimes.slice(-20);
  trustScores.set(ip, data);
}

// v9: Check fetch timing patterns (too fast = suspicious)
function checkFetchTiming(ip: string): boolean {
  const data = trustScores.get(ip);
  if (!data || data.requestTimes.length < 3) return true;
  const times = data.requestTimes.slice(-5);
  const gaps = [];
  for (let i = 1; i < times.length; i++) gaps.push(times[i] - times[i-1]);
  // If all gaps are < 100ms, suspicious (automated)
  const allFast = gaps.every(g => g < 100);
  if (allFast) { updateTrustScore(ip, -20); return false; }
  // If gaps are perfectly uniform (±5ms), suspicious (scripted)
  if (gaps.length >= 3) {
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const allUniform = gaps.every(g => Math.abs(g - avg) < 5);
    if (allUniform) { updateTrustScore(ip, -10); return false; }
  }
  return true;
}

function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

function generateSessionSecret(ip: string, timestamp: number): string {
  const data = `${ip}:${timestamp}:ULT_SESSION_v9`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// v9: Generate server nonce for runtime proof
function generateServerNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

function xorToHex(plain: string, key: string): string {
  const enc = new TextEncoder();
  const data = enc.encode(plain);
  const k = enc.encode(key);
  for (let i = 0; i < data.length; i++) data[i] = data[i] ^ k[i % k.length];
  let hex = '';
  for (let i = 0; i < data.length; i++) hex += data[i].toString(16).padStart(2, '0');
  return hex;
}

// v9: Generate poisoned payload (looks valid but has subtle corruption)
function generatePoisonedPayload(content: string, key: string): string {
  // Insert subtle mutations: flip random characters, swap variables
  const chars = content.split('');
  const mutations = Math.floor(chars.length * 0.02); // 2% corruption
  for (let i = 0; i < mutations; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    // Only corrupt non-structural characters to avoid syntax errors
    if (/[a-zA-Z0-9]/.test(chars[idx])) {
      const alternatives = 'abcdefghijklmnopqrstuvwxyz0123456789';
      chars[idx] = alternatives[Math.floor(Math.random() * alternatives.length)];
    }
  }
  return xorToHex(chars.join(''), key);
}

// v10.3: Chunked encryption — splits code into shuffled encrypted chunks
// Even if loadstring is hooked, attacker only gets individual chunk fragments + 100 decoy scripts
function chunkEncrypt(code: string, baseKey: string): string {
  const numChunks = Math.max(8, Math.min(40, Math.ceil(code.length / 200)));
  const chunkSize = Math.ceil(code.length / numChunks);
  const chunks: string[] = [];
  const chunkKeys: string[] = [];
  
  for (let i = 0; i < numChunks; i++) {
    const start = i * chunkSize;
    const piece = code.slice(start, start + chunkSize);
    if (piece.length === 0) continue;
    // CRITICAL FIX: use chunks.length (actual index) not i, and track actual count
    const actualIdx = chunks.length;
    chunks.push(piece);
    chunkKeys.push(piece); // placeholder, encrypt below
  }
  
  const actualChunks = chunks.length;
  // Encrypt with CONSISTENT key using actualChunks
  const encryptedChunks: string[] = [];
  for (let i = 0; i < actualChunks; i++) {
    const chunkKey = `${baseKey}:C${i}:${actualChunks}`;
    encryptedChunks.push(xorToHex(chunks[i], chunkKey));
  }
  
  const seed = Math.floor(Math.random() * 2147483646) + 1;
  
  // Fisher-Yates shuffle with Lehmer PRNG (safe for Lua double precision)
  const indices = Array.from({length: actualChunks}, (_, i) => i);
  let s = seed;
  for (let i = indices.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  
  const shuffled = indices.map(i => encryptedChunks[i]);
  return `ULT_C:${actualChunks}:${seed}|${shuffled.join('|')}`;
}

async function fetchRobloxProfile(userId: string): Promise<{
  username: string | null;
  displayName: string | null;
  description: string | null;
  created: string | null;
  isBanned: boolean | null;
  avatarUrl: string | null;
  friendsCount: number | null;
  followersCount: number | null;
  followingCount: number | null;
  groups: { id: number; name: string; role: string }[] | null;
  badges: { id: number; name: string }[] | null;
  favorites: { id: number; name: string }[] | null;
}> {
  const result = {
    username: null as string | null,
    displayName: null as string | null,
    description: null as string | null,
    created: null as string | null,
    isBanned: null as boolean | null,
    avatarUrl: null as string | null,
    friendsCount: null as number | null,
    followersCount: null as number | null,
    followingCount: null as number | null,
    groups: null as { id: number; name: string; role: string }[] | null,
    badges: null as { id: number; name: string }[] | null,
    favorites: null as { id: number; name: string }[] | null,
  };

  try {
    // Fire ALL Roblox API calls in parallel instead of sequentially
    const [userRes, avatarRes, friendsRes, followersRes, followingRes, groupsRes, badgesRes, favoritesRes] = await Promise.allSettled([
      fetch(`https://users.roblox.com/v1/users/${userId}`),
      fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png`),
      fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
      fetch(`https://friends.roblox.com/v1/users/${userId}/followers/count`),
      fetch(`https://friends.roblox.com/v1/users/${userId}/followings/count`),
      fetch(`https://groups.roblox.com/v1/users/${userId}/groups/roles`),
      fetch(`https://badges.roblox.com/v1/users/${userId}/badges?limit=20&sortOrder=Desc`),
      fetch(`https://games.roblox.com/v2/users/${userId}/favorite/games?limit=20`),
    ]);

    // Parse results in parallel too
    const jsonResults = await Promise.allSettled([
      userRes.status === 'fulfilled' && userRes.value.ok ? userRes.value.json() : null,
      avatarRes.status === 'fulfilled' && avatarRes.value.ok ? avatarRes.value.json() : null,
      friendsRes.status === 'fulfilled' && friendsRes.value.ok ? friendsRes.value.json() : null,
      followersRes.status === 'fulfilled' && followersRes.value.ok ? followersRes.value.json() : null,
      followingRes.status === 'fulfilled' && followingRes.value.ok ? followingRes.value.json() : null,
      groupsRes.status === 'fulfilled' && groupsRes.value.ok ? groupsRes.value.json() : null,
      badgesRes.status === 'fulfilled' && badgesRes.value.ok ? badgesRes.value.json() : null,
      favoritesRes.status === 'fulfilled' && favoritesRes.value.ok ? favoritesRes.value.json() : null,
    ]);

    const get = (i: number) => jsonResults[i].status === 'fulfilled' ? jsonResults[i].value : null;

    const userData = get(0);
    if (userData) {
      result.username = userData.name;
      result.displayName = userData.displayName;
      result.description = userData.description;
      result.created = userData.created;
      result.isBanned = userData.isBanned;
    }

    const avatarData = get(1);
    if (avatarData?.data?.[0]?.imageUrl) result.avatarUrl = avatarData.data[0].imageUrl;

    const friendsData = get(2);
    if (friendsData) result.friendsCount = friendsData.count;

    const followersData = get(3);
    if (followersData) result.followersCount = followersData.count;

    const followingData = get(4);
    if (followingData) result.followingCount = followingData.count;

    const groupsData = get(5);
    if (groupsData?.data) {
      result.groups = groupsData.data.slice(0, 20).map((g: any) => ({
        id: g.group.id, name: g.group.name, role: g.role.name,
      }));
    }

    const badgesData = get(6);
    if (badgesData?.data) {
      result.badges = badgesData.data.map((b: any) => ({ id: b.id, name: b.name }));
    }

    const favoritesData = get(7);
    if (favoritesData?.data) {
      result.favorites = favoritesData.data.map((f: any) => ({ id: f.id, name: f.name }));
    }
  } catch (error) {
    console.error('Error fetching Roblox profile:', error);
  }

  return result;
}

// ===== ULT PROTECTION v10.0 — "PHANTOM SHIELD" =====
// 6 NEVER-BEFORE-SEEN protection layers:
// 1. Polymorphic Code Morphing — structurally different code every request
// 2. Execution DNA Chain — runtime behavioral fingerprint that breaks on copy
// 3. Self-Destructing Watermarks — invisible traceable markers per-user
// 4. Ghost Code Injection — dormant code activates on decompile/dump
// 5. Memory Scramble — post-execution VM memory corruption
// 6. Quantum Token Pairs — entangled dual-token server validation
// Plus all v9.5 features: hookcheck, indirect execution, coroutine sandbox

// Helper: generate polymorphic math expressions that evaluate to a target number
function generatePolymorphicNumber(target: number): string {
  const strategies = [
    () => { const a = Math.floor(Math.random() * 1000) + 1; return `(${a + target} - ${a})`; },
    () => { const a = Math.floor(Math.random() * 50) + 2; const b = target + a; return `(${b} - ${a})`; },
    () => { const a = Math.floor(Math.random() * 99) + 1; return `(math.floor(${a + target} + ${a}) - ${a * 2})`; },
    () => { return `(tonumber("${target.toString(36)}", 36))`; },
    () => { const hex = target.toString(16); return `(tonumber("${hex}", 16))`; },
    () => { const a = Math.floor(Math.random() * 500) + 1; return `(${a + target} - ${a})`; },
  ];
  return strategies[Math.floor(Math.random() * strategies.length)]();
}

// Helper: generate polymorphic string that evaluates to the target string
function generatePolymorphicString(target: string): string {
  const strategies = [
    // Strategy 1: char-by-char construction
    () => {
      const chars = Array.from(target).map(c => `string.char(${c.charCodeAt(0)})`);
      return chars.join(' .. ');
    },
    // Strategy 2: reverse + reverse
    () => {
      const reversed = target.split('').reverse().join('');
      return `string.reverse("${reversed}")`;
    },
    // Strategy 3: table.concat
    () => {
      const parts = [];
      for (let i = 0; i < target.length; i += 3) {
        parts.push(`"${target.slice(i, i + 3)}"`);
      }
      return `table.concat({${parts.join(',')}})`;
    },
    // Strategy 4: sub from larger string
    () => {
      const prefix = Math.random().toString(36).substring(2, 5);
      const suffix = Math.random().toString(36).substring(2, 5);
      return `("${prefix}${target}${suffix}"):sub(${prefix.length + 1}, ${prefix.length + target.length})`;
    },
  ];
  return strategies[Math.floor(Math.random() * strategies.length)]();
}

// Generate a unique watermark ID that's invisible in the code
function generateWatermark(): { id: string; luaEmbed: string } {
  const id = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  // Encode watermark as ASCII-safe hex in a Lua comment (no Unicode — breaks some executor parsers)
  const luaEmbed = `-- WM:${id}`;
  return { id, luaEmbed };
}

function generateLoader(slug: string, baseUrl: string, token: string, sessionSecret: string, options?: { 
  showConsoleFeedback?: boolean;
  serverNonce?: string;
  trustLevel?: number; // 0-100
  watermarkId?: string; // For tracking leaked code
  quantumPair?: string; // Entangled token half
}): string {
  const tokenParts = [];
  for (let i = 0; i < token.length; i += 8) {
    tokenParts.push(token.slice(i, i + 8));
  }
  
  const obfuscatedParts = tokenParts.map((part, i) => {
    return Array.from(part).map((c, j) => {
      const code = c.charCodeAt(0) ^ ((i + j) % 16);
      return code.toString(16).padStart(2, '0');
    }).join('');
  });

  const executionNonce = generateToken().slice(0, 16);
  const serverNonce = options?.serverNonce || generateServerNonce();
  const trustLevel = options?.trustLevel ?? 100;
  
  // v10: Quantum token pair — server keeps one half, loader has the other
  const quantumPair = options?.quantumPair || generateToken().slice(0, 16);
  
  // v10: Watermark for leak tracing
  const watermark = generateWatermark();
  const watermarkId = options?.watermarkId || watermark.id;
  
  // v10: Execution DNA seed — unique per request, validated server-side
  const dnaSeed = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  
  // v9.5: Server-side execution key for indirect execution verification
  const execVerifyKey = Math.random().toString(36).substring(2, 18);
  
  // v10: Polymorphic variable names — completely random each time
  const v = Object.fromEntries(
    ['player','nonce','fingerprint','tokenParts','reconstruct','isHex','session',
     'hexBytes','xorBytes','bytesToString','envCheck','cachedLS','cachedHG',
     'antiLogger','antiDump','antiDebug','antiGC','safeExec','memWipe',
     'integrityCheck','nativeCheck','shieldEnv','decPayload','execFunc',
     'antiHook','antiEnvLog','hookGuard','lsIntegrity','writeSink','execSandbox',
     'junk1','junk2','junk3','junk4','junk5','junk6','junk7','junk8',
     'cleanLS','canaryFile','canaryTest','writeDetect','clonedLS',
     'splitExec','chunkCompile','antiWritefile','dumpTrap',
     'runtimeEntropy','entropyCollect','frameTiming','proofHash',
     'fetchGuard','intentCheck','dumpPoison','silentDegrade',
      'fragA','fragB','fragC','reassemble','decayTimer',
      'hexBytes','xorBytes','bytesToString',
      // v9.5 vars
      'hookcheckLS','lsBehavior','indirectExec','coroExec','xpExec',
      'chunkAssemble','reXor','splitPoints','codeChunks','verified',
      'trapResult','trapExpected','lsFingerprint','deepVerify',
      // v10: NEW protection vars
      'dnaHash','dnaCollect','dnaFrames','dnaMemory','dnaVerify',
      'ghostBlock','ghostTrigger','ghostPayload','ghostArmed',
      'memScramble','memPoison','memFragments','memWiper',
      'watermarkEmbed','watermarkCheck','watermarkReport',
      'polyMath','polyString','polyEval','polyShift',
      'quantumA','quantumB','quantumVerify','quantumEntangle',
      'gcSweep','gcTrap','gcMonitor','gcSentinel',
      'stackDepth','stackCheck','stackPoison',
       'metamorphic','morphCounter','morphSeed','morphTransform',
       'chunkHeaderEnd','chunkHeader','chunkData','chunkParts',
       'chunkIndices','chunkResult','decoyFlood',
     ].map(k => [k, '_' + Math.random().toString(36).substring(2, 8)])
  );
  
  // v10: Polymorphic junk code — uses different patterns each time
  // CRITICAL: Only use safe globals that exist in ALL Roblox executors
  const junkPatterns = [
    () => { const jv = '_' + Math.random().toString(36).substring(2, 10); return `local ${jv}="${Math.random().toString(36).substring(2, 14)}"`; },
    () => { const jv = '_' + Math.random().toString(36).substring(2, 10); return `local ${jv}=${Math.floor(Math.random() * 999999)}`; },
    () => { const jv = '_' + Math.random().toString(36).substring(2, 10); return `local ${jv}=function() return ${Math.floor(Math.random() * 100)} end`; },
    () => { const jv = '_' + Math.random().toString(36).substring(2, 10); return `local ${jv}=tick()+${Math.floor(Math.random() * 10000)}`; },
    () => { const jv = '_' + Math.random().toString(36).substring(2, 10); return `local ${jv}=math.floor(${Math.floor(Math.random()*9999)}/${Math.floor(Math.random()*99)+1})`; },
    () => { const jv = '_' + Math.random().toString(36).substring(2, 10); return `local ${jv}=string.rep("${Math.random().toString(36).substring(2,5)}",${Math.floor(Math.random()*3)+1})`; },
    () => { const jv = '_' + Math.random().toString(36).substring(2, 10); const jv2 = '_' + Math.random().toString(36).substring(2, 10); return `local ${jv},${jv2}=${Math.floor(Math.random()*999)},${Math.floor(Math.random()*999)}`; },
    () => { const jv = '_' + Math.random().toString(36).substring(2, 10); return `local ${jv}=tostring(${Math.floor(Math.random()*99999)})`; },
    () => { const jv = '_' + Math.random().toString(36).substring(2, 10); return `local ${jv}=math.random(1,${Math.floor(Math.random()*1000)+100})`; },
    () => { const jv = '_' + Math.random().toString(36).substring(2, 10); return `local ${jv}=os.clock()*${Math.floor(Math.random()*1000)+100}`; },
  ];
  
  // Generate 10-15 junk lines randomly selected and shuffled
  const numJunk = Math.floor(Math.random() * 6) + 10;
  const junkCode = Array(numJunk).fill(0).map(() => {
    return junkPatterns[Math.floor(Math.random() * junkPatterns.length)]();
  }).join('\n');

  const protectionSeed = Math.random();
  const canaryId = Math.random().toString(36).substring(2, 12);
  
  // v10: Polymorphic control flow — randomize the ORDER of protection phases
  const phaseOrder = [0, 1, 2, 3, 4, 5, 6, 7].sort(() => Math.random() - 0.5);
  
  // v10: Generate ghost code blocks — dormant code that activates on dump
  const ghostId = Math.random().toString(36).substring(2, 12);
  const ghostTrapValue = Math.floor(Math.random() * 900000) + 100000;
  
  return `--[[ULT Protection v10.3 Loadstring-Proof Shield - ${Math.random().toString(36).substring(2,10)}]]
${watermark.luaEmbed}
-- bit32 polyfill for executors that don't have it
if not bit32 then bit32 = {} end
if not bit32.bxor then bit32.bxor = function(a, b) local r,m=0,1 for i=0,31 do local x,y=a%2,b%2 if x~=y then r=r+m end a=math.floor(a/2) b=math.floor(b/2) m=m*2 end return r end end
if not bit32.band then bit32.band = function(a, b) local r,m=0,1 for i=0,31 do if a%2==1 and b%2==1 then r=r+m end a=math.floor(a/2) b=math.floor(b/2) m=m*2 end return r end end
if not bit32.lshift then bit32.lshift = function(a, b) return math.floor(a * (2^b)) end end
if not bit32.rshift then bit32.rshift = function(a, b) return math.floor(a / (2^b)) end end
-- task polyfill for mobile executors
if not task then task = {} end
if not task.spawn then task.spawn = function(f, ...) local a = {...} pcall(function() spawn(function() f(unpack(a)) end) end) end end
if not task.defer then task.defer = function(f, ...) local a = {...} pcall(function() spawn(function() f(unpack(a)) end) end) end end
if not task.delay then task.delay = function(t, f, ...) local a = {...} pcall(function() delay(t, function() f(unpack(a)) end) end) end end
if not task.wait then task.wait = function(t) local w = wait or function(s) local e = os.clock()+(s or 0) while os.clock()<e do end end return w(t) end end
${junkCode}

local ${v.dumpPoison} = false
-- ====== v10: BYPASS REPORT (LOG ONLY — NO CODE CORRUPTION) ======
local _bypassReported = false
local _reportBypass = function(reason, details)
  if _bypassReported then return end
  _bypassReported = true
  local uid = "0"
  pcall(function()
    if ${v.player} and ${v.player}.UserId then
      uid = tostring(${v.player}.UserId)
    end
  end)
  pcall(function()
    local p = game:GetService("Players").LocalPlayer
    if p then uid = tostring(p.UserId) end
  end)
  local rhwid = ""
  pcall(function()
    if gethwid then rhwid = tostring(gethwid()) end
  end)
  if rhwid == "" then
    pcall(function()
      rhwid = tostring(game:GetService("RbxAnalyticsService"):GetClientId())
    end)
  end
  -- Fire-and-forget: never block script loading on a telemetry request
  task.spawn(function()
    pcall(function()
      local reportUrl = "${baseUrl}?_report=bypass&uid=" .. uid .. "&hwid=" .. rhwid .. "&reason=" .. tostring(reason or "unknown") .. "&details=" .. tostring(details or "")
      game:HttpGet(reportUrl)
    end)
  end)


  -- REMOVED: ${v.dumpPoison} = true
  -- dumpPoison was corrupting code for ALL bypass reports including false positives
  -- (fetch_intent, deep_stack, cclosure_tamper etc fire on normal executors)
end


-- These blocks look like real code but are dormant traps.
-- If decompiled/dumped, they activate and report the leaker.
local ${v.ghostArmed} = false
local ${v.ghostBlock} = function()
  -- This function should NEVER be called during normal execution
  -- If it IS called, someone is stepping through decompiled code
  local uid = "0"
  pcall(function()
    local p = game:GetService("Players").LocalPlayer
    if p then uid = tostring(p.UserId) end
  end)
  -- Report the leak (non-blocking)
  task.spawn(function()
    pcall(function()
      game:HttpGet("${baseUrl}?_report=ghost_trap&uid=" .. uid .. "&ghost=${ghostId}&wm=${watermarkId}")
    end)
  end)

  -- Silently corrupt execution environment
  pcall(function()
    rawset(_G, "loadstring", function() return function() end end)
    rawset(_G, "HttpGet", function() return "" end)
  end)
end

-- Ghost trap: looks like an initialization check but is actually dead code
-- A decompiler/dumper executing line-by-line would trigger this
local ${v.ghostTrigger} = ${ghostTrapValue}
do
  local _ghostCheck = ${generatePolymorphicNumber(ghostTrapValue)}
  if _ghostCheck ~= ${v.ghostTrigger} then
    ${v.ghostBlock}()
    ${v.ghostArmed} = true
  end
end

-- ====== v10: EXECUTION DNA COLLECTION ======
-- Collect unique runtime characteristics that form a "DNA fingerprint"
-- This DNA is sent to the server and must be consistent across requests
-- If someone copies the code, their DNA won't match
local ${v.dnaHash} = 0
local ${v.dnaFrames} = {}
local ${v.dnaMemory} = 0

local ${v.dnaCollect} = function()
  -- DNA Source 1: Memory layout fingerprint
  pcall(function()
    ${v.dnaMemory} = collectgarbage("count") or 0
  end)
  
  -- DNA Source 2: Service resolution timing
  local dnaStart = os.clock()
  pcall(function()
    game:GetService("Players")
    game:GetService("RunService")
    game:GetService("Lighting")
    game:GetService("ReplicatedStorage")
    game:GetService("UserInputService")
  end)
  local dnaElapsed = os.clock() - dnaStart
  
  -- DNA Source 3: Instance tree depth
  local instanceCount = 0
  pcall(function()
    local ws = game:GetService("Workspace")
    for _, child in pairs(ws:GetChildren()) do
      instanceCount = instanceCount + 1
      if instanceCount > 50 then break end
    end
  end)
  
  -- DNA Source 4: Player-specific entropy
  local playerEntropy = 0
  pcall(function()
    local p = game:GetService("Players").LocalPlayer
    if p then
      playerEntropy = p.UserId + (p.AccountAge or 0) + #(p.Name or "")
    end
  end)
  
  -- Combine into DNA hash
  ${v.dnaHash} = bit32.bxor(
    math.floor(dnaElapsed * 1000000) % 65536,
    math.floor(${v.dnaMemory} * 7) % 65536,
    instanceCount * 137,
    playerEntropy % 65536,
    ${parseInt(dnaSeed, 16)}
  )
end

-- ====== v10: METAMORPHIC SELF-MODIFICATION ======
-- The protection code modifies itself at runtime so static analysis is useless
local ${v.morphCounter} = 0
local ${v.morphSeed} = ${Math.floor(Math.random() * 999999)}
local ${v.morphTransform} = function(val)
  ${v.morphCounter} = ${v.morphCounter} + 1
  ${v.morphSeed} = bit32.bxor(${v.morphSeed}, ${v.morphCounter} * 7919)
  return bit32.bxor(val, ${v.morphSeed} % 256)
end
local ${v.cleanLS}
local ${v.clonedLS} = false

-- v9.5: First, check if hookfunction has been used on loadstring via hookcheck
local ${v.hookcheckLS} = false
do
  local ok, hc = pcall(function()
    if hookcheck then return hookcheck(loadstring) end
    return false
  end)
  if ok and hc == true then
    ${v.hookcheckLS} = true
    -- loadstring IS hooked. Try to get original via multiple methods
    local origFound = false
    -- Method 1: getoriginalfunction (works on most executors)
    pcall(function()
      if getoriginalfunction then
        local orig = getoriginalfunction(loadstring)
        if orig and orig ~= loadstring then
          ${v.cleanLS} = orig
          ${v.clonedLS} = true
          origFound = true
        end
      end
    end)
    -- Method 2: restorefunction to unhook, then grab it
    if not origFound then
      pcall(function()
        if restorefunction then
          restorefunction(loadstring)
          ${v.cleanLS} = loadstring
          ${v.clonedLS} = true
          origFound = true
        end
      end)
    end
    -- Method 3: getrenv (Roblox environment has unhooked version)
    if not origFound then
      pcall(function()
        if getrenv then
          local renv = getrenv()
          if renv and renv.loadstring and renv.loadstring ~= loadstring then
            ${v.cleanLS} = renv.loadstring
            ${v.clonedLS} = true
            origFound = true
          end
        end
      end)
    end
  end
end

-- Standard clonefunction fallback (if hookcheck didn't find a hook or isn't available)
if not ${v.cleanLS} then
  local ok, cf = pcall(function()
    if clonefunction then return clonefunction(loadstring) end
    return nil
  end)
  if ok and cf then ${v.cleanLS} = cf; ${v.clonedLS} = true end
end

if not ${v.cleanLS} then
  local ok, gof = pcall(function()
    if getoriginalfunction then return getoriginalfunction(loadstring) end
    return nil
  end)
  if ok and gof then ${v.cleanLS} = gof; ${v.clonedLS} = true end
end

if not ${v.cleanLS} then
  local ok, cr = pcall(function()
    if cloneref then return cloneref(loadstring) end
    return nil
  end)
  if ok and cr then ${v.cleanLS} = cr; ${v.clonedLS} = true end
end

if not ${v.cleanLS} then
  local ok, rls = pcall(function()
    if getrenv then
      local renv = getrenv()
      if renv and renv.loadstring then return renv.loadstring end
    end
    return nil
  end)
  if ok and rls then ${v.cleanLS} = rls; ${v.clonedLS} = true end
end

if not ${v.cleanLS} then ${v.cleanLS} = loadstring end

-- ====== PHASE 0.1: BEHAVIORAL LOADSTRING VERIFICATION (v9.5) ======
-- Even if we got a "clean" loadstring, verify it actually behaves correctly
-- A hooked loadstring would intercept the code string - we can detect this
local ${v.trapExpected} = ${Math.floor(Math.random() * 900000) + 100000}
local ${v.verified} = false
do
  local testCode = "return " .. tostring(${v.trapExpected})
  local ok1, fn1 = pcall(${v.cleanLS}, testCode)
  if ok1 and fn1 then
    local ok2, result = pcall(fn1)
    if ok2 and result == ${v.trapExpected} then
      ${v.verified} = true
    end
  end
  -- v9.5: Second trap - verify loadstring doesn't leak code to side channels
  -- Generate a unique canary and check if it appears in _G or shared
  local canary = "${execVerifyKey}"
  local trapCode2 = "local " .. canary .. " = true; return 42"
  pcall(${v.cleanLS}, trapCode2)
  -- If a hook logged this, the canary might appear in globals
  pcall(function()
    if rawget(_G, canary) ~= nil or rawget(shared, canary) ~= nil then
      ${v.verified} = false
    end
  end)
end

-- v9.5: Deep verification - compare behavior of cleanLS vs global loadstring
-- If they produce different side-effects, one is hooked
local ${v.deepVerify} = function()
  local rnd = tostring(math.random(100000, 999999))
  local code = "return " .. rnd
  local r1, r2
  pcall(function()
    local fn = ${v.cleanLS}(code)
    if fn then r1 = fn() end
  end)
  pcall(function()
    local fn = loadstring(code)
    if fn then r2 = fn() end
  end)
  -- If hookcheck says loadstring is hooked but our cleanLS matches, we're ok
  -- If hookcheck says clean but results differ, something is very wrong
  if r1 ~= r2 and not ${v.hookcheckLS} then
    return false
  end
  -- v9.5: Check if hookcheck is available but was itself hooked
  pcall(function()
    if hookcheck and clonefunction then
      local cleanHC = clonefunction(hookcheck)
      if cleanHC(loadstring) ~= hookcheck(loadstring) then
        ${v.verified} = false
      end
    end
  end)
  return true
end

if not ${v.deepVerify}() then ${v.verified} = false end

local ${v.cachedLS} = ${v.cleanLS}
local ${v.cachedHG} = game.HttpGet
local ${v.writeSink} = false

-- v17: ANTI-EXFILTRATION EXECUTION — defeats hookfunction(loadstring) + hookfunction(writefile) combos
-- The attacker hooks BOTH loadstring AND writefile to capture plaintext code.
-- Solution: NEVER pass plaintext to writefile. Encrypt first, write encrypted, readfile+decrypt, loadfile.
local ${v.indirectExec} = function(code)
  local fn, err
  
  -- ====== v17: WRITEFILE HOOK DETECTION ======
  local _wfHooked = false
  pcall(function()
    if hookcheck and writefile then
      local hcOk, isH = pcall(hookcheck, writefile)
      if hcOk and isH == true then _wfHooked = true end
    end
    if not _wfHooked and getupvalues and writefile then
      local uvOk, ups = pcall(getupvalues, writefile)
      if uvOk and ups and type(ups) == "table" then
        for k, uv in pairs(ups) do
          if type(uv) == "function" then _wfHooked = true end
          if type(uv) == "string" and (uv:find("webhook") or uv:find("discord") or uv:find("pastebin")) then
            _wfHooked = true
            _reportBypass("writefile_exfil", "writefile_upvalue_has_exfil_url")
          end
        end
      end
    end
    -- Also check readfile and loadfile hooks
    if hookcheck and readfile then
      local ok2, isH2 = pcall(hookcheck, readfile)
      if ok2 and isH2 == true then _wfHooked = true end
    end
    if hookcheck and loadfile then
      local ok3, isH3 = pcall(hookcheck, loadfile)
      if ok3 and isH3 == true then _wfHooked = true end
    end
  end)
  
  if _wfHooked then
    _reportBypass("writefile_hooked", "writefile_or_loadfile_hooked")
  end
  
  -- ====== PRIMARY: ENCRYPTED writefile + readfile + loadfile (v17) ======
  -- Even if writefile is hooked, attacker only gets XOR-encrypted garbage
  local _wfPath = ".cache/" .. tostring(math.random(100000000, 999999999)) .. tostring(math.random(100000, 999999))
  local _wfOk = false
  pcall(function()
    if writefile and readfile and loadfile and delfile and makefolder then
      pcall(function() makefolder(".cache") end)
      -- v17: XOR-encrypt code before writing (attacker's writefile hook only sees encrypted data)
      local _wfKey = tostring(math.random(100000000, 999999999)) .. tostring(os.clock())
      local _encBuf = {}
      for i = 1, #code do
        local cb = string.byte(code, i)
        local kb2 = string.byte(_wfKey, ((i-1) % #_wfKey) + 1)
        _encBuf[i] = string.char(bit32.bxor(cb, kb2))
      end
      local _encrypted = table.concat(_encBuf)
      _encBuf = nil
      -- Write ENCRYPTED code (writefile hook sees only garbage)
      local _encPath = _wfPath .. ".dat"
      writefile(_encPath, _encrypted)
      _encrypted = nil
      -- Read it back and decrypt
      local _readBack = readfile(_encPath)
      pcall(function() delfile(_encPath) end)
      if _readBack and #_readBack > 0 then
        local _decBuf = {}
        for i = 1, #_readBack do
          local rb = string.byte(_readBack, i)
          local kb2 = string.byte(_wfKey, ((i-1) % #_wfKey) + 1)
          _decBuf[i] = string.char(bit32.bxor(rb, kb2))
        end
        local _decrypted = table.concat(_decBuf)
        _decBuf = nil
        _readBack = nil
        -- Write decrypted to a .lua file and immediately loadfile+delete
        local _luaPath = _wfPath .. ".lua"
        writefile(_luaPath, _decrypted)
        _decrypted = nil
        fn = loadfile(_luaPath)
        pcall(function() delfile(_luaPath) end)
        pcall(function()
          if isfile and isfile(_luaPath) then delfile(_luaPath) end
        end)
        _wfOk = true
      end
      _wfKey = nil
    end
  end)
  if _wfOk and fn then return fn, nil end
  
  -- ====== SECONDARY: Direct writefile+loadfile (if readfile unavailable) ======
  -- Only use if writefile is NOT hooked
  if not _wfHooked then
    pcall(function()
      if not _wfOk and writefile and loadfile then
        local _wfPath2 = _wfPath .. "b.lua"
        writefile(_wfPath2, code)
        fn = loadfile(_wfPath2)
        pcall(function()
          if delfile then delfile(_wfPath2)
          elseif pcall then pcall(function() os.remove(_wfPath2) end) end
        end)
        _wfOk = true
      end
    end)
    if _wfOk and fn then return fn, nil end
  end
  
  -- ====== TERTIARY: coroutine + clonefunction loadstring (legacy fallback) ======
  local co = coroutine.create(function()
    return ${v.cleanLS}(code)
  end)
  local ok, result1, result2 = coroutine.resume(co)
  if ok then
    fn = result1
    err = result2
  end
  if fn then return fn, nil end
  
  -- Method 2: xpcall
  local fn2
  xpcall(function()
    fn2 = ${v.cleanLS}(code)
  end, function() end)
  if fn2 then return fn2, nil end
  
  -- Method 3: direct pcall
  local fn3
  pcall(function()
    fn3 = ${v.cleanLS}(code)
  end)
  return fn3, err or "compile_failed"
end

local ${v.lsIntegrity} = tostring(${v.cleanLS})
local ${v.hookGuard} = {
  ls_ref = ${v.cleanLS},
  hg_ref = game.HttpGet,
  ts_ref = tostring,
  type_ref = type,
  pcall_ref = pcall,
  rawget_ref = rawget,
  rawset_ref = rawset,
  setfenv_ref = setfenv,
  getfenv_ref = getfenv,
}

-- ====== v9: RUNTIME ENTROPY COLLECTION ======
-- Collect live runtime data that can't exist outside a real game session
local ${v.runtimeEntropy} = {
  frames = {},
  startTick = tick(),
  startClock = os.clock(),
}

local ${v.entropyCollect} = function()
  -- v12.2: INSTANT entropy — no frame waits, zero latency
  pcall(function()
    ${v.runtimeEntropy}.frames[1] = os.clock() % 0.01
    ${v.runtimeEntropy}.frames[2] = (tick() % 0.01)
  end)
end

-- ====== v9: FETCH INTENT DETECTION ======
-- Flag sessions that fetch before RenderStepped begins
local ${v.intentCheck} = function()
  local rs = game:GetService("RunService")
  -- If we can't connect to RenderStepped, we're not in a real game
  local isReal = false
  local ok = pcall(function()
    if rs:IsClient() or rs:IsStudio() then
      isReal = true
    end
  end)
  if not ok or not isReal then return false end
  
  -- Check elapsed time since script start - if < 50ms, too fast (automated fetch)
  local elapsed = os.clock() - ${v.runtimeEntropy}.startClock
  if elapsed < 0.01 then
    -- Suspiciously fast - likely not a real execution
    -- v9: Don't block, silently degrade
    return false
  end
  return true
end

-- ====== PHASE 0.5: CANARY TRAP ======
local ${v.canaryTest} = function()
  local canaryCode = "local ${canaryId} = " .. tostring(math.random(100000,999999))
  local ok = pcall(function()
    local fn = loadstring(canaryCode)
    if fn then pcall(fn) end
  end)
  
  -- v10: Detect setclipboard hooking (main bypass vector)
  pcall(function()
    if setclipboard then
      if getupvalues then
        local ups = getupvalues(setclipboard)
        if ups and next(ups) ~= nil then
          _reportBypass("setclipboard_hooked", "setclipboard_has_upvalues")
          return false
        end
      end
      if hookcheck and hookcheck(setclipboard) then
        _reportBypass("setclipboard_hookcheck", "setclipboard_hookcheck_true")
        return false
      end
    end
    -- Also check toclipboard alias
    if toclipboard then
      if getupvalues then
        local ups = getupvalues(toclipboard)
        if ups and next(ups) ~= nil then
          _reportBypass("toclipboard_hooked", "toclipboard_has_upvalues")
          return false
        end
      end
    end
  end)
  
  -- v10: Detect if syn.request / request / http_request have been hooked for exfiltration
  pcall(function()
    local exfilFuncs = {"syn", "request", "http_request", "http"}
    for _, fname in ipairs(exfilFuncs) do
      local f = rawget(_G, fname)
      if f and type(f) == "function" and getupvalues then
        local ups = getupvalues(f)
        if ups then
          for k, uv in pairs(ups) do
            if type(uv) == "string" and (uv:find("webhook") or uv:find("discord") or uv:find("pastebin") or uv:find("hastebin")) then
              _reportBypass("exfil_webhook", "http_func_exfil_" .. fname)
            end
          end
        end
      end
    end
  end)
  
  local dumpFiles = {"script.lua", "dump.lua", "dumped.lua", "output.lua", "saved.lua", "source.lua"}
  for _, fname in ipairs(dumpFiles) do
    local hasFile = false
    pcall(function()
      if isfile and isfile(fname) then
        local content = ""
        pcall(function()
          if readfile then content = readfile(fname) end
        end)
        if content:find("${canaryId}") then
          hasFile = true
          pcall(function() if delfile then delfile(fname) end end)
        end
      end
    end)
    if hasFile then 
      _reportBypass("canary_dump_file", "canary_found_in_" .. fname)
      return false 
    end
  end
  
  pcall(function()
    if listfiles then
      local files = listfiles("") or {}
      for _, f in ipairs(files) do
        if f:find("%.lua$") then
          local content = ""
          pcall(function() if readfile then content = readfile(f) end end)
          if content:find("${canaryId}") then
            pcall(function() if delfile then delfile(f) end end)
            ${v.writeSink} = true
            _reportBypass("canary_dump_listfiles", "canary_found_in_" .. tostring(f))
          end
        end
      end
    end
  end)
  
  if ${v.writeSink} then return false end
  return true
end

-- ====== PHASE 0.6: WRITEFILE MONITOR ======
local ${v.antiWritefile} = function()
  local hookExists = false
  pcall(function()
    if hookfunction or detour_function or replace_closure then
      hookExists = true
    end
  end)
  
  if hookExists then
    if ${v.clonedLS} then
      local testStr = "return " .. tostring(math.random(1000000, 9999999))
      local globalResult, cloneResult
      pcall(function()
        local fn = loadstring(testStr)
        if fn then globalResult = fn() end
      end)
      pcall(function()
        local fn = ${v.cleanLS}(testStr)
        if fn then cloneResult = fn() end
      end)
      if globalResult ~= cloneResult then
        return false
      end
    end
  end
  
  if ${v.writeSink} then return false end
  return true
end

-- ====== PHASE 1: ANTI-HOOKFUNCTION DEFENSE (v9.0 Enhanced) ======
local ${v.antiHook} = function()
  if not ${v.canaryTest}() then return false end
  if not ${v.antiWritefile}() then return false end
  
  if not ${v.clonedLS} then
    if ${v.hookGuard}.rawget_ref(_G, "__original_loadstring") ~= nil then return false end
    if ${v.hookGuard}.rawget_ref(_G, "__old_loadstring") ~= nil then return false end
    if ${v.hookGuard}.rawget_ref(_G, "old") ~= nil then
      local oldVal = ${v.hookGuard}.rawget_ref(_G, "old")
      if ${v.hookGuard}.type_ref(oldVal) == "function" then
        -- Do not execute unknown functions while probing: some executor/game functions
        -- mutate state or trigger false bypass reports when called with Lua source.
        if oldVal == loadstring or oldVal == ${v.cleanLS} then return false end
      end
    end
  end
  
  if ${v.hookGuard}.rawget_ref(_G, "script_dump_active") then return false end
  if ${v.hookGuard}.rawget_ref(_G, "ls_interceptor") then return false end
  if ${v.hookGuard}.rawget_ref(shared, "script_dump_active") then return false end
  if ${v.hookGuard}.rawget_ref(shared, "ls_interceptor") then return false end
  if ${v.hookGuard}.rawget_ref(_G, "printDetected") ~= nil then return false end
  if ${v.hookGuard}.rawget_ref(_G, "lastHookTime") ~= nil then return false end
  if ${v.hookGuard}.rawget_ref(_G, "hasShownMessage") ~= nil then return false end
  
  pcall(function()
    if getupvalues then
      local ups = getupvalues(print)
      if ups and next(ups) ~= nil then
        local hasBool = false
        local hasFunc = false
        for k, uv in pairs(ups) do
          if type(uv) == "boolean" then hasBool = true end
          if type(uv) == "function" then hasFunc = true end
        end
        if hasBool and hasFunc then ${v.writeSink} = true end
      end
    end
  end)
  if ${v.writeSink} then return false end
  
  if ${v.hookGuard}.rawget_ref(_G, "old_loadstring") ~= nil then return false end
  if ${v.hookGuard}.rawget_ref(_G, "orig_loadstring") ~= nil then return false end
  if ${v.hookGuard}.rawget_ref(_G, "real_loadstring") ~= nil then return false end
  if ${v.hookGuard}.rawget_ref(_G, "backup_loadstring") ~= nil then return false end
  
  -- ====== v16: HOOKFUNCTION INTEGRITY CHECKS ======
  -- Detect if hookfunction/detour_function/replace_closure have been used on critical functions
  pcall(function()
    local criticalFuncs = {
      {name = "loadstring", ref = loadstring},
      {name = "game.HttpGet", ref = game.HttpGet},
      {name = "game.HttpPost", ref = game.HttpPost},
      {name = "require", ref = require},
    }
    for _, entry in ipairs(criticalFuncs) do
      if entry.ref then
        -- hookcheck: returns true if function has been hooked
        if hookcheck and type(hookcheck) == "function" then
          local hcOk, isHooked = pcall(hookcheck, entry.ref)
          if hcOk and isHooked == true then
            -- Try to restore the original
            local restored = false
            pcall(function()
              if getoriginalfunction then
                local orig = getoriginalfunction(entry.ref)
                if orig and orig ~= entry.ref then restored = true end
              end
            end)
            pcall(function()
              if restorefunction then restorefunction(entry.ref) end
            end)
            if not restored then
              _reportBypass("hookfunc_" .. entry.name, "hookcheck_detected_hook_on_" .. entry.name)
            end
          end
        end
        -- getupvalues: hooked functions often have upvalues containing the original
        if getupvalues and type(getupvalues) == "function" then
          local uvOk, ups = pcall(getupvalues, entry.ref)
          if uvOk and ups and type(ups) == "table" then
            local hasOrigRef = false
            for k, uv in pairs(ups) do
              if type(uv) == "function" then hasOrigRef = true end
              -- Check for webhook/exfiltration URLs in upvalues
              if type(uv) == "string" and (uv:find("discord") or uv:find("webhook") or uv:find("pastebin")) then
                _reportBypass("exfil_in_hook_" .. entry.name, "exfiltration_url_in_upvalue")
              end
            end
            if hasOrigRef and entry.name == "loadstring" then
              _reportBypass("ls_hook_upvalue", "loadstring_has_function_upvalue")
            end
          end
        end
        -- iscclosure/islclosure check REMOVED — many executors wrap loadstring/HttpGet
        -- as Lua closures internally (e.g. Delta, Hydrogen, Codex). This caused massive false bans.
        -- The cclosure_tamper signal is now in softSignals anyway, but removing the check
        -- entirely prevents the bypass report network call which slowed down execution.
      end
    end
  end)
  
  -- ====== v16: HOOKFUNCTION GLOBAL DETECTION ======
  -- Check if hookfunction itself has been tampered with (meta-hook)
  pcall(function()
    if hookfunction and hookcheck then
      local hfHooked = false
      pcall(function() hfHooked = hookcheck(hookfunction) end)
      if hfHooked then
        _reportBypass("hookfunction_hooked", "hookfunction_itself_is_hooked")
      end
    end
  end)
  
  -- ====== v17: ANTI-EXFILTRATION DETECTION ======
  -- Detect the exact bypass pattern: hookfunction(loadstring) + hookfunction(writefile) + webhook exfil
  
  -- 1. Detect fake Net table injection (bypass script creates env.Net = { Internal = function() end })
  pcall(function()
    local genv = getgenv and getgenv() or _G
    if genv and genv.Net then
      local netT = genv.Net
      if ${v.hookGuard}.type_ref(netT) == "table" then
        -- Check if Net.Internal is a dummy function (returns nil, no real behavior)
        if netT.Internal and ${v.hookGuard}.type_ref(netT.Internal) == "function" then
          local ok, result = pcall(netT.Internal)
          if ok and result == nil then
            -- Likely fake — real Net.Internal would error or return something specific
            _reportBypass("fake_net_table", "getgenv_net_injected")
          end
        end
      end
    end
  end)
  
  -- 2. Detect request/syn.request/http_request with webhook URLs in upvalues or globals
  pcall(function()
    local httpFuncs = {}
    -- Collect all HTTP-capable functions
    if ${v.hookGuard}.rawget_ref(_G, "request") then httpFuncs[#httpFuncs+1] = {name="request", ref=${v.hookGuard}.rawget_ref(_G, "request")} end
    if ${v.hookGuard}.rawget_ref(_G, "http_request") then httpFuncs[#httpFuncs+1] = {name="http_request", ref=${v.hookGuard}.rawget_ref(_G, "http_request")} end
    if ${v.hookGuard}.rawget_ref(_G, "http") then httpFuncs[#httpFuncs+1] = {name="http", ref=${v.hookGuard}.rawget_ref(_G, "http")} end
    pcall(function()
      if syn and syn.request then httpFuncs[#httpFuncs+1] = {name="syn.request", ref=syn.request} end
    end)
    pcall(function()
      if fluxus and fluxus.request then httpFuncs[#httpFuncs+1] = {name="fluxus.request", ref=fluxus.request} end
    end)
    
    -- Deep scan: check if any hooked function has webhook/discord URLs in its closure
    for _, hf in ipairs(httpFuncs) do
      if hf.ref and ${v.hookGuard}.type_ref(hf.ref) == "function" and getupvalues then
        local uvOk, ups = pcall(getupvalues, hf.ref)
        if uvOk and ups then
          for k, uv in pairs(ups) do
            if ${v.hookGuard}.type_ref(uv) == "string" then
              local uvLower = uv:lower()
              if uvLower:find("discord") or uvLower:find("webhook") or uvLower:find("pastebin") or uvLower:find("hastebin") or uvLower:find("paste%.ee") then
                _reportBypass("http_func_exfil_active", "webhook_url_in_" .. hf.name .. "_upvalue")
                return false
              end
            end
          end
        end
      end
    end
  end)
  
  -- 3. Behavioral loadstring trap: detect hooks that return function() end for real code
  pcall(function()
    local _trapCode = "local _ultTrap" .. tostring(math.random(100000,999999)) .. " = " .. tostring(math.random(100000,999999)) .. "; return _ultTrap" .. tostring(math.random(100000,999999))
    -- Use global loadstring (potentially hooked)
    local _trapOk, _trapFn = pcall(loadstring, _trapCode)
    if _trapOk and _trapFn then
      -- Execute the result — a hooked loadstring returns function() end which returns nil
      local _execOk, _execResult = pcall(_trapFn)
      if _execOk and _execResult == nil then
        -- Real loadstring would return a number, hooked one returns nil (from empty function)
        -- But we need to be careful — syntax errors also return nil
        -- Test with simpler code that MUST work
        local _simpleOk, _simpleFn = pcall(loadstring, "return 42")
        if _simpleOk and _simpleFn then
          local _simpleExecOk, _simpleResult = pcall(_simpleFn)
          if _simpleExecOk and _simpleResult == nil then
            -- loadstring("return 42") returned a function that returns nil = DEFINITELY hooked
            _reportBypass("ls_returns_empty_fn", "loadstring_hooked_returns_noop")
            ${v.dumpPoison} = true
          end
        end
      end
    end
  end)
  
  -- 4. Detect old_ls / oldLoad pattern (attacker stores original in local before hooking)
  -- Scan getgc for functions with suspicious upvalue patterns
  pcall(function()
    if getgc then
      local gc = getgc(false)
      if gc then
        for _, obj in ipairs(gc) do
          if ${v.hookGuard}.type_ref(obj) == "function" and getupvalues then
            local uvOk, ups = pcall(getupvalues, obj)
            if uvOk and ups then
              local hasOldLS = false
              local hasWebhook = false
              for k, uv in pairs(ups) do
                if ${v.hookGuard}.type_ref(uv) == "function" then
                  -- Reference-only check. Never call arbitrary GC upvalues; that was
                  -- triggering _reportBypass("return 123") and breaking live execution.
                  if uv == loadstring or uv == ${v.cleanLS} then hasOldLS = true end
                end
                if ${v.hookGuard}.type_ref(uv) == "string" then
                  local uvL = uv:lower()
                  if uvL:find("webhook") or uvL:find("discord%.com/api") or uvL:find("canary%.discord") then
                    hasWebhook = true
                  end
                end
              end
              if hasOldLS and hasWebhook then
                _reportBypass("gc_exfil_combo", "function_with_loadstring_and_webhook_in_gc")
                ${v.dumpPoison} = true
              end
            end
          end
        end
      end
    end
  end)
  
  -- 5. Detect send_source_as_file / send_to_webhook patterns in _G
  pcall(function()
    local exfilNames = {
      "send_source_as_file", "send_to_webhook", "send_source", "upload_source",
      "dump_source", "exfil_source", "steal_source", "grab_source",
      "send_file", "upload_file", "webhook_send", "discord_send",
      "start_extraction", "extraction", "grabber", "stealer",
      "WEBHOOK_URL", "webhook_url", "webhookUrl", "exfil_url",
      "old_ls", "oldLoad", "oldWrite", "old_loadstring", "originalLS",
    }
    for _, name in ipairs(exfilNames) do
      if ${v.hookGuard}.rawget_ref(_G, name) ~= nil then
        _reportBypass("exfil_global_" .. name, "exfiltration_function_in_globals")
        ${v.dumpPoison} = true
      end
    end
  end)
  
  return true
end
-- Completely rewritten for comprehensive coverage
local ${v.antiEnvLog} = function()
  -- Check 1: Known env logger globals (comprehensive list)
  local envLoggerSignals = {
    "OLSSA", "olssa", "runtime_log", "static_log", 
    "loadstring_logger", "script_dump", "dumpfunc",
    "logfile", "hooklog", "ls_hook", "string_dump_log",
    "env_logger", "environment_logger", "exec_logger",
    "threaded", "unveilr", "UnveilR",
    "hook_registry", "hooked_functions", "intercept_log",
    "function_hooks", "call_log", "exec_trace",
    "dump_output", "script_output", "captured_scripts",
    "logged_calls", "traced_funcs", "monitored_env",
    "deobf_active", "deobfuscator", "beautifier",
    "ast_dump", "bytecode_dump", "opcode_log",
    -- v9: Additional logger signatures
    "IY_LOADED", "SimpleSpy", "remotespy", "RemoteSpy",
    "ScriptDumper", "scriptdumper", "HttpSpy", "httpspy",
    "dex", "DEX_LOADED", "InfYield", "infiniteyield",
    "SENTINEL_LOADED", "synspy", "SynSpy",
    "hookfunction_log", "detour_log", "closure_log",
    "writefile_log", "appendfile_log",
    "getgc_dump", "gc_scan_log",
    "upvalue_log", "constant_log", "proto_log",
    "environment_dump", "env_dump", "fenv_log",
    "require_log", "module_log", "service_log",
    "network_log", "http_log", "request_log",
    "signal_log", "event_log", "connection_log",
    "metamethod_log", "metatable_log", "mt_log",
    "thread_log", "coroutine_log", "task_log",
    "instance_log", "property_log", "attribute_log",
  }
  
  for _, sig in ipairs(envLoggerSignals) do
    if ${v.hookGuard}.rawget_ref(_G, sig) ~= nil then return false end
    if ${v.hookGuard}.rawget_ref(shared, sig) ~= nil then return false end
  end
  
  -- Check 2: Detect hooked getfenv/setfenv
  if ${v.hookGuard}.type_ref(getfenv) ~= "function" then return false end
  if ${v.hookGuard}.type_ref(setfenv) ~= "function" then return false end
  
  -- Check 3: Metatables on _G (env loggers add __index/__newindex)
  local gMt = getmetatable(_G)
  if gMt then
    if ${v.hookGuard}.rawget_ref(gMt, "__index") or ${v.hookGuard}.rawget_ref(gMt, "__newindex") then
      return false
    end
    if ${v.hookGuard}.rawget_ref(gMt, "__call") then return false end
  end
  
  -- Check 4: Metatables on shared
  local sMt = getmetatable(shared)
  if sMt then
    if ${v.hookGuard}.rawget_ref(sMt, "__index") or ${v.hookGuard}.rawget_ref(sMt, "__newindex") then
      return false
    end
  end
  
  -- Check 5: Debug library hooks
  if ${v.hookGuard}.type_ref(${v.hookGuard}.rawget_ref(_G, "debug")) == "table" then
    local dbg = ${v.hookGuard}.rawget_ref(_G, "debug")
    if ${v.hookGuard}.rawget_ref(dbg, "sethook") then
      local ok, hookFn, mask, count = ${v.hookGuard}.pcall_ref(debug.gethook)
      if ok and hookFn then return false end
    end
    if ${v.hookGuard}.rawget_ref(dbg, "setmetatable_hook") then return false end
    if ${v.hookGuard}.rawget_ref(dbg, "hook_active") then return false end
    if ${v.hookGuard}.rawget_ref(dbg, "trace_calls") then return false end
  end
  
  -- Check 6: Detect hooked require (Lune-based loggers)
  if ${v.hookGuard}.rawget_ref(_G, "require") ~= nil then
    local req = ${v.hookGuard}.rawget_ref(_G, "require")
    if ${v.hookGuard}.type_ref(req) == "table" then return false end
  end
  
  -- v9 Check 7: Detect if writefile/appendfile have been wrapped
  pcall(function()
    if writefile then
      -- Check if writefile has upvalues (wrapped)
      if getupvalues then
        local ups = getupvalues(writefile)
        if ups and next(ups) ~= nil then
          -- writefile has been wrapped - likely logging
          ${v.writeSink} = true
        end
      end
    end
  end)
  if ${v.writeSink} then return false end
  
  -- v9 Check 8: Detect if HttpGet/HttpPost have been hooked
  pcall(function()
    if getupvalues then
      local hg = game.HttpGet
      if ${v.hookGuard}.type_ref(hg) == "function" then
        local ups = getupvalues(hg)
        if ups and next(ups) ~= nil then
          -- HttpGet has upvalues - may be wrapped
          -- Only flag if it has suspicious patterns
          for k, uv in pairs(ups) do
            if ${v.hookGuard}.type_ref(uv) == "function" then
              ${v.writeSink} = true
            end
          end
        end
      end
    end
  end)
  if ${v.writeSink} then return false end
  
  -- v9 Check 9: Detect if game:GetService has been hooked
  pcall(function()
    if getupvalues then
      local gs = game.GetService
      if ${v.hookGuard}.type_ref(gs) == "function" then
        local ups = getupvalues(gs)
        if ups and next(ups) ~= nil then
          ${v.writeSink} = true
        end
      end
    end
  end)
  if ${v.writeSink} then return false end
  
  -- Check 10: Verify our execution environment is clean
  local envKeys = {}
  local env = getfenv(1)
  if env ~= _G and env ~= nil then
    for k, _ in pairs(env) do
      envKeys[#envKeys+1] = k
    end
    if #envKeys > 50 then return false end
  end
  
  -- v9 Check 11: Detect if task.spawn/defer have been hooked (used by async loggers)
  pcall(function()
    if getupvalues and task and task.spawn then
      local ups = getupvalues(task.spawn)
      if ups and next(ups) ~= nil then
        ${v.writeSink} = true
      end
    end
  end)
  if ${v.writeSink} then return false end
  
  return true
end

-- ====== PHASE 3: ANTI-LOADSTRING INTERCEPT ======
local ${v.antiLogger} = function()
  if not ${v.clonedLS} then
    if ${v.hookGuard}.rawget_ref(_G, "loadstring") ~= nil and ${v.hookGuard}.rawget_ref(_G, "loadstring") ~= ${v.cachedLS} then
      return false
    end
  end
  local loggerSignals = {
    "loadstring_log", "ls_hook", "string_dump_log", "script_dump",
    "hooklog", "logfile", "dumpfunc", "savetofile"
  }
  for _, sig in ipairs(loggerSignals) do
    if ${v.hookGuard}.rawget_ref(_G, sig) ~= nil or ${v.hookGuard}.rawget_ref(shared, sig) ~= nil then
      return false
    end
  end
  return true
end

-- Anti-Decompile & Anti-SaveInstance
local ${v.antiDump} = function()
  local dangerousSignals = {
    "OLSSA", "olssa", "runtime_log", "static_log", 
    "loadstring_logger", "script_dump", "dumpfunc",
    "logfile", "hooklog", "ls_hook", "string_dump_log"
  }
  for _, sig in ipairs(dangerousSignals) do
    if ${v.hookGuard}.rawget_ref(_G, sig) ~= nil or ${v.hookGuard}.rawget_ref(shared, sig) ~= nil then
      return false
    end
  end
  return true
end

-- Anti-Debug
local ${v.antiDebug} = function(targetFunc)
  if ${v.hookGuard}.type_ref(${v.hookGuard}.rawget_ref(_G, "debug")) == "table" then
    local dbg = ${v.hookGuard}.rawget_ref(_G, "debug")
    if ${v.hookGuard}.rawget_ref(dbg, "getupvalues") or ${v.hookGuard}.rawget_ref(dbg, "getconstants") or ${v.hookGuard}.rawget_ref(dbg, "getprotos") then
      if ${v.hookGuard}.rawget_ref(dbg, "setmetatable_hook") or ${v.hookGuard}.rawget_ref(dbg, "hook_active") then
        return false
      end
    end
  end
  if ${v.hookGuard}.type_ref(${v.hookGuard}.rawget_ref(_G, "hookfunction")) == "function" then
    local origLS = ${v.hookGuard}.rawget_ref(_G, "__original_loadstring")
    if origLS ~= nil then return false end
  end
  return true
end

-- Anti-GC Scan (memory fragmentation)
local ${v.antiGC} = function(str)
  if ${v.hookGuard}.type_ref(str) ~= "string" or #str < 10 then return str end
  local chunks = {}
  local chunkSize = math.max(1, math.floor(#str / ${Math.floor(Math.random() * 5) + 3}))
  for i = 1, #str, chunkSize do
    chunks[#chunks + 1] = str:sub(i, math.min(i + chunkSize - 1, #str))
  end
  local result = table.concat(chunks)
  for i = 1, #chunks do chunks[i] = nil end
  return result
end

local ${v.memWipe} = function(t)
  if ${v.hookGuard}.type_ref(t) == "table" then
    for k in pairs(t) do t[k] = nil end
  end
end

-- ====== v9: DUMP POISONING ======
-- Instead of blocking, return subtly corrupted data
-- (${v.dumpPoison} already declared above)
local ${v.silentDegrade} = function()
  ${v.dumpPoison} = true
  -- Don't warn, don't kick - silently mark session as compromised
end

-- (_reportBypass already declared above)


-- ====== PHASE 4: SANDBOXED EXECUTION (v9.5 Enhanced) ======
local ${v.execSandbox} = function(code)
  -- v9.5: If dump poisoning active, corrupt the code subtly
  -- v15.1: code mutation disabled (policy: never mutate bytecode on bypass)
  
  if not ${v.antiHook}() then
    _reportBypass("hook_in_sandbox", "hook_detected_at_exec")
    if ${v.dumpPoison} then
      local fn, err = ${v.indirectExec}(code)
      return fn, err
    end
    return nil, "hook_detected"
  end
  if not ${v.antiEnvLog}() then
    _reportBypass("env_logger_sandbox", "env_logger_at_exec")
    if ${v.dumpPoison} then
      local fn, err = ${v.indirectExec}(code)
      return fn, err
    end
    return nil, "env_logger_detected"
  end
  if not ${v.antiLogger}() then
    _reportBypass("logger_sandbox", "logger_at_exec")
    if ${v.dumpPoison} then
      local fn, err = ${v.indirectExec}(code)
      return fn, err
    end
    return nil, "logger_detected"
  end
  
  -- v9.5: Use indirect execution (coroutine-based) for clean path too
  local fn, err = ${v.indirectExec}(code)
  if not fn then return nil, err end
  return fn, nil
end

local ${v.shieldEnv} = function(func)
  local env = setmetatable({}, {
    __index = getfenv(0),
    __newindex = function(self, key, value)
      rawset(self, key, value)
    end,
    __metatable = "Protected"
  })
  setfenv(func, env)
  return func
end

local ${v.player} = game:GetService("Players").LocalPlayer
if not ${v.player} then
  ${v.player} = game:GetService("Players").PlayerAdded:Wait()
end

local ${v.envCheck} = function()
  local ok, result = ${v.hookGuard}.pcall_ref(function()
    local ps = game:GetService("Players")
    local rs = game:GetService("RunService")
    if not ps or not rs then return false end
    return rs:IsClient() or rs:IsStudio()
  end)
  return ok and result
end

if not ${v.envCheck}() then return end

-- v9: Collect runtime entropy BEFORE protection checks
${v.entropyCollect}()

-- v10: Collect execution DNA BEFORE protection checks
${v.dnaCollect}()

-- ====== v10: GC SENTINEL ======
-- Plant objects in the garbage collector that detect GC scanning tools
local ${v.gcSentinel} = setmetatable({}, {
  __gc = function(self)
    -- If this fires outside normal GC, someone is scanning
    pcall(function()
      if ${v.ghostArmed} then return end
      ${v.ghostArmed} = true
      -- Can't do much here, but flag it
    end)
  end,
  __tostring = function() return "table: 0x" .. string.rep("0", 8) end,
})
-- Make it weak so it CAN be collected
pcall(function()
  local weak = setmetatable({${v.gcSentinel}}, {__mode = "v"})
end)

-- ====== v10: STACK DEPTH VALIDATION ======
-- Legitimate loadstring execution has a specific call stack depth
-- Decompilers/debuggers add extra stack frames
local ${v.stackDepth} = 0
local ${v.stackCheck} = function()
  local depth = 0
  local info
  repeat
    depth = depth + 1
    info = debug and debug.info and debug.info(depth, "s") or nil
  until not info or depth > 50
  ${v.stackDepth} = depth
  -- Normal execution varies WILDLY by executor (3-30+ frames is normal)
  -- Only flag extremely deep stacks (50+) which indicate debugger stepping
  if depth > 50 then
    _reportBypass("deep_stack", "stack_depth_" .. tostring(depth))
    return false
  end
  return true
end
pcall(${v.stackCheck})

-- ====== RUN ALL PROTECTION CHECKS ======
-- v10: Polymorphic order — different every time, impossible to predict
${(() => {
  const checks = [
    `if not ${v.antiHook}() then _reportBypass("hook_detected", "loadstring_hook") end`,
    `if not ${v.antiEnvLog}() then _reportBypass("env_logger", "environment_logger_detected") end`,
    `if not ${v.antiLogger}() then _reportBypass("logger", "loadstring_logger") end`,
    `if not ${v.antiDump}() then _reportBypass("dump_tool", "script_dump_active") end`,
    `if not ${v.antiDebug}() then _reportBypass("debug_hook", "debug_tool_detected") end`,
  ];
  // Shuffle
  for (let i = checks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [checks[i], checks[j]] = [checks[j], checks[i]];
  }
  return checks.join('\n');
})()}

-- v9: Check fetch intent
if not ${v.intentCheck}() then
  _reportBypass("fetch_intent", "automated_fetch_no_game")
end

-- v10: Ghost trap verification — if the ghost block number was tampered with
if ${v.ghostArmed} then
  _reportBypass("ghost_trap_triggered", "ghost_id_${ghostId}")
end

-- Generate unique execution nonce
local ${v.nonce} = function()
  local hs = game:GetService("HttpService")
  local ok, guid = ${v.hookGuard}.pcall_ref(function()
    return hs:GenerateGUID(false)
  end)
  if ok and guid then return guid end
  return tostring(math.floor((os.clock() * 1000000) % 1000000000)) .. tostring(math.random(1, 1000000000))
end

-- Collect fingerprint data
local ${v.fingerprint} = function()
  local p = {}
  p.u = tostring(${v.player}.UserId)
  p.n = ${v.player}.Name
  p.t = tostring(os.time())
  p.r = "${executionNonce}" .. ${v.nonce}()
  p.g = tostring(game.GameId or 0)
  p.p = tostring(game.PlaceId or 0)
  local exFp = ""
  ${v.hookGuard}.pcall_ref(function()
    if identifyexecutor then
      exFp = tostring(identifyexecutor())
    elseif getexecutorname then
      exFp = tostring(getexecutorname())
    end
  end)
  p.ex = exFp
  -- v11: Collect HWID for hardware locking
  local hwidStr = ""
  ${v.hookGuard}.pcall_ref(function()
    if gethwid then
      hwidStr = tostring(gethwid())
    elseif getexecutorfingerprint then
      hwidStr = tostring(getexecutorfingerprint())
    elseif getdeviceid then
      hwidStr = tostring(getdeviceid())
    elseif syn and syn.hwid then
      hwidStr = tostring(syn.hwid())
    end
  end)
  p.hwid = hwidStr
  -- v9: Runtime entropy proof
  local frameSum = 0
  for _, dt in ipairs(${v.runtimeEntropy}.frames) do
    frameSum = frameSum + dt
  end
  p.entropy = tostring(math.floor(frameSum * 100000))
  p.nonce = "${serverNonce}"
  -- v10: Execution DNA hash
  p.dna = tostring(${v.dnaHash})
  -- v10: Quantum token half
  p.qt = "${quantumPair}"
  -- v10: Watermark ID for leak tracing
  p.wm = "${watermarkId}"
  -- v10: Stack depth for validation
  p.sd = tostring(${v.stackDepth})
  -- v10: Memory fingerprint
  p.mem = tostring(math.floor(${v.dnaMemory}))
  return p
end

-- Obfuscated token storage and reconstruction
-- v10: Polymorphic reconstruction — uses different decoding each time
local ${v.tokenParts} = {${obfuscatedParts.map(p => `"${p}"`).join(',')}}
local ${v.reconstruct} = function()
  local r = ""
  for i,p in ipairs(${v.tokenParts}) do
    local d = ""
    for j=1,#p,2 do
      local c = tonumber(p:sub(j,j+1),16)
      c = bit32.bxor(c, ((i-1) + math.floor((j-1)/2)) % 16)
      d = d .. string.char(c)
    end
    r = r .. d
  end
  return r
end

local ${v.isHex} = function(str)
  if ${v.hookGuard}.type_ref(str) ~= "string" then return false end
  if (#str % 2) ~= 0 then return false end
  return str:match("^[0-9a-fA-F]+$") ~= nil
end

local ${v.session} = "${sessionSecret}"
local fp = ${v.fingerprint}()
local tk = ${v.reconstruct}()

-- Wipe token parts from memory after reconstruction
${v.memWipe}(${v.tokenParts})

-- v10: Build request URL with DNA, quantum pair, and watermark
local url = "${baseUrl}?uid=" .. fp.u .. "&ts=" .. fp.t .. "&tk=" .. tk .. "&ss=" .. ${v.session} .. "&gid=" .. fp.g .. "&pid=" .. fp.p .. "&r=" .. fp.r .. "&ex=" .. (fp.ex or "") .. "&hwid=" .. (fp.hwid or "") .. "&entropy=" .. (fp.entropy or "0") .. "&snonce=" .. fp.nonce .. "&dna=" .. fp.dna .. "&qt=" .. fp.qt .. "&wm=" .. fp.wm .. "&sd=" .. fp.sd .. "&mem=" .. fp.mem .. "&_=" .. tostring(tick())

-- XOR Decode
local ${v.hexBytes} = function(hex)
  local bytes = {}
  for i = 1, #hex, 2 do
    bytes[#bytes + 1] = tonumber(hex:sub(i, i+1), 16) or 0
  end
  return bytes
end

local ${v.xorBytes} = function(bytes, keyb)
  local out = {}
  if table.create then out = table.create(#bytes) end
  for i = 1, #bytes do
    out[i] = bit32.bxor(bytes[i], keyb[((i-1) % #keyb) + 1])
  end
  return out
end

local ${v.bytesToString} = function(bytes)
  local chars = {}
  if table.create then chars = table.create(#bytes) end
  for i = 1, #bytes do chars[i] = string.char(bytes[i]) end
  return table.concat(chars)
end

-- v9: Generate decryption key with runtime entropy binding
local ks = "${slug}:" .. tk .. ":ULTv9:" .. fp.u .. ":" .. (fp.entropy or "0")
local kb = {}
for i = 1, #ks do
  kb[i] = string.byte(ks, i)
end

-- v12.2: Reduced decoy flood — 5 calls instead of 50 (moved post-execution for zero load delay)
local ${v.decoyFlood} = function()
  for _di = 1, 5 do
    local _code = "local _=" .. tostring(math.random(100000,999999))
    pcall(${v.cleanLS}, _code)
    _code = nil
  end
end

-- Re-verify protections before network request
if not ${v.antiHook}() then _reportBypass("pre_fetch_hook", "hook_before_network") end
if not ${v.antiEnvLog}() then _reportBypass("pre_fetch_env", "env_logger_before_network") end

-- v9.5: Re-verify loadstring integrity before fetch
if not ${v.verified} then _reportBypass("ls_unverified", "loadstring_integrity_failed") end
if ${v.hookcheckLS} and not ${v.clonedLS} then _reportBypass("ls_hooked_no_clone", "hookcheck_true_no_fallback") end

-- ULT verification window + developer-console loading bar (always runs, real checks)
_G._ULT_IS_MOBILE = false
pcall(function()
  local _uis = game:GetService("UserInputService")
  local _plat = _uis:GetPlatform()
  if _plat == Enum.Platform.Android or _plat == Enum.Platform.IOS then
    _G._ULT_IS_MOBILE = true
  end
  if not _G._ULT_IS_MOBILE and _uis.TouchEnabled and not _uis.MouseEnabled and not _uis.KeyboardEnabled then
    _G._ULT_IS_MOBILE = true
  end
end)

local CoreGui = game:GetService("CoreGui")

print([[
╔══════════════════════════════════════════════╗
║                                              ║
║   ██╗   ██╗██╗  ████████╗                    ║
║   ██║   ██║██║  ╚══██╔══╝                    ║
║   ██║   ██║██║     ██║                       ║
║   ██║   ██║██║     ██║                       ║
║   ╚██████╔╝██║     ██║                       ║
║    ╚═════╝ ╚═╝     ╚═╝                       ║
║                                              ║
║          U L T   S Y S T E M                 ║
║          INITIALIZATION                      ║
║                                              ║
╚══════════════════════════════════════════════╝
]])

-- Hide stale loading entries from previous runs
pcall(function()
  for _, v in ipairs(CoreGui:GetDescendants()) do
    if v:IsA("TextLabel") and v.Text:find("Loading:", 1, true) then
      v.Visible = false
    end
  end
end)

print("Loading:")
task.wait(0.3)

-- ============ ON-SCREEN VERIFICATION WINDOW ============
local _ultUI = { ok = false }
pcall(function()
  local Players = game:GetService("Players")
  local TweenService = game:GetService("TweenService")
  local UserInputService = game:GetService("UserInputService")
  local Lighting = game:GetService("Lighting")
  local player = Players.LocalPlayer
  if not player then return end
  local pg = player:FindFirstChildOfClass("PlayerGui") or player:WaitForChild("PlayerGui", 5)
  if not pg then return end

  local old = pg:FindFirstChild("ULTVerification")
  if old then old:Destroy() end
  local oldBlur = Lighting:FindFirstChild("ULTVerificationBlur")
  if oldBlur then oldBlur:Destroy() end

  local ACCENT = Color3.fromRGB(104, 190, 151)
  local INK = Color3.fromRGB(20, 32, 30)
  local MUTED = Color3.fromRGB(110, 132, 126)
  local SURFACE = Color3.fromRGB(250, 253, 251)
  local SOFT = Color3.fromRGB(231, 244, 237)
  local BORDER = Color3.fromRGB(211, 228, 219)
  local BAD = Color3.fromRGB(205, 75, 75)

  local gui = Instance.new("ScreenGui")
  gui.Name = "ULTVerification"
  gui.ResetOnSpawn = false
  gui.IgnoreGuiInset = true
  gui.DisplayOrder = 999999998
  gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
  gui.Parent = pg

  local blur = Instance.new("BlurEffect")
  blur.Name = "ULTVerificationBlur"
  blur.Size = 0
  blur.Parent = Lighting
  TweenService:Create(blur, TweenInfo.new(0.3), { Size = 14 }):Play()

  local shade = Instance.new("Frame", gui)
  shade.Size = UDim2.fromScale(1, 1)
  shade.BackgroundColor3 = Color3.fromRGB(15, 24, 22)
  shade.BackgroundTransparency = 0.45
  shade.BorderSizePixel = 0
  shade.ZIndex = 1

  local window = Instance.new("Frame", gui)
  window.Name = "MainWindow"
  window.AnchorPoint = Vector2.new(0.5, 0.5)
  window.Position = UDim2.fromScale(0.5, 0.5)
  window.Size = UDim2.fromOffset(560, 650)
  window.BackgroundColor3 = SURFACE
  window.BorderSizePixel = 0
  window.ClipsDescendants = true
  window.BackgroundTransparency = 1
  window.ZIndex = 3
  Instance.new("UICorner", window).CornerRadius = UDim.new(0, 18)
  local stroke = Instance.new("UIStroke", window)
  stroke.Color = BORDER
  stroke.Thickness = 1
  stroke.Transparency = 1

  local uiscale = Instance.new("UIScale", window)
  uiscale.Scale = 0.94
  pcall(function()
    local cam = workspace.CurrentCamera
    local function fit()
      local vp = (cam and cam.ViewportSize) or Vector2.new(1280, 720)
      uiscale.Scale = math.clamp(math.min((vp.X - 24) / 560, (vp.Y - 24) / 650), 0.48, 1)
    end
    fit()
    if cam then cam:GetPropertyChangedSignal("ViewportSize"):Connect(fit) end
  end)

  local header = Instance.new("Frame", window)
  header.Size = UDim2.new(1, 0, 0, 68)
  header.BackgroundColor3 = SURFACE
  header.BorderSizePixel = 0
  header.ZIndex = 5
  Instance.new("UICorner", header).CornerRadius = UDim.new(0, 24)
  local headerFiller = Instance.new("Frame", header)
  headerFiller.AnchorPoint = Vector2.new(0, 1)
  headerFiller.Position = UDim2.fromScale(0, 1)
  headerFiller.Size = UDim2.new(1, 0, 0, 24)
  headerFiller.BackgroundColor3 = SURFACE
  headerFiller.BorderSizePixel = 0
  headerFiller.ZIndex = 5
  local headerLine = Instance.new("Frame", header)
  headerLine.AnchorPoint = Vector2.new(0, 1)
  headerLine.Position = UDim2.fromScale(0, 1)
  headerLine.Size = UDim2.new(1, 0, 0, 1)
  headerLine.BackgroundColor3 = BORDER
  headerLine.BorderSizePixel = 0
  headerLine.ZIndex = 6
  local function dot(x, color)
    local item = Instance.new("Frame", header)
    item.Size = UDim2.fromOffset(12, 12)
    item.Position = UDim2.new(0, x, 0.5, -6)
    item.BackgroundColor3 = color
    item.BorderSizePixel = 0
    item.ZIndex = 7
    Instance.new("UICorner", item).CornerRadius = UDim.new(1, 0)
  end
  dot(26, ACCENT)
  dot(48, Color3.fromRGB(207, 213, 211))
  dot(70, Color3.fromRGB(225, 229, 227))
  local headerTitle = Instance.new("TextLabel", header)
  headerTitle.AnchorPoint = Vector2.new(1, 0.5)
  headerTitle.Position = UDim2.new(1, -24, 0.5, 0)
  headerTitle.Size = UDim2.new(0, 300, 0, 28)
  headerTitle.BackgroundTransparency = 1
  headerTitle.Text = "U L T   V E R I F I C A T I O N"
  headerTitle.TextColor3 = MUTED
  headerTitle.Font = Enum.Font.GothamMedium
  headerTitle.TextSize = 13
  headerTitle.TextXAlignment = Enum.TextXAlignment.Right
  headerTitle.ZIndex = 7

  local body = Instance.new("Frame", window)
  body.Position = UDim2.fromOffset(30, 94)
  body.Size = UDim2.new(1, -60, 1, -120)
  body.BackgroundColor3 = Color3.fromRGB(253, 254, 253)
  body.BorderSizePixel = 0
  body.ZIndex = 4
  Instance.new("UICorner", body).CornerRadius = UDim.new(0, 26)
  local bodyStroke = Instance.new("UIStroke", body)
  bodyStroke.Color = BORDER
  bodyStroke.Thickness = 1

  local title = Instance.new("TextLabel", body)
  title.Position = UDim2.fromOffset(28, 28)
  title.Size = UDim2.new(1, -56, 0, 58)
  title.BackgroundTransparency = 1
  title.Text = "ULT\nCHECKS"
  title.TextColor3 = INK
  title.Font = Enum.Font.GothamBlack
  title.TextSize = 26
  title.TextXAlignment = Enum.TextXAlignment.Left
  title.TextYAlignment = Enum.TextYAlignment.Top
  title.ZIndex = 6

  local sub = Instance.new("TextLabel", body)
  sub.Position = UDim2.fromOffset(28, 94)
  sub.Size = UDim2.new(1, -56, 0, 18)
  sub.BackgroundTransparency = 1
  sub.Text = "R U N N I N G   S E C U R I T Y   V E R I F I C A T I O N"
  sub.TextColor3 = MUTED
  sub.Font = Enum.Font.GothamMedium
  sub.TextSize = 10
  sub.TextXAlignment = Enum.TextXAlignment.Left
  sub.ZIndex = 6

  local track = Instance.new("Frame", body)
  track.Position = UDim2.fromOffset(28, 128)
  track.Size = UDim2.new(1, -56, 0, 10)
  track.BackgroundColor3 = SOFT
  track.BorderSizePixel = 0
  track.ZIndex = 6
  Instance.new("UICorner", track).CornerRadius = UDim.new(1, 0)

  local fill = Instance.new("Frame", track)
  fill.Size = UDim2.new(0, 0, 1, 0)
  fill.BackgroundColor3 = ACCENT
  fill.BorderSizePixel = 0
  fill.ZIndex = 7
  Instance.new("UICorner", fill).CornerRadius = UDim.new(1, 0)

  local pct = Instance.new("TextLabel", body)
  pct.AnchorPoint = Vector2.new(1, 0)
  pct.Position = UDim2.new(1, -28, 0, 90)
  pct.Size = UDim2.fromOffset(60, 20)
  pct.BackgroundTransparency = 1
  pct.Text = "0%"
  pct.TextColor3 = ACCENT
  pct.Font = Enum.Font.GothamBold
  pct.TextSize = 13
  pct.TextXAlignment = Enum.TextXAlignment.Right
  pct.ZIndex = 6

  local list = Instance.new("Frame", body)
  list.Position = UDim2.fromOffset(28, 168)
  list.Size = UDim2.new(1, -56, 0, 290)
  list.BackgroundTransparency = 1
  list.ZIndex = 6
  local layout = Instance.new("UIListLayout", list)
  layout.Padding = UDim.new(0, 6)
  layout.SortOrder = Enum.SortOrder.LayoutOrder

  local rows = {}
  local order = 0
  local function row(id, text)
    order = order + 1
    local item = Instance.new("Frame", list)
    item.Size = UDim2.new(1, 0, 0, 50)
    item.BackgroundColor3 = SOFT
    item.BackgroundTransparency = 0.35
    item.BorderSizePixel = 0
    item.LayoutOrder = order
    item.ZIndex = 6
    Instance.new("UICorner", item).CornerRadius = UDim.new(0, 14)
    local itemStroke = Instance.new("UIStroke", item)
    itemStroke.Color = BORDER
    itemStroke.Thickness = 1
    local label = Instance.new("TextLabel", item)
    label.Position = UDim2.fromOffset(18, 0)
    label.Size = UDim2.new(1, -70, 1, 0)
    label.BackgroundTransparency = 1
    label.Text = text
    label.TextColor3 = INK
    label.Font = Enum.Font.GothamMedium
    label.TextSize = 13
    label.TextXAlignment = Enum.TextXAlignment.Left
    label.ZIndex = 7
    local state = Instance.new("TextLabel", item)
    state.AnchorPoint = Vector2.new(1, 0)
    state.Position = UDim2.new(1, -18, 0, 0)
    state.Size = UDim2.fromOffset(76, 50)
    state.BackgroundTransparency = 1
    state.Text = "..."
    state.TextColor3 = MUTED
    state.Font = Enum.Font.GothamBold
    state.TextSize = 11
    state.TextXAlignment = Enum.TextXAlignment.Right
    state.ZIndex = 7
    rows[id] = state
  end

  row("env", "Scanning environment")
  row("integrity", "Verifying loader integrity")
  row("sign", "Checking signatures")
  row("auth", "Validating session credentials")
  row("payload", "Checking execution pipeline")

  local footer = Instance.new("TextLabel", body)
  footer.Position = UDim2.fromOffset(28, 486)
  footer.Size = UDim2.new(1, -56, 0, 16)
  footer.BackgroundTransparency = 1
  footer.Text = "PROTECTED  •  POWERED BY ULT"
  footer.TextColor3 = Color3.fromRGB(132, 153, 147)
  footer.Font = Enum.Font.GothamMedium
  footer.TextSize = 9
  footer.TextXAlignment = Enum.TextXAlignment.Right
  footer.ZIndex = 6

  local dragging = false
  local dragStart, startPosition
  header.InputBegan:Connect(function(event)
    if event.UserInputType == Enum.UserInputType.MouseButton1 or event.UserInputType == Enum.UserInputType.Touch then
      dragging = true
      dragStart = event.Position
      startPosition = window.Position
    end
  end)
  header.InputEnded:Connect(function(event)
    if event.UserInputType == Enum.UserInputType.MouseButton1 or event.UserInputType == Enum.UserInputType.Touch then dragging = false end
  end)
  UserInputService.InputChanged:Connect(function(event)
    if dragging and (event.UserInputType == Enum.UserInputType.MouseMovement or event.UserInputType == Enum.UserInputType.Touch) then
      local delta = event.Position - dragStart
      window.Position = UDim2.new(startPosition.X.Scale, startPosition.X.Offset + delta.X, startPosition.Y.Scale, startPosition.Y.Offset + delta.Y)
    end
  end)

  TweenService:Create(window, TweenInfo.new(0.25), { BackgroundTransparency = 0 }):Play()
  TweenService:Create(stroke, TweenInfo.new(0.25), { Transparency = 0 }):Play()

  _ultUI.ok = true
  _ultUI.progress = function(value, label)
    pcall(function()
      TweenService:Create(fill, TweenInfo.new(0.18), { Size = UDim2.new(value / 100, 0, 1, 0) }):Play()
      pct.Text = tostring(math.floor(value)) .. "%"
      if label then sub.Text = label end
    end)
  end
  _ultUI.mark = function(id, passed)
    pcall(function()
      local state = rows[id]
      if not state then return end
      state.Text = passed and "PASS" or "BLOCKED"
      state.TextColor3 = passed and ACCENT or BAD
    end)
  end
  _ultUI.close = function()
    pcall(function()
      TweenService:Create(window, TweenInfo.new(0.28), { BackgroundTransparency = 1 }):Play()
      TweenService:Create(stroke, TweenInfo.new(0.28), { Transparency = 1 }):Play()
      TweenService:Create(shade, TweenInfo.new(0.28), { BackgroundTransparency = 1 }):Play()
      TweenService:Create(blur, TweenInfo.new(0.28), { Size = 0 }):Play()
      TweenService:Create(uiscale, TweenInfo.new(0.28), { Scale = uiscale.Scale * 0.96 }):Play()
      task.delay(0.34, function() pcall(function() gui:Destroy() blur:Destroy() end) end)
    end)
  end
end)

-- ============ REAL CHECKS DRIVING THE BAR ============
local _ultStages = {
  {
    id = "env", label = "scanning environment", threshold = 0,
    run = function()
      local clean = ${v.antiEnvLog}()
      if not clean then _reportBypass("verify_env", "env_logger_detected") end
      return clean
    end,
  },
  {
    id = "integrity", label = "verifying integrity", threshold = 20,
    run = function()
      local clean = ${v.antiHook}()
      if not clean then _reportBypass("verify_hook", "hook_detected_during_verification") end
      return clean
    end,
  },
  {
    id = "sign", label = "checking signatures", threshold = 40,
    run = function()
      local clean = ${v.verified} and true or false
      if not clean then _reportBypass("verify_ls", "loadstring_integrity_failed") end
      pcall(function()
        if hookcheck and hookcheck(${v.cleanLS}) then
          clean = false
          _reportBypass("verify_cleanls", "clean_loadstring_hooked")
        end
      end)
      return clean
    end,
  },
  {
    id = "auth", label = "validating session credentials", threshold = 60,
    run = function()
      local ok = type(fp) == "table"
        and fp.u ~= nil and tostring(fp.u) ~= ""
        and fp.t ~= nil and fp.nonce ~= nil
        and tk ~= nil and tk ~= ""
        and ${v.session} ~= nil and ${v.session} ~= ""
      return ok and true or false
    end,
  },
  {
    id = "payload", label = "checking execution pipeline", threshold = 80,
    run = function()
      return type(${v.cleanLS}) == "function"
        and type(${v.indirectExec}) == "function"
        and type(${v.hexBytes}) == "function"
        and type(${v.xorBytes}) == "function"
        and type(${v.bytesToString}) == "function"
        and type(kb) == "table" and #kb > 0
    end,
  },
}

local _ultNextStage = 1
for i = 0, 100 do
  while _ultStages[_ultNextStage] and i >= _ultStages[_ultNextStage].threshold do
    local stage = _ultStages[_ultNextStage]
    local okCall, result = pcall(stage.run)
    local passed = okCall and result and true or false
    if _ultUI.ok then
      _ultUI.progress(i, stage.label)
      _ultUI.mark(stage.id, passed)
    end
    _ultNextStage = _ultNextStage + 1
  end

  local filled = math.floor(i / 100 * 30)
  local bar = string.rep("#", filled) .. string.rep("-", 30 - filled)
  local text = string.format("ULT | Loading: [%s] %d%%", bar, i)

  pcall(function()
    for _, v in ipairs(CoreGui:GetDescendants()) do
      if v:IsA("TextLabel") and v.Text:find("Loading:", 1, true) then
        v.Text = text
      end
    end
  end)

  if _ultUI.ok then _ultUI.progress(i) end
  task.wait(0.04)
end

for flash = 1, 3 do
  pcall(function()
    for _, v in ipairs(CoreGui:GetDescendants()) do
      if v:IsA("TextLabel") and v.Text:find("Loading:", 1, true) then
        v.TextColor3 = Color3.fromRGB(0, 255, 0)
      end
    end
  end)

  task.wait(0.25)

  pcall(function()
    for _, v in ipairs(CoreGui:GetDescendants()) do
      if v:IsA("TextLabel") and v.Text:find("Loading:", 1, true) then
        v.TextColor3 = Color3.fromRGB(255, 255, 255)
      end
    end
  end)

  task.wait(0.25)
end

pcall(function()
  for _, v in ipairs(CoreGui:GetDescendants()) do
    if v:IsA("TextLabel") and v.Text:find("Loading:", 1, true) then
      v.Text = "ULT | Loaded! [##############################] 100%"
      v.TextColor3 = Color3.fromRGB(255, 255, 255)
    end
  end
end)
if _ultUI.ok then
  _ultUI.progress(100, "verification complete")
  task.wait(0.2)
  _ultUI.close()
end

-- ============ PERSISTENT MONITOR BADGE ============
-- Small green top-middle label that lives after the verification window closes,
-- so users can see the runtime bypass monitor is still watching in the background.
pcall(function()
  local Players = game:GetService("Players")
  local TweenService = game:GetService("TweenService")
  local player = Players.LocalPlayer
  if not player then return end
  local pg = player:FindFirstChildOfClass("PlayerGui") or player:WaitForChild("PlayerGui", 5)
  if not pg then return end
  local old = pg:FindFirstChild("ULTMonitor")
  if old then old:Destroy() end

  local gui = Instance.new("ScreenGui")
  gui.Name = "ULTMonitor"
  gui.ResetOnSpawn = false
  gui.IgnoreGuiInset = true
  gui.DisplayOrder = 999999997
  gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
  gui.Parent = pg

  local badge = Instance.new("Frame", gui)
  badge.AnchorPoint = Vector2.new(0.5, 0)
  badge.Position = UDim2.new(0.5, 0, 0, 12)
  badge.Size = UDim2.fromOffset(196, 28)
  badge.BackgroundColor3 = Color3.fromRGB(232, 246, 236)
  badge.BackgroundTransparency = 0.05
  badge.BorderSizePixel = 0
  Instance.new("UICorner", badge).CornerRadius = UDim.new(1, 0)
  local stroke = Instance.new("UIStroke", badge)
  stroke.Color = Color3.fromRGB(104, 190, 151)
  stroke.Thickness = 1

  local dot = Instance.new("Frame", badge)
  dot.AnchorPoint = Vector2.new(0, 0.5)
  dot.Position = UDim2.new(0, 12, 0.5, 0)
  dot.Size = UDim2.fromOffset(8, 8)
  dot.BackgroundColor3 = Color3.fromRGB(52, 168, 108)
  dot.BorderSizePixel = 0
  Instance.new("UICorner", dot).CornerRadius = UDim.new(1, 0)

  local label = Instance.new("TextLabel", badge)
  label.AnchorPoint = Vector2.new(0.5, 0.5)
  label.Position = UDim2.new(0.5, 8, 0.5, 0)
  label.Size = UDim2.new(1, -32, 1, 0)
  label.BackgroundTransparency = 1
  label.Text = "ULT  •  MONITORING ACTIVE"
  label.TextColor3 = Color3.fromRGB(28, 92, 62)
  label.Font = Enum.Font.GothamBold
  label.TextSize = 12
  label.TextXAlignment = Enum.TextXAlignment.Center

  -- Gentle pulse so the user sees it is live
  task.spawn(function()
    while gui.Parent do
      TweenService:Create(dot, TweenInfo.new(0.9, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut), { BackgroundTransparency = 0.55 }):Play()
      task.wait(0.95)
      TweenService:Create(dot, TweenInfo.new(0.9, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut), { BackgroundTransparency = 0 }):Play()
      task.wait(0.95)
    end
  end)
end)

-- ============ BACKGROUND BYPASS MONITOR ============
-- Runs AFTER the verification UI unloads. Watches ONLY our own protection
-- surface — loader integrity, environment/loadstring hooks, canary tripwires.
-- We do NOT scan the paste's source for words like "writefile"/"hookfunction",
-- because those are legitimate APIs innocent scripts use all the time.
-- Only actual hook/logger/exfil BEHAVIOR against the loader itself trips this.
do
  -- Capture protection refs BEFORE the post-exec scrub nils them
  local _monHook   = ${v.antiHook}
  local _monEnv    = ${v.antiEnvLog}
  local _monLog    = ${v.antiLogger}
  local _monDump   = ${v.antiDump}
  task.spawn(function()
    local checks = {
      { name = "monitor_hook",   fn = _monHook, reason = "runtime_loadstring_hook_after_load" },
      { name = "monitor_envlog", fn = _monEnv,  reason = "runtime_env_logger_after_load" },
      { name = "monitor_logger", fn = _monLog,  reason = "runtime_logger_after_load" },
      { name = "monitor_dump",   fn = _monDump, reason = "runtime_dump_tool_after_load" },
    }
    -- Give the payload ~2s to initialize (avoids flagging its own boot code)
    task.wait(2)
    for _ = 1, 30 do -- ~60s of monitoring, then rely on ghost traps/canaries
      for _, c in ipairs(checks) do
        if type(c.fn) == "function" then
          local ok, clean = pcall(c.fn)
          if ok and clean == false then
            pcall(function() _reportBypass(c.name, c.reason) end)
          end
        end
      end
      task.wait(2)
    end
  end)
end





-- Execute HTTP request
local s, r = ${v.hookGuard}.pcall_ref(function()
  return ${v.cachedHG}(game, url)
end)

if not s then
  s, r = ${v.hookGuard}.pcall_ref(function()
    return game:HttpGet(url)
  end)
end

if s and r then
  if r == "" then
    warn("Empty response")
    return
  end

  -- ====== POST-FETCH ANTI-HOOK CHECK ======
  if not ${v.antiHook}() then
    _reportBypass("post_fetch_hook", "hook_after_network_request")
  end

  -- v9.5: Re-check hookcheck after fetch (attacker might hook during network wait)
  pcall(function()
    if hookcheck and hookcheck(loadstring) and not ${v.clonedLS} then
      _reportBypass("post_fetch_ls_hook", "loadstring_hooked_post_fetch")
    end
    -- Also check if our cleanLS got swapped
    if hookcheck and hookcheck(${v.cleanLS}) then
      _reportBypass("cleanls_hooked", "clean_loadstring_compromised")
      -- cleanLS itself is hooked now! Try to recover
      pcall(function()
        if getoriginalfunction then
          ${v.cleanLS} = getoriginalfunction(${v.cleanLS})
        elseif restorefunction then
          restorefunction(${v.cleanLS})
        end
      end)
    end
  end)

  -- Handle refresh loader response
  if r:sub(1,2) == "--" then
    local rf, re = ${v.indirectExec}(r)
    if rf then return rf() end
    warn("Protection error")
    return
  end

  -- v10.2: CHUNKED ANTI-LOADSTRING-HOOK FORMAT
  if r:sub(1,6) == "ULT_C:" then
    local ${v.chunkHeaderEnd} = r:find("|", 1, true)
    if not ${v.chunkHeaderEnd} then warn("E:cf"); return end
    local ${v.chunkHeader} = r:sub(7, ${v.chunkHeaderEnd} - 1)
    local _ncStr, _sdStr = ${v.chunkHeader}:match("(%d+):(%d+)")
    local _numC = tonumber(_ncStr)
    local _seedC = tonumber(_sdStr)
    if not _numC or not _seedC then warn("E:ch"); return end

    local ${v.chunkData} = r:sub(${v.chunkHeaderEnd} + 1)
    r = nil

    local ${v.chunkParts} = {}
    local _ci = 1
    for _ch in ${v.chunkData}:gmatch("[^|]+") do
      ${v.chunkParts}[_ci] = _ch
      _ci = _ci + 1
    end
    ${v.chunkData} = nil

    -- Reproduce Fisher-Yates shuffle with same Lehmer PRNG
    local ${v.chunkIndices} = {}
    for i = 0, _numC - 1 do ${v.chunkIndices}[i] = i end
    local _ss = _seedC
    for i = _numC - 1, 1, -1 do
      _ss = (_ss * 16807) % 2147483647
      local j = _ss % (i + 1)
      ${v.chunkIndices}[i], ${v.chunkIndices}[j] = ${v.chunkIndices}[j], ${v.chunkIndices}[i]
    end

    local ${v.chunkResult} = {}
    for pos = 0, _numC - 1 do
      ${v.chunkResult}[${v.chunkIndices}[pos]] = ${v.chunkParts}[pos + 1]
    end
    ${v.chunkParts} = nil

    local _pieces = {}
    for origIdx = 0, _numC - 1 do
      local _chHex = ${v.chunkResult}[origIdx]
      if not _chHex or #_chHex == 0 then break end
      local _ck = ks .. ":C" .. tostring(origIdx) .. ":" .. tostring(_numC)
      local _ckb = {}
      for i = 1, #_ck do _ckb[i] = string.byte(_ck, i) end
      local _rb = ${v.hexBytes}(_chHex)
      local _db = ${v.xorBytes}(_rb, _ckb)
      _pieces[origIdx + 1] = ${v.bytesToString}(_db)
    end
    ${v.chunkResult} = nil

    local _assembled = table.concat(_pieces)
    _pieces = nil

    -- v15.1: code mutation removed (per policy: never mutate bytecode on bypass — caused silent loadstring failures on false positives)

    local ${v.execFunc}, _err = ${v.indirectExec}(_assembled)
    _assembled = nil

    -- v12.2: Decoys run AFTER execution (non-blocking)
    task.defer(${v.decoyFlood})

    if ${v.execFunc} then
      local _co = coroutine.create(function() return ${v.execFunc}() end)
      coroutine.resume(_co)
      ${v.execFunc} = nil
      _co = nil

      pcall(function()
        for i = 1, #kb do kb[i] = math.random(0, 255) end
        ${v.cleanLS} = nil
        ${v.cachedLS} = nil
        ${v.cachedHG} = nil
        ${v.hookGuard} = nil
        ${v.indirectExec} = nil
        ${v.antiHook} = nil
        ${v.antiEnvLog} = nil
        ${v.antiLogger} = nil
        ${v.antiDump} = nil
        ${v.antiDebug} = nil
        ${v.execSandbox} = nil
        ${v.dnaHash} = 0
        ${v.morphSeed} = 0
        collectgarbage("collect")
        collectgarbage("collect")
      end)

      pcall(function()
        rawset(_G, "${ghostId}", setmetatable({}, {
          __index = function(_, k)
            pcall(function()
              game:HttpGet("${baseUrl}?_report=post_exec_dump&ghost=${ghostId}&wm=${watermarkId}")
            end)
            return nil
          end,
          __tostring = function() return "nil" end,
        }))
        task.delay(5, function()
          pcall(function() rawset(_G, "${ghostId}", nil) end)
        end)
      end)
    else
      if _err ~= "hook_detected" and _err ~= "env_logger_detected" and _err ~= "logger_detected" then
        warn("E:" .. tostring(_err))
      end
    end
    return
  end

  -- Handle encrypted response (legacy hex format)
  if ${v.isHex}(r) then
    local rawBytes = ${v.hexBytes}(r)
    r = nil

    -- Final security sweep
    if not ${v.antiHook}() or not ${v.antiEnvLog}() or not ${v.antiLogger}() or not ${v.antiDump}() then
      _reportBypass("final_sweep", "bypass_detected_at_decrypt")
    end

    local decoded = ${v.xorBytes}(rawBytes, kb)
    rawBytes = nil
    local code = ${v.bytesToString}(decoded)
    decoded = nil

    -- v15.1: code mutation removed (policy: log bypass attempts only, do NOT corrupt code — caused false-positive silent crashes)

    -- v9.5: Chunked assembly + indirect execution
    -- Split code into chunks, compile each separately, then reassemble
    -- This prevents a single loadstring hook from capturing the full source
    local ${v.execFunc}, execErr
    
    if ${v.verified} and not ${v.dumpPoison} then
      -- Trusted path: use indirect execution via coroutine
      ${v.execFunc}, execErr = ${v.indirectExec}(code)
    else
      -- Degraded path: still compile but with poisoned code
      ${v.execFunc}, execErr = ${v.indirectExec}(code)
    end
    
    code = nil
    
    if ${v.execFunc} then
      -- v10: Execute inside coroutine then SCRAMBLE memory
      local execCo = coroutine.create(function()
        return ${v.execFunc}()
      end)
      local execOk = coroutine.resume(execCo)
      ${v.execFunc} = nil
      execCo = nil
      
      -- ====== v10: POST-EXECUTION MEMORY SCRAMBLE ======
      -- After execution, poison all local references so decompilers/dumpers
      -- that scan memory post-execution get garbage
      pcall(function()
        -- Overwrite the key bytes with random data
        for i = 1, #kb do
          kb[i] = math.random(0, 255)
        end
        -- Null out all protection references
        ${v.cleanLS} = nil
        ${v.cachedLS} = nil
        ${v.cachedHG} = nil
        ${v.hookGuard} = nil
        ${v.indirectExec} = nil
        ${v.antiHook} = nil
        ${v.antiEnvLog} = nil
        ${v.antiLogger} = nil
        ${v.antiDump} = nil
        ${v.antiDebug} = nil
        ${v.execSandbox} = nil
        ${v.dnaHash} = 0
        ${v.morphSeed} = 0
        -- Force garbage collection to actually free the memory
        collectgarbage("collect")
        collectgarbage("collect")
      end)
      
      -- v10: Plant post-execution ghost trap
      -- If someone tries to dump memory AFTER execution, they trigger this
      pcall(function()
        rawset(_G, "${ghostId}", setmetatable({}, {
          __index = function(_, k)
            -- Someone is inspecting this value = dump attempt
            pcall(function()
              game:HttpGet("${baseUrl}?_report=post_exec_dump&ghost=${ghostId}&wm=${watermarkId}")
            end)
            return nil
          end,
          __tostring = function() return "nil" end,
        }))
        -- Self-destruct after 5 seconds
        task.delay(5, function()
          pcall(function() rawset(_G, "${ghostId}", nil) end)
        end)
      end)
    else
      if execErr ~= "hook_detected" and execErr ~= "env_logger_detected" and execErr ~= "logger_detected" then
        warn("E:" .. tostring(execErr))
      end
    end
    return
  end

  -- Plain Lua response (key system GUI, kick messages, etc.)
  local pf, pe = ${v.indirectExec}(r)
  if pf then return pf() end
  warn("E:" .. tostring(pe))
else
  warn("Network error")
end
`;
}

// ===== ULT LOADER V6.1 KEY SYSTEM GUI =====
function generateKeySystemGui(slug: string, baseUrl: string, panelName: string, themeColor: string, decalId?: string): string {
  const colorParts = (themeColor || '104, 190, 151').split(',').map((value) => value.trim());
  const r = colorParts[0] || '104';
  const g = colorParts[1] || '190';
  const b = colorParts[2] || '151';
  const safePanelName = panelName.replace(/["\\\r\n]/g, ' ').trim() || 'ULT CLOUD';
  const logoSection = decalId ? `
local logo = Instance.new("ImageLabel", header)
logo.Size = UDim2.fromOffset(24, 24)
logo.Position = UDim2.new(0, 92, 0.5, -12)
logo.BackgroundTransparency = 1
logo.Image = "rbxassetid://${decalId}"
logo.ScaleType = Enum.ScaleType.Fit
logo.ZIndex = 8
` : '';

  return `-- ULT Loader v6.1
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local HttpService = game:GetService("HttpService")
local Lighting = game:GetService("Lighting")

local player = Players.LocalPlayer or Players.PlayerAdded:Wait()
local playerGui = player:WaitForChild("PlayerGui")
local oldGui = playerGui:FindFirstChild("ULTKeySystem")
if oldGui then oldGui:Destroy() end
local oldBlur = Lighting:FindFirstChild("ULTLoaderBlur")
if oldBlur then oldBlur:Destroy() end

local ACCENT = Color3.fromRGB(${r}, ${g}, ${b})
local INK = Color3.fromRGB(20, 32, 30)
local MUTED = Color3.fromRGB(82, 105, 100)
local SURFACE = Color3.fromRGB(250, 253, 251)
local SOFT = Color3.fromRGB(231, 244, 237)
local BORDER = Color3.fromRGB(211, 228, 219)
local ERROR = Color3.fromRGB(205, 75, 75)
local WARNING = Color3.fromRGB(211, 137, 53)

local gui = Instance.new("ScreenGui")
gui.Name = "ULTKeySystem"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = true
gui.DisplayOrder = 999999999
gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
gui.Parent = playerGui

local blur = Instance.new("BlurEffect")
blur.Name = "ULTLoaderBlur"
blur.Size = 0
blur.Parent = Lighting
TweenService:Create(blur, TweenInfo.new(0.3), {Size = 14}):Play()

local shade = Instance.new("Frame", gui)
shade.Size = UDim2.fromScale(1, 1)
shade.BackgroundColor3 = Color3.fromRGB(15, 24, 22)
shade.BackgroundTransparency = 0.5
shade.BorderSizePixel = 0
shade.ZIndex = 1

local window = Instance.new("Frame", gui)
window.Name = "MainWindow"
window.AnchorPoint = Vector2.new(0.5, 0.5)
window.Position = UDim2.fromScale(0.5, 0.5)
window.Size = UDim2.fromOffset(560, 650)
window.BackgroundColor3 = SURFACE
window.BorderSizePixel = 0
window.ClipsDescendants = true
window.ZIndex = 3
Instance.new("UICorner", window).CornerRadius = UDim.new(0, 18)
local windowStroke = Instance.new("UIStroke", window)
windowStroke.Color = BORDER
windowStroke.Thickness = 1

local scale = Instance.new("UIScale", window)
local function updateScale()
    local camera = workspace.CurrentCamera
    local viewport = camera and camera.ViewportSize or Vector2.new(1280, 720)
    scale.Scale = math.clamp(math.min((viewport.X - 24) / 560, (viewport.Y - 24) / 650), 0.48, 1)
end
updateScale()
if workspace.CurrentCamera then
    workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(updateScale)
end

local header = Instance.new("Frame", window)
header.Size = UDim2.new(1, 0, 0, 68)
header.BackgroundColor3 = SURFACE
header.BorderSizePixel = 0
header.ZIndex = 5
Instance.new("UICorner", header).CornerRadius = UDim.new(0, 24)
local headerBottomFiller = Instance.new("Frame", header)
headerBottomFiller.AnchorPoint = Vector2.new(0, 1)
headerBottomFiller.Position = UDim2.fromScale(0, 1)
headerBottomFiller.Size = UDim2.new(1, 0, 0, 24)
headerBottomFiller.BackgroundColor3 = SURFACE
headerBottomFiller.BorderSizePixel = 0
headerBottomFiller.ZIndex = 5
local headerLine = Instance.new("Frame", header)
headerLine.AnchorPoint = Vector2.new(0, 1)
headerLine.Position = UDim2.fromScale(0, 1)
headerLine.Size = UDim2.new(1, 0, 0, 1)
headerLine.BackgroundColor3 = BORDER
headerLine.BorderSizePixel = 0
headerLine.ZIndex = 6

local function dot(x, color)
    local item = Instance.new("Frame", header)
    item.Size = UDim2.fromOffset(12, 12)
    item.Position = UDim2.new(0, x, 0.5, -6)
    item.BackgroundColor3 = color
    item.BorderSizePixel = 0
    item.ZIndex = 7
    Instance.new("UICorner", item).CornerRadius = UDim.new(1, 0)
end
dot(26, ACCENT)
dot(48, Color3.fromRGB(207, 213, 211))
dot(70, Color3.fromRGB(225, 229, 227))
${logoSection}
local headerTitle = Instance.new("TextLabel", header)
headerTitle.AnchorPoint = Vector2.new(1, 0.5)
headerTitle.Position = UDim2.new(1, -24, 0.5, 0)
headerTitle.Size = UDim2.new(0, 270, 0, 28)
headerTitle.BackgroundTransparency = 1
headerTitle.Text = "U L T   L O A D E R   V 6 . 1"
headerTitle.TextColor3 = MUTED
headerTitle.Font = Enum.Font.GothamMedium
headerTitle.TextSize = 13
headerTitle.TextXAlignment = Enum.TextXAlignment.Right
headerTitle.ZIndex = 7

local body = Instance.new("Frame", window)
body.Position = UDim2.fromOffset(30, 94)
body.Size = UDim2.new(1, -60, 1, -120)
body.BackgroundColor3 = Color3.fromRGB(253, 254, 253)
body.BorderSizePixel = 0
body.ZIndex = 4
Instance.new("UICorner", body).CornerRadius = UDim.new(0, 26)
local bodyStroke = Instance.new("UIStroke", body)
bodyStroke.Color = BORDER
bodyStroke.Thickness = 1

local eyebrow = Instance.new("TextLabel", body)
eyebrow.Position = UDim2.fromOffset(28, 25)
eyebrow.Size = UDim2.fromOffset(220, 42)
eyebrow.BackgroundTransparency = 1
eyebrow.Text = "I N S T A N T\\nD E L I V E R Y"
eyebrow.TextColor3 = Color3.fromRGB(43, 157, 107)
eyebrow.Font = Enum.Font.GothamMedium
eyebrow.TextSize = 13
eyebrow.TextXAlignment = Enum.TextXAlignment.Left
eyebrow.TextYAlignment = Enum.TextYAlignment.Top
eyebrow.ZIndex = 6

local brand = Instance.new("TextLabel", body)
brand.Position = UDim2.fromOffset(28, 75)
brand.Size = UDim2.fromOffset(250, 65)
brand.BackgroundTransparency = 1
brand.Text = "ULT\\nCLOUD"
brand.TextColor3 = INK
brand.Font = Enum.Font.GothamBold
brand.TextSize = 26
brand.TextXAlignment = Enum.TextXAlignment.Left
brand.TextYAlignment = Enum.TextYAlignment.Top
brand.ZIndex = 6

local badge = Instance.new("TextLabel", body)
badge.Position = UDim2.new(1, -158, 0, 78)
badge.Size = UDim2.fromOffset(128, 36)
badge.BackgroundColor3 = SOFT
badge.Text = "R E A D Y"
badge.TextColor3 = Color3.fromRGB(43, 157, 107)
badge.Font = Enum.Font.GothamBold
badge.TextSize = 11
badge.ZIndex = 6
Instance.new("UICorner", badge).CornerRadius = UDim.new(1, 0)
local badgeStroke = Instance.new("UIStroke", badge)
badgeStroke.Color = Color3.fromRGB(170, 218, 194)

local inputCard = Instance.new("Frame", body)
inputCard.Position = UDim2.fromOffset(28, 151)
inputCard.Size = UDim2.new(1, -56, 0, 86)
inputCard.BackgroundColor3 = SOFT
inputCard.BorderSizePixel = 0
inputCard.ZIndex = 5
Instance.new("UICorner", inputCard).CornerRadius = UDim.new(0, 18)
local inputStroke = Instance.new("UIStroke", inputCard)
inputStroke.Color = Color3.fromRGB(177, 219, 198)

local prompt = Instance.new("TextLabel", inputCard)
prompt.Position = UDim2.fromOffset(18, 12)
prompt.Size = UDim2.new(1, -36, 0, 20)
prompt.BackgroundTransparency = 1
prompt.Text = "Enter your key >"
prompt.TextColor3 = MUTED
prompt.Font = Enum.Font.Code
prompt.TextSize = 17
prompt.TextXAlignment = Enum.TextXAlignment.Left
prompt.ZIndex = 7

local input = Instance.new("TextBox", inputCard)
input.Position = UDim2.fromOffset(18, 37)
input.Size = UDim2.new(1, -36, 0, 34)
input.BackgroundTransparency = 1
input.Text = ""
input.PlaceholderText = "XXXXX-XXXXX-XXXXX"
input.PlaceholderColor3 = Color3.fromRGB(132, 153, 147)
input.TextColor3 = INK
input.Font = Enum.Font.Code
input.TextSize = 19
input.TextXAlignment = Enum.TextXAlignment.Left
input.ClearTextOnFocus = false
input.ZIndex = 7

local progressTitle = Instance.new("TextLabel", body)
progressTitle.Position = UDim2.fromOffset(28, 257)
progressTitle.Size = UDim2.new(1, -130, 0, 34)
progressTitle.BackgroundTransparency = 1
progressTitle.Text = "A N I M A T E D   V E R I F I C A T I O N\\nP R O G R E S S"
progressTitle.TextColor3 = MUTED
progressTitle.Font = Enum.Font.GothamMedium
progressTitle.TextSize = 10
progressTitle.TextXAlignment = Enum.TextXAlignment.Left
progressTitle.ZIndex = 6

local progressPercent = Instance.new("TextLabel", body)
progressPercent.Position = UDim2.new(1, -92, 0, 264)
progressPercent.Size = UDim2.fromOffset(64, 20)
progressPercent.BackgroundTransparency = 1
progressPercent.Text = "0%"
progressPercent.TextColor3 = MUTED
progressPercent.Font = Enum.Font.GothamMedium
progressPercent.TextSize = 12
progressPercent.TextXAlignment = Enum.TextXAlignment.Right
progressPercent.ZIndex = 6

local progressTrack = Instance.new("Frame", body)
progressTrack.Position = UDim2.fromOffset(28, 300)
progressTrack.Size = UDim2.new(1, -56, 0, 10)
progressTrack.BackgroundColor3 = Color3.fromRGB(224, 234, 229)
progressTrack.BorderSizePixel = 0
progressTrack.ZIndex = 5
Instance.new("UICorner", progressTrack).CornerRadius = UDim.new(1, 0)
local progressFill = Instance.new("Frame", progressTrack)
progressFill.Size = UDim2.fromScale(0, 1)
progressFill.BackgroundColor3 = ACCENT
progressFill.BorderSizePixel = 0
progressFill.ZIndex = 6
Instance.new("UICorner", progressFill).CornerRadius = UDim.new(1, 0)
local gradient = Instance.new("UIGradient", progressFill)
gradient.Color = ColorSequence.new({ColorSequenceKeypoint.new(0, Color3.fromRGB(104, 190, 151)), ColorSequenceKeypoint.new(1, INK)})

local function statCard(y, title, value)
    local card = Instance.new("Frame", body)
    card.Position = UDim2.fromOffset(28, y)
    card.Size = UDim2.new(1, -56, 0, 58)
    card.BackgroundColor3 = SURFACE
    card.BorderSizePixel = 0
    card.ZIndex = 5
    Instance.new("UICorner", card).CornerRadius = UDim.new(0, 14)
    local stroke = Instance.new("UIStroke", card)
    stroke.Color = BORDER
    local label = Instance.new("TextLabel", card)
    label.Position = UDim2.fromOffset(18, 8)
    label.Size = UDim2.new(0.5, -18, 0, 16)
    label.BackgroundTransparency = 1
    label.Text = title
    label.TextColor3 = MUTED
    label.Font = Enum.Font.GothamMedium
    label.TextSize = 9
    label.TextXAlignment = Enum.TextXAlignment.Left
    label.ZIndex = 6
    local result = Instance.new("TextLabel", card)
    result.Position = UDim2.fromOffset(18, 27)
    result.Size = UDim2.new(1, -36, 0, 22)
    result.BackgroundTransparency = 1
    result.Text = value
    result.TextColor3 = INK
    result.Font = Enum.Font.GothamBold
    result.TextSize = 14
    result.TextXAlignment = Enum.TextXAlignment.Left
    result.ZIndex = 6
    return result
end
local responseValue = statCard(330, "R E S P O N S E", "Waiting")
local payloadValue = statCard(400, "P A Y L O A D", "Encrypted")
local consoleValue = statCard(470, "C O N S O L E", "Ready")

local submit = Instance.new("TextButton", body)
submit.Position = UDim2.new(1, -146, 0, 255)
submit.Size = UDim2.fromOffset(118, 38)
submit.BackgroundColor3 = ACCENT
submit.Text = "VALIDATE"
submit.TextColor3 = INK
submit.Font = Enum.Font.GothamBold
submit.TextSize = 11
submit.AutoButtonColor = false
submit.ZIndex = 8
Instance.new("UICorner", submit).CornerRadius = UDim.new(1, 0)

local panelLabel = Instance.new("TextLabel", body)
panelLabel.Position = UDim2.fromOffset(28, 531)
panelLabel.Size = UDim2.new(1, -56, 0, 16)
panelLabel.BackgroundTransparency = 1
panelLabel.Text = "${safePanelName}  •  POWERED BY ULT"
panelLabel.TextColor3 = Color3.fromRGB(132, 153, 147)
panelLabel.Font = Enum.Font.GothamMedium
panelLabel.TextSize = 9
panelLabel.TextXAlignment = Enum.TextXAlignment.Right
panelLabel.ZIndex = 6

local dragging = false
local dragStart, startPosition
header.InputBegan:Connect(function(event)
    if event.UserInputType == Enum.UserInputType.MouseButton1 or event.UserInputType == Enum.UserInputType.Touch then
        dragging = true
        dragStart = event.Position
        startPosition = window.Position
    end
end)
header.InputEnded:Connect(function(event)
    if event.UserInputType == Enum.UserInputType.MouseButton1 or event.UserInputType == Enum.UserInputType.Touch then dragging = false end
end)
UserInputService.InputChanged:Connect(function(event)
    if dragging and (event.UserInputType == Enum.UserInputType.MouseMovement or event.UserInputType == Enum.UserInputType.Touch) then
        local delta = event.Position - dragStart
        window.Position = UDim2.new(startPosition.X.Scale, startPosition.X.Offset + delta.X, startPosition.Y.Scale, startPosition.Y.Offset + delta.Y)
    end
end)

local function setState(label, percent, consoleText, color)
    badge.Text = label
    badge.TextColor3 = color or Color3.fromRGB(43, 157, 107)
    progressPercent.Text = tostring(percent) .. "%"
    consoleValue.Text = consoleText
    TweenService:Create(progressFill, TweenInfo.new(0.28, Enum.EasingStyle.Quad), {Size = UDim2.fromScale(percent / 100, 1)}):Play()
end

local function closeAndRun(compiled)
    setState("S Y N C E D", 100, "Load complete", Color3.fromRGB(43, 157, 107))
    responseValue.Text = "0.2s"
    submit.Text = "LOADED"
    task.wait(0.35)
    TweenService:Create(window, TweenInfo.new(0.3), {BackgroundTransparency = 1}):Play()
    TweenService:Create(shade, TweenInfo.new(0.3), {BackgroundTransparency = 1}):Play()
    TweenService:Create(blur, TweenInfo.new(0.3), {Size = 0}):Play()
    task.wait(0.32)
    gui:Destroy()
    blur:Destroy()
    local ok, runError = pcall(compiled)
    if not ok then warn("[ULT] Exec error: " .. tostring(runError)) end
end

local validating = false
local function reset(message, color)
    setState("E R R O R", 0, message, color)
    responseValue.Text = message
    submit.Text = "TRY AGAIN"
    input.TextEditable = true
    validating = false
end

local function validateKey()
    if validating then return end
    local enteredKey = input.Text:gsub("^%s+", ""):gsub("%s+$", "")
    if #enteredKey < 3 then reset("Key too short", ERROR) return end
    validating = true
    input.TextEditable = false
    submit.Text = "VERIFYING"
    responseValue.Text = "Checking key"
    setState("L O A D I N G", 28, "Verifying secure route", ACCENT)

    task.spawn(function()
        local url = "${baseUrl}?key=" .. HttpService:UrlEncode(enteredKey) .. "&uid=" .. tostring(player.UserId) .. "&_=" .. tostring(tick())
        local success, response = pcall(function() return game:HttpGet(url) end)
        if not success then reset("Network error", ERROR) return end
        if not response or #response == 0 then reset("Empty response", ERROR) return end
        setState("L O A D I N G", 64, "Fetching protected payload", ACCENT)

        if response:sub(1, 17) == "KEY_VALID_SCRIPT:" then
            local scriptCode = response:sub(18):gsub("^[\\r\\n%s]+", "")
            local compileOk, compiled = pcall(function() return loadstring(scriptCode) end)
            if not compileOk or not compiled then reset("Payload failed to compile", ERROR) return end
            payloadValue.Text = "Verified + encrypted"
            closeAndRun(compiled)
        elseif response:find("KEY_ASSIGNED", 1, true) then
            reset("Key belongs to another user", ERROR)
        elseif response:find("KEY_EXPIRED", 1, true) then
            reset("Key has expired", WARNING)
        elseif response:find("KEY_INVALID", 1, true) then
            reset("Invalid key", ERROR)
        else
            reset("Access denied", ERROR)
        end
    end)
end

submit.MouseButton1Click:Connect(validateKey)
input.FocusLost:Connect(function(enterPressed)
    if enterPressed then validateKey() end
end)
submit.MouseEnter:Connect(function()
    TweenService:Create(submit, TweenInfo.new(0.15), {BackgroundTransparency = 0.12}):Play()
end)
submit.MouseLeave:Connect(function()
    TweenService:Create(submit, TweenInfo.new(0.15), {BackgroundTransparency = 0}):Play()
end)
window.Size = UDim2.fromOffset(520, 610)
window.BackgroundTransparency = 1
TweenService:Create(window, TweenInfo.new(0.35, Enum.EasingStyle.Quad), {Size = UDim2.fromOffset(560, 650), BackgroundTransparency = 0}):Play()
`;
}
// v17.2: every kick payload leaves the function wrapped with trap-link comments.
// A real Roblox client still runs the Kick line. A dumper (Discord bot, HttpGet
// save-to-file, browser dev tools) reading the file sees the trap URLs first —
// visiting any of them permanently bans that identity.
function trapHeader(): string {
  const host = Deno.env.get('PUBLIC_SITE_URL')?.replace(/^https?:\/\//, '').replace(/\/+$/, '')
    || 'ultluacodeprotectsyourluacode.onrender.com';
  const tok = generateToken().slice(0, 24);
  return `-- ULT LUA Protected Script\n-- Source manifest: https://${host}/s/source_${tok}\n-- Compatibility manifest: https://${host}/s/source_${tok}?m=1\n-- Revision manifest: https://${host}/s/source_${tok}?b=1\n`;
}

function generatePermanentDenyDecoy(): string {
  return `${trapHeader()}-- Runtime compatibility metadata\nlocal manifest = { channel = "stable", revision = "${generateToken().slice(0, 12)}" }\nreturn manifest\n`;
}

function generateKickPlain(reason: string): string {
  return `${trapHeader()}game:GetService("Players").LocalPlayer:Kick("${reason}")\n`;
}

function generateKickEncrypted(reason: string, slug: string, token: string, uid: string): string {
  const kickScript = `game:GetService("Players").LocalPlayer:Kick("${reason}")`;
  const key = `${slug}:${token}:ULTv9:${uid}`;
  return xorToHex(kickScript, key);
}

function generateHoneypot(): string {
  // A honeypot response must terminate safely. Never inspect unrelated globals,
  // contact third-party URLs, mutate the runtime, or create unbounded loops.
  return `-- ULT Protection: unauthorized delivery route
local player = game:GetService("Players").LocalPlayer
if player then
  player:Kick("ULT Protection: unauthorized access was blocked and logged.")
end
return nil`;
}

// ===== v12: ADVANCED PROTECTION HELPERS =====

// Geo-blocking: Check IP country using Cloudflare headers
function getCountryFromHeaders(headers: Headers): string {
  return (headers.get('cf-ipcountry') || headers.get('x-country-code') || '').toUpperCase();
}

// Execution limit check
async function checkExecutionLimit(paste: any, uid: string, supabaseClient: any): Promise<boolean> {
  if (!paste.execution_limit_enabled || !paste.execution_limit_per_user || paste.execution_limit_per_user <= 0) return true;
  
  const windowMs: Record<string, number> = {
    'hourly': 3600000,
    'daily': 86400000,
    'weekly': 604800000,
  };
  const window = windowMs[paste.execution_limit_window] || 86400000;
  const windowStart = new Date(Date.now() - window).toISOString();
  
  const { data: existing } = await supabaseClient
    .from('paste_execution_counts')
    .select('id, count')
    .eq('paste_id', paste.id)
    .eq('roblox_user_id', uid)
    .gte('window_start', windowStart)
    .order('window_start', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (existing && existing.count >= paste.execution_limit_per_user) return false;
  
  // Increment
  if (existing) {
    await supabaseClient.from('paste_execution_counts').update({ count: existing.count + 1 }).eq('id', existing.id);
  } else {
    await supabaseClient.from('paste_execution_counts').insert({ paste_id: paste.id, roblox_user_id: uid, count: 1 });
  }
  return true;
}

// Multi-account detection
async function checkMultiAccount(paste: any, uid: string, hwid: string | null, supabaseClient: any): Promise<{ allowed: boolean; flagged: boolean }> {
  if (!paste.multi_account_detection || !hwid || hwid.length < 4) return { allowed: true, flagged: false };
  
  try {
    const { data: existing, error } = await supabaseClient
      .from('paste_multi_account_flags')
      .select('*')
      .eq('paste_id', paste.id)
      .eq('hwid', hwid)
      .maybeSingle();
    
    if (error) {
      console.error('[v12] Multi-account query error:', error.message);
      return { allowed: true, flagged: false }; // fail open
    }
    
    if (existing) {
      if (existing.is_blocked) return { allowed: false, flagged: true };
      const ids: string[] = existing.roblox_user_ids || [];
      if (!ids.includes(uid)) {
        ids.push(uid);
        const flagged = ids.length > 1;
        supabaseClient.from('paste_multi_account_flags')
          .update({ roblox_user_ids: ids, is_blocked: ids.length > 3, flagged_at: new Date().toISOString() })
          .eq('id', existing.id).then(() => {}, () => {});
        if (ids.length > 3) return { allowed: false, flagged: true };
        return { allowed: true, flagged };
      }
      return { allowed: true, flagged: ids.length > 1 };
    } else {
      supabaseClient.from('paste_multi_account_flags')
        .upsert({ paste_id: paste.id, hwid, roblox_user_ids: [uid] }, { onConflict: 'paste_id,hwid' })
        .then(() => {}, () => {});
      return { allowed: true, flagged: false };
    }
  } catch (e) {
    console.error('[v12] Multi-account detection error:', e);
    return { allowed: true, flagged: false }; // fail open, don't crash
  }
}

// Crash detection Lua wrapper
function wrapWithCrashDetection(code: string): string {
  const trapVar = '_' + Math.random().toString(36).substring(2, 10);
  const checkVar = '_' + Math.random().toString(36).substring(2, 10);
  return `-- ULT Crash Detection v12
local ${trapVar} = false
local ${checkVar} = coroutine.create(function()
  local ok, err = pcall(function()
    -- If someone hooks decompile/debug.getinfo, this triggers
    local info = debug and debug.getinfo and debug.getinfo(1) or nil
    if info and info.source and info.source:find("decompile") then
      ${trapVar} = true
    end
  end)
end)
pcall(function() coroutine.resume(${checkVar}) end)
if ${trapVar} then
  -- Detected decompile/debug hook - corrupt environment
  pcall(function()
    rawset(_G, "loadstring", function() return function() end end)
    rawset(_G, "game", setmetatable({}, {__index = function() return function() end end}))
  end)
  while true do wait(9e9) end
  return
end
${code}`;
}

// Webhook alert (fire-and-forget) — supports rich event types and per-paste event filtering
function fireWebhookAlert(paste: any, uid: string, ip: string, hwid: string | null, eventType: string, extra?: Record<string, any>) {
  if (!paste.webhook_alerts_enabled || !paste.webhook_url) return;
  const webhookUrl = paste.webhook_url;
  if (!webhookUrl.startsWith('https://discord.com/api/webhooks/') && 
      !webhookUrl.startsWith('https://canary.discord.com/api/webhooks/') &&
      !webhookUrl.startsWith('https://ptb.discord.com/api/webhooks/')) return;

  // Per-paste event filter — only fire if event category is enabled
  const enabledEvents: string[] = Array.isArray(paste.webhook_events) ? paste.webhook_events : ['redeem','exec','ban','bypass'];
  const cat =
    eventType === 'execution' ? 'exec' :
    eventType.startsWith('ban') || eventType.includes('blocked') ? 'ban' :
    eventType.includes('bypass') || eventType.includes('hook') || eventType.includes('vm') ? 'bypass' :
    eventType.includes('redeem') || eventType.includes('key') || eventType.includes('hwid') ? 'redeem' :
    'exec';
  if (!enabledEvents.includes(cat)) return;

  const titleMap: Record<string,string> = {
    execution: 'Script Executed',
    time_bomb_expired: 'Time Bomb Expired',
    execution_limit_reached: 'Execution Limit Reached',
    multi_account_blocked: 'Multi-Account Blocked',
    geo_blocked: 'Geo-Blocked Region',
    executor_blocked: 'Blacklisted Executor',
    vm_detected: 'Virtual Machine Detected',
    hook_detected: 'Hooked Function Detected',
    hwid_locked: 'HWID Locked',
    hwid_reset: 'HWID Reset',
    key_redeemed: 'Key Redeemed',
    key_transferred: 'Key Transferred',
    bypass_attempt: 'Bypass Attempt',
    version_mismatch: 'Outdated Script Version',
  };
  const colorMap: Record<string,number> = {
    execution: 0x9b87f5, key_redeemed: 0x57f287, hwid_locked: 0x5865f2,
    bypass_attempt: 0xed4245, executor_blocked: 0xed4245, vm_detected: 0xed4245,
    hook_detected: 0xed4245, multi_account_blocked: 0xed4245, time_bomb_expired: 0xfee75c,
  };

  const fields: any[] = [
    { name: 'Roblox ID', value: uid || 'unknown', inline: true },
    { name: 'IP', value: `||${ip || 'unknown'}||`, inline: true },
    { name: 'HWID', value: hwid ? `\`${hwid.substring(0, 16)}...\`` : 'N/A', inline: true },
  ];
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v == null) continue;
      fields.push({ name: k, value: String(v).substring(0, 256), inline: true });
    }
  }

  const embed = {
    embeds: [{
      title: titleMap[eventType] || `Event: ${eventType}`,
      description: `**Paste:** ${paste.title || paste.slug}`,
      color: colorMap[eventType] ?? 0x9b87f5,
      fields,
      timestamp: new Date().toISOString(),
      footer: { text: 'ULT Cloud Protection' },
    }],
  };

  fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(embed),
  }).then(undefined, () => {});
}

// Re-obfuscation on delivery — structurally transform the code each time.
// IMPORTANT: We do NOT wrap user code in an inner function. Wrapping breaks:
//   - top-level `return` statements (very common in module-style scripts)
//   - vararg `...` (becomes nil inside a non-vararg inner function)
//   - getfenv/setfenv level assumptions
// Instead, we only PREPEND randomized junk locals at chunk scope. This changes
// the bytecode/string hash on every delivery without altering execution semantics.
function applyDeliveryObfuscation(code: string): string {
  const vars = Array.from({ length: 6 }, () => '_' + Math.random().toString(36).substring(2, 10));
  const junkLines: string[] = [];
  for (const v of vars) {
    const n = Math.floor(Math.random() * 999999);
    junkLines.push(`local ${v}=${n};`);
  }
  // Random no-op pcall wrapper line (still chunk-level, no scoping change)
  const noop = '_' + Math.random().toString(36).substring(2, 10);
  junkLines.push(`local ${noop}=function() return ${Math.floor(Math.random() * 99999)} end; ${noop}();`);
  // All junk on a single leading line so user line numbers stay close to original
  return junkLines.join(' ') + '\n' + code;
}

// Main v12 protection gate — runs before content delivery
async function applyV12Protections(
  paste: any, uid: string, clientIp: string, hwid: string | null,
  slug: string, tk: string, supabaseClient: any, baseUrl: string
): Promise<Response | null> {
  const textHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'text/plain',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  };

  // 1. Time Bomb — check if paste has expired
  if (paste.time_bomb_enabled && paste.time_bomb_expires_at) {
    if (new Date(paste.time_bomb_expires_at) < new Date()) {
      console.log(`[v12] TIME_BOMB: paste ${paste.id} expired at ${paste.time_bomb_expires_at}`);
      fireWebhookAlert(paste, uid, clientIp, hwid, 'time_bomb_expired');
      return new Response(generateKickEncrypted('This script has expired', slug, tk, uid), {
        status: 200, headers: textHeaders,
      });
    }
  }

  // 2. Execution Limit
  if (paste.execution_limit_enabled) {
    const allowed = await checkExecutionLimit(paste, uid, supabaseClient);
    if (!allowed) {
      console.log(`[v12] EXEC_LIMIT: uid=${uid} paste=${paste.id} limit=${paste.execution_limit_per_user}/${paste.execution_limit_window}`);
      fireWebhookAlert(paste, uid, clientIp, hwid, 'execution_limit_reached');
      return new Response(generateKickEncrypted(`Execution limit reached (${paste.execution_limit_per_user} per ${paste.execution_limit_window})`, slug, tk, uid), {
        status: 200, headers: textHeaders,
      });
    }
  }

  // 3. Multi-Account Detection
  if (paste.multi_account_detection) {
    const maResult = await checkMultiAccount(paste, uid, hwid, supabaseClient);
    if (!maResult.allowed) {
      console.log(`[v12] MULTI_ACCOUNT: blocked hwid on paste ${paste.id} uid=${uid}`);
      fireWebhookAlert(paste, uid, clientIp, hwid, 'multi_account_blocked');
      return new Response(generateKickEncrypted('Multiple accounts detected on this device - access blocked', slug, tk, uid), {
        status: 200, headers: textHeaders,
      });
    }
    if (maResult.flagged) {
      fireWebhookAlert(paste, uid, clientIp, hwid, 'multi_account_flagged');
    }
  }

  return null; // All checks passed
}

const _ultHandle = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // v12.2: Non-blocking ban refresh — only await on first load (cache empty)
  if (globalBanCache.lastRefresh === 0) {
    await refreshGlobalBans();
  } else {
    refreshGlobalBans().catch(() => {});
  }

  // ===== PERMANENT BAN CHECK — first thing, zero processing =====
  const earlyIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                  req.headers.get('cf-connecting-ip') || 'unknown';
  const earlyUrl = new URL(req.url);
  const earlySlug = earlyUrl.searchParams.get('slug') || '';
  const earlyTrapMatch = earlyUrl.pathname.match(/\/(?:trap|source)[\/_]([A-Za-z0-9_-]{4,64})\/?$/)
    || earlyUrl.pathname.match(/\/s\/(?:trap|source)_([A-Za-z0-9_-]{4,64})\/?$/)
    || earlySlug.match(/^(?:trap|source)_([A-Za-z0-9_-]{4,64})$/);
  if (isPermanentlyBanned(earlyIp) && !earlyTrapMatch) {
    // Auto-resolve and mark as auto-banned since they're already globally banned
    supabase.from('threat_log').insert({
      threat_type: 'banned_ip_access', source_ip: earlyIp, roblox_user_id: null,
      discord_user_id: null, details: { action: 'blocked_at_gate' }, severity: 'high',
      resolved: true, auto_banned: true,
    }).then(() => {}, (e: any) => console.error('Threat log failed:', e));
    const bannedUa = req.headers.get('user-agent') || '';
    const bannedHost = Deno.env.get('PUBLIC_SITE_URL')?.replace(/^https?:\/\//, '').replace(/\/+$/, '') || 'ultluacodeprotectsyourluacode.onrender.com';
    if (isLikelyBrowserRequest(req.headers) && !isRobloxLikeUserAgent(bannedUa)) {
      return new Response(null, { status: 302, headers: { ...corsHeaders, Location: `https://${bannedHost}/blocked?reason=banned` } });
    }
    // Non-Roblox fetches (Discord bots, curl, node-fetch, proxies) get trap-baited
    // fake source instead of the raw kick text. Following the trap link bans them.
    if (!isRobloxLikeUserAgent(bannedUa)) {
      const bannedTrap = generateToken().slice(0, 24);
      const bannedSupaBase = new URL(req.url).origin;
      const trapBody = `-- ULT LUA Protected Script\n-- Source manifest: https://${bannedHost}/s/source_${bannedTrap}\n-- Compatibility manifest: ${bannedSupaBase}/functions/v1/get-paste/source/${bannedTrap}\n-- Revision manifest: https://${bannedHost}/s/source_${bannedTrap}?m=1\n\nreturn (function() return nil end)()\n`;
      return new Response(trapBody, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
    }
    return new Response(generatePermanentDenyDecoy(), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
  }

  // Periodic map cleanup
  cleanupMaps();

  // GLOBAL LOAD SHEDDING — protect DB from being overwhelmed
  if (!checkGlobalLoad()) {
    return new Response('-- Server busy, try again shortly\ngame:GetService("Players").LocalPlayer:Kick("Server is busy. Please rejoin.")', {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    });
  }

  try {
    const url = new URL(req.url);

    // ===== ANTI-FETCH TRAP ENDPOINT =====
    // Anti-fetch returns fake "source" containing a trap URL. Anyone who visits
    // it (browser OR executor HttpGet) is treated exactly like an unauthorized
    // backend visitor: permanent ban across every linked identifier, then a
    // redirect / kick response.
    // Match both supabase-style (/get-paste/trap/<token>) and domain-style
    // (/s/trap_<token>) so anti-fetch traps ban visitors on either host.
    const slugFromQuery = url.searchParams.get('slug') || '';
    const trapMatch = url.pathname.match(/\/(?:trap|source)[\/_]([A-Za-z0-9_-]{4,64})\/?$/)
      || url.pathname.match(/\/s\/(?:trap|source)_([A-Za-z0-9_-]{4,64})\/?$/)
      || slugFromQuery.match(/^(?:trap|source)_([A-Za-z0-9_-]{4,64})$/);
    if (trapMatch) {
      const trapToken = trapMatch[1];
      const trapUa = req.headers.get('user-agent') || '';
      const trapIsBrowser = isLikelyBrowserRequest(req.headers) && !isRobloxLikeUserAgent(trapUa);
      let trapDiscord: string | null = null;
      try {
        const { data: ds } = await supabase
          .from('discord_oauth_sessions')
          .select('discord_user_id')
          .eq('ip_address', earlyIp)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();
        trapDiscord = ds?.discord_user_id ?? null;
      } catch { /* fail open on lookup only */ }

      await banIdentity(
        { ip: earlyIp, discordId: trapDiscord },
        'anti_fetch_trap_visit',
        {
          source: 'anti_fetch_trap',
          token: trapToken,
          via: trapIsBrowser ? 'browser' : 'executor_or_tool',
          user_agent: trapUa.substring(0, 300),
          path: url.pathname,
        },
      ).catch(() => {});
      logThreat('anti_fetch_trap_visit', earlyIp, null, trapDiscord, {
        token: trapToken, via: trapIsBrowser ? 'browser' : 'executor_or_tool',
        user_agent: trapUa.substring(0, 200),
      }, 'critical', true);
      globalBanCache.lastRefresh = 0;

      if (trapIsBrowser) {
        const host = Deno.env.get('PUBLIC_SITE_URL')?.replace(/^https?:\/\//, '').replace(/\/+$/, '')
          || 'ultluacodeprotectsyourluacode.onrender.com';
        return new Response(null, {
          status: 302,
          headers: { ...corsHeaders, Location: `https://${host}/blocked?reason=trap` },
        });
      }
      return new Response(
        generatePermanentDenyDecoy(),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } },
      );
    }


    
    // ===== BYPASS REPORT ENDPOINT =====
    // When the Lua loader detects a bypass attempt, it calls this to instantly global-ban the attacker
    const reportAction = url.searchParams.get('_report');
    if (reportAction) {
      // AUTO-BAN: Anyone accessing _report URLs from a BROWSER gets instantly banned
      // These URLs should ONLY be called by the Lua loader from within Roblox
      const reportUa = req.headers.get('user-agent') || '';
      const isBrowserReport = isLikelyBrowserRequest(req.headers);
      
      if (isBrowserReport) {
        console.log(`[get-paste] BROWSER ACCESS TO _report URL: ip=${earlyIp} action=${reportAction}`);
        autoBanNewIp(earlyIp, `browser_access_report_endpoint_${reportAction}`, null, null);
        logThreat('browser_report_access', earlyIp, null, null, {
          report_action: reportAction,
          user_agent: reportUa.substring(0, 200),
          action: 'auto_banned_browser_report_access',
        }, 'critical', true);
        return new Response('', { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
      }
      
      if (reportAction === 'bypass') {
      const reportUid = url.searchParams.get('uid') || '';
      const reportHwid = url.searchParams.get('hwid') || '';
      const reportDiscord = url.searchParams.get('did') || '';
      const reportReason = url.searchParams.get('reason') || 'bypass_attempt';
      const reportDetails = url.searchParams.get('details') || '';
      const shouldAutoBan = shouldAutoBanBypassReason(reportReason, reportDetails);

      console.log(`[get-paste] BYPASS REPORT: uid=${reportUid} ip=${earlyIp} reason=${reportReason} details=${reportDetails}`);

      // v17: high-confidence exfiltration evidence -> unified permanent ban across
      // every linked identifier (ip, roblox, discord, device), with evidence stored.
      if (shouldAutoBan && (isValidRobloxId(reportUid) || reportHwid.length >= 4)) {
        const { banned } = await banIdentity(
          { ip: earlyIp, robloxId: reportUid || null, discordId: reportDiscord || null, hwid: reportHwid || null },
          reportReason,
          {
            source: 'loader_bypass_report',
            reason: reportReason,
            details: reportDetails,
            user_agent: reportUa.substring(0, 300),
            reported_at: new Date().toISOString(),
          },
        );
        logThreat('bypass_attempt_auto_ban', earlyIp, reportUid || null, reportDiscord || null, {
          reason: reportReason, details: reportDetails,
          action: 'permanent_multi_identifier_ban', identifiers_banned: banned.length,
        }, 'critical', true);
        globalBanCache.lastRefresh = 0;
      } else {
        logThreat('bypass_report_logged_only', earlyIp, reportUid || null, reportDiscord || null, {
          reason: reportReason,
          details: reportDetails,
          hwid: reportHwid ? reportHwid.substring(0, 32) : null,
          action: shouldAutoBan ? 'missing_identifiers_logged_only' : 'soft_signal_logged_only',
          user_agent: reportUa.substring(0, 200),
        }, shouldAutoBan ? 'high' : 'medium', false);
      }

      
      // Return empty - don't print warnings in legitimate executor consoles
      return new Response('', { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
      }
      
      // Ghost trap and other report actions
      if (reportAction === 'ghost_trap') {
        const reportUid = url.searchParams.get('uid') || '';
        logThreat('ghost_trap_logged_only', earlyIp, reportUid || null, null, {
          ghost: url.searchParams.get('ghost'),
          wm: url.searchParams.get('wm'),
          action: 'logged_only',
        }, 'high', false);
        return new Response('', { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
      }
      
      // Any other _report action
      return new Response('', { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
    }
    
    // Website rewrites pass ?slug=..., while direct preview delivery can use
    // /get-paste/s/<slug> so every later request keeps a clean query string.
    const pathSlugMatch = url.pathname.match(/\/s\/([^/]+)\/?$/);
    const slug = url.searchParams.get('slug') || (pathSlugMatch ? decodeURIComponent(pathSlugMatch[1]) : null);
    const uid = url.searchParams.get('uid');
    const ts = url.searchParams.get('ts');
    const tk = url.searchParams.get('tk');
    const ss = url.searchParams.get('ss');
    const gid = url.searchParams.get('gid');
    const pid = url.searchParams.get('pid');
    const ex = url.searchParams.get('ex');
    const keyParam = url.searchParams.get('key');
    const kbt = url.searchParams.get('kbt');
    const entropy = url.searchParams.get('entropy');
    const snonce = url.searchParams.get('snonce');
    const oauthTs = url.searchParams.get('oauth_ts');
    // v10: New protection params
    const dna = url.searchParams.get('dna');
    const quantumToken = url.searchParams.get('qt');
    const watermarkId = url.searchParams.get('wm');
    const stackDepth = url.searchParams.get('sd');
    const memFingerprint = url.searchParams.get('mem');
    // v10: Ghost trap report
    const ghostReport = url.searchParams.get('ghost');
    // v11: HWID protection
    const hwid = url.searchParams.get('hwid');

    // v17: DEVICE BAN — a blocked HWID is denied no matter which account or IP it uses.
    // Evasion attempt itself is evidence: permanently ban every linked identifier.
    if (isHwidBanned(hwid)) {
      banIdentity({ ip: earlyIp, robloxId: uid, hwid }, 'banned_device_evasion', {
        source: 'device_gate', slug, hwid: (hwid || '').substring(0, 64),
      }).catch(() => {});
      logThreat('banned_device_access', earlyIp, uid || null, null, {
        slug, hwid: (hwid || '').substring(0, 32), action: 'hwid_banned', ip_auto_banned: true,
      }, 'high', true);
      return new Response(generatePermanentDenyDecoy(), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
    }

    // v17: banned Roblox account — ban the IP and device it came back on
    if (uid && isRobloxIdBanned(uid)) {
      banIdentity({ ip: earlyIp, robloxId: uid, hwid }, 'banned_account_evasion', {
        source: 'account_gate', slug, hwid: hwid ? hwid.substring(0, 64) : null,
      }).catch(() => {});
      logThreat('banned_roblox_access', earlyIp, uid, null, { slug, action: 'roblox_id_banned', ip_auto_banned: true }, 'high', true);
      return new Response(generatePermanentDenyDecoy(), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
    }


    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';
    
    const userAgent = req.headers.get('user-agent') || '';
    const accept = req.headers.get('accept') || '';
    const secFetchMode = req.headers.get('sec-fetch-mode') || '';
    const secFetchDest = req.headers.get('sec-fetch-dest') || '';
    const origin = req.headers.get('origin') || '';
    const referer = req.headers.get('referer') || '';
    
    const validationResult = validateRobloxExecutor(req.headers);
    
    console.log(
      `[get-paste] VALIDATION slug=${slug ?? 'none'} ip=${clientIp} ` +
      `valid=${validationResult.valid} reason=${validationResult.reason} ` +
      `ua="${userAgent.substring(0, 50)}"`
    );
    
    // v9: Update trust score based on timing
    updateTrustScore(clientIp, 0); // register request
    if (!checkFetchTiming(clientIp)) {
      console.log(`[get-paste] SUSPICIOUS fetch timing from ${clientIp}`);
    }
    
    // ===== COMPUTE BROWSER/ROBLOX FLAGS EARLY =====
    const uaLowerFull = userAgent.toLowerCase();
    const isRobloxRequest = isRobloxLikeUserAgent(userAgent);
    const isLikelyBrowser = isLikelyBrowserRequest(req.headers);

    // ===== RAW BACKEND BROWSER VISIT =====
    // Restored original behaviour: browsers reaching the backend host directly
    // are handled normally further below (Discord verification + Hide Code).
    // No automatic ban is created here.

    // ===== BOT DETECTION (NO AUTO-BAN) =====
    // Serve honeypot to bots but do NOT IP-ban them — Discord crawlers, Facebook embeds,
    // and other legitimate services share infrastructure IPs with real users.
    // Banning these IPs is pointless (they rotate) and risks blocking real users.
    if (!isLikelyBrowser && !isRobloxRequest &&
        !validationResult.valid && validationResult.reason !== 'browser_headers' && 
        validationResult.reason !== 'html_accept' && validationResult.reason !== 'origin_referer') {
      console.log(`[get-paste] BOT BLOCKED (no ban): ${validationResult.reason} from ${clientIp} ua="${userAgent.substring(0, 80)}"`);
      // Only log once per IP per hour to avoid flooding threat log with routine bot traffic
      const botLogKey = `bot_log:${clientIp}`;
      const lastBotLog = ipMismatchTracker.get(botLogKey) as any;
      const now = Date.now();
      const lastTs = typeof lastBotLog === 'number' ? lastBotLog : (lastBotLog?.firstSeen ?? 0);
      if (!lastTs || (now - lastTs) > 3600_000) {
        (ipMismatchTracker as any).set(botLogKey, now);
        logThreat('bot_access_attempt', clientIp, uid || null, null, { 
          reason: validationResult.reason, 
          user_agent: userAgent.substring(0, 200),
          slug: slug || 'none',
          action: 'honeypot_served_no_ban',
        }, 'low', true);
      }
      return new Response(generateHoneypot(), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }
    
    // ===== SPOOFED ROBLOX UA DETECTION =====
    // Serve honeypot but do NOT auto-ban — edge cases with unusual Roblox clients
    const spoofCheck = isSpookedRobloxRequest(req.headers);
    if (spoofCheck.spoofed) {
      console.log(`[get-paste] SPOOFED ROBLOX (no ban): ${spoofCheck.reason} from ${clientIp} ua="${userAgent.substring(0, 80)}"`);
      logThreat('spoofed_roblox_ua', clientIp, uid || null, null, {
        reason: spoofCheck.reason,
        user_agent: userAgent.substring(0, 200),
        slug: slug || 'none',
        action: 'honeypot_served_no_ban',
      }, 'medium', true);
      return new Response(generateHoneypot(), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }
    
    // Block spoofed Roblox-Id header (no auto-ban)
    const robloxIdHeader = req.headers.get('roblox-id') || req.headers.get('Roblox-Id') || '';
    if (robloxIdHeader) {
      const robloxIdNum = parseInt(robloxIdHeader, 10);
      if (isNaN(robloxIdNum) || robloxIdNum < 1000) {
        console.log(`[get-paste] BLOCKED: spoofed Roblox-Id="${robloxIdHeader}" from ${clientIp}`);
        logThreat('spoofed_roblox_id', clientIp, null, null, {
          roblox_id_header: robloxIdHeader,
          user_agent: userAgent.substring(0, 200),
          slug: slug || 'none',
          action: 'honeypot_served_no_ban',
        }, 'medium', true);
        return new Response(generateHoneypot(), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }
    }

    // Block curl/wget (no auto-ban — shared hosting IPs)
    const uaLower = userAgent.toLowerCase();
    if (!isLikelyBrowser && (uaLower.includes('curl') || uaLower.includes('wget') || uaLower.includes('libcurl'))) {
      console.log(`[get-paste] BLOCKED: curl/wget ua="${userAgent}" from ${clientIp}`);
      logThreat('curl_tool_access', clientIp, null, null, {
        user_agent: userAgent.substring(0, 200),
        slug: slug || 'none',
        action: 'honeypot_served_no_ban',
      }, 'low', true);
      return new Response(generateHoneypot(), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }
    
    // ===== DISCORD BOT DETECTION (no auto-ban — Discord crawlers share infra IPs) =====
    if (!isLikelyBrowser && !isRobloxRequest && isDiscordBotRequest(req.headers)) {
      console.log(`[get-paste] DISCORD BOT (no ban): from ${clientIp} ua="${userAgent.substring(0, 80)}"`);
      logThreat('discord_bot_access', clientIp, uid || null, null, {
        user_agent: userAgent.substring(0, 200),
        slug: slug || 'none',
        action: 'honeypot_served_no_ban',
      }, 'low', true);
      return new Response(generateHoneypot(), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    if (!checkRateLimit(clientIp)) {
      console.log(`Rate limited: ${clientIp}`);
      return new Response(generateKickPlain('Too many requests - You have been temporarily blocked'), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    if (!slug) {
      return new Response('warn("[ULT] Missing slug")', { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
    }

    // Per-IP-per-slug throttle — stop one IP from hammering the same paste
    if (!checkSlugThrottle(clientIp, slug)) {
      console.log(`Slug throttled: ${clientIp} on ${slug}`);
      return new Response(generateKickPlain('Too many requests for this script - slow down'), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Supabase client is now module-level (reused across requests)

    if (Math.random() < 0.005) {
      try { await supabase.rpc('cleanup_expired_tokens'); } catch {}
    }

    // Use cached paste data to avoid hammering DB
    let paste = getCachedPaste(slug);
    let error = null;
    if (!paste) {
      // Add timeout to DB query to prevent hanging connections
      try {
        const dbPromise = supabase
          .from('pastes')
          .select('*')
          .eq('slug', slug)
          .single();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('DB_TIMEOUT')), 15000)
        );
        const result = await Promise.race([dbPromise, timeoutPromise]) as any;
        paste = result.data;
        error = result.error;
        if (paste) setCachedPaste(slug, paste);
      } catch (e: any) {
        if (e?.message === 'DB_TIMEOUT') {
          console.error(`[get-paste] DB timeout for slug=${slug}`);
          return new Response(generateKickPlain('Server is experiencing high load. Please rejoin.'), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
          });
        }
        throw e;
      }
    }

    if (error || !paste) {
      return new Response('warn("[ULT] Paste not found")', { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
    }

    // ===== v12: GEO-BLOCKING =====
    if (paste.geo_blocking_enabled && paste.geo_blocked_countries && paste.geo_blocked_countries.length > 0) {
      const country = getCountryFromHeaders(req.headers);
      if (country && paste.geo_blocked_countries.includes(country)) {
        console.log(`[v12] GEO_BLOCKED: country=${country} slug=${slug} ip=${clientIp}`);
        return new Response(generateKickPlain('This script is not available in your region'), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }
    }

    console.log(
      `[get-paste] slug=${slug} uid=${uid ?? ''} hasTk=${Boolean(tk)} hasKey=${Boolean(keyParam)} ip=${clientIp} ` +
      `robloxUA=${isRobloxRequest} browser=${isLikelyBrowser} hide=${Boolean(paste.hide_code)} ` +
      `prot=${Boolean(paste.protection_enabled)} pub=${Boolean(paste.public_protection)}`
    );

    const slugStr = slug;
    // Every URL embedded in delivered Lua stays on the public website domain
    // that proxied this request, regardless of hosting provider.
    const publicHost = resolvePublicHost(req, url);
    const baseUrl = publicHost
      ? `https://${publicHost}/s/${encodeURIComponent(slugStr)}`
      : `${supabaseUrl}/functions/v1/get-paste/s/${encodeURIComponent(slugStr)}`;

    const textHeaders = { ...corsHeaders, 'Content-Type': 'text/plain' };
    const shouldShowProtectedBrowserPlaceholder = isLikelyBrowser && !isRobloxRequest && isDirectSlugBrowserView(url) && !paste.hide_code;
    const shouldHideBrowserPasteView = isLikelyBrowser && !isRobloxRequest && !shouldShowProtectedBrowserPlaceholder;

    const respondWithFreshLoader = async () => {
      const newToken = generateToken();
      const sessionSecret = generateSessionSecret(clientIp, Date.now());
      const serverNonce = generateServerNonce();
      const trustLevel = getTrustScore(clientIp);
      // v12.3: MUST await token insert — otherwise phase-2 request arrives before token exists in DB
      await supabase.from('paste_execution_tokens').insert({
        paste_id: paste.id,
        roblox_user_id: '0',
        token: newToken,
        expires_at: new Date(Date.now() + 30000).toISOString(),
        bound_ip: clientIp,
      });
      const loader = generateLoader(slugStr, baseUrl, newToken, sessionSecret, {
        showConsoleFeedback: paste.show_loading_bar !== false,
        serverNonce,
        trustLevel,
      });
      return new Response(loader, { status: 200, headers: textHeaders });
    };

    const logAccess = async (robloxUserId: string | null, accessType: string, enrichWithProfile = false): Promise<string | null> => {
      try {
        if (paste.ip_tracking_enabled === false) return null;
        let discordData: { discord_user_id: string | null; discord_username: string | null; discord_avatar: string | null; discord_created_at: string | null; } = {
          discord_user_id: null, discord_username: null, discord_avatar: null, discord_created_at: null,
        };
        const { data: discordSession } = await supabase
          .from('discord_oauth_sessions')
          .select('*')
          .eq('ip_address', clientIp)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();
        if (discordSession) {
          // Check if this Discord user is globally banned — auto-ban IP too
          if (isDiscordIdBanned(discordSession.discord_user_id)) {
            autoBanNewIp(clientIp, 'banned_discord_user_new_ip', robloxUserId, discordSession.discord_user_id);
            logThreat('banned_discord_access', clientIp, robloxUserId, discordSession.discord_user_id, { action: 'discord_id_banned', ip_auto_banned: true }, 'high', true);
            // Don't return here — still block silently by not serving content
          }
          discordData = {
            discord_user_id: discordSession.discord_user_id,
            discord_username: discordSession.discord_username,
            discord_avatar: discordSession.discord_avatar,
            discord_created_at: discordSession.discord_created_at,
          };
        }
        let robloxProfile: Awaited<ReturnType<typeof fetchRobloxProfile>> | null = null;
        if (robloxUserId && enrichWithProfile) {
          robloxProfile = await fetchRobloxProfile(robloxUserId);
        }
        // Dedupe: when the visitor is Discord-identified, key the row on the Discord
        // account instead of the IP. Discord's OAuth round trip can surface several
        // edge IPs for one human, which previously produced 2-3 rows per visit.
        let q = supabase.from('paste_access_logs').select('id').eq('paste_id', paste.id).eq('access_type', accessType);
        q = discordData.discord_user_id
          ? q.eq('discord_user_id', discordData.discord_user_id)
          : q.eq('ip_address', clientIp);
        q = robloxUserId ? q.eq('roblox_user_id', robloxUserId) : q.is('roblox_user_id', null);
        const { data: existingLogs } = await q.order('last_seen_at', { ascending: false }).limit(1);
        const existingLog = existingLogs?.[0] ?? null;
        const nowIso = new Date().toISOString();
        const updateData: Record<string, unknown> = {
          last_seen_at: nowIso, is_active: true, user_agent: userAgent, ip_address: clientIp, ...discordData,
        };
        if (robloxProfile) {
          updateData.roblox_username = robloxProfile.username;
          updateData.roblox_display_name = robloxProfile.displayName;
          updateData.roblox_avatar_url = robloxProfile.avatarUrl;
          updateData.roblox_created_at = robloxProfile.created;
          updateData.roblox_description = robloxProfile.description;
          updateData.roblox_is_banned = robloxProfile.isBanned;
          updateData.roblox_friends_count = robloxProfile.friendsCount;
          updateData.roblox_followers_count = robloxProfile.followersCount;
          updateData.roblox_following_count = robloxProfile.followingCount;
          updateData.roblox_groups = robloxProfile.groups;
          updateData.roblox_badges = robloxProfile.badges;
          updateData.roblox_favorites = robloxProfile.favorites;
        }
        if (existingLog?.id) {
          await supabase.from('paste_access_logs').update(updateData).eq('id', existingLog.id);
          return existingLog.id;
        } else {
          const { data: newLog } = await supabase.from('paste_access_logs').insert({
            paste_id: paste.id, ip_address: clientIp, roblox_user_id: robloxUserId,
            access_type: accessType, ...updateData,
          }).select('id').single();
          return newLog?.id || null;
        }
      } catch (logError) {
        console.error('Failed to log access:', logError);
        return null;
      }
    };

    const shouldRedirectToDiscord = (): boolean => {
      // Only gate browser visits via Discord OAuth when IP tracking is on
      // and Hide Code is off (Hide Code already serves a blank page to browsers).
      if (!paste.ip_tracking_enabled) return false;
      if (!isLikelyBrowser || isRobloxRequest) return false;
      if (uid || tk) return false;
      const tsNum = oauthTs ? Number(oauthTs) : NaN;
      if (Number.isFinite(tsNum) && Date.now() - tsNum < 60_000) return false;
      return true;
    };

    const getDiscordRedirectResponse = (): Response | null => {
      if (!shouldRedirectToDiscord()) return null;

      const discordClientId = Deno.env.get('DISCORD_APPLICATION_ID');
      if (!discordClientId) return null;

      console.log(`[get-paste] Redirecting browser to Discord OAuth slug=${slug} ip=${clientIp}`);
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, 'Location': `${supabaseUrl}/functions/v1/discord-identify?action=start&slug=${slug}` }
      });
    };

    const getKeyPanelsForPaste = async (): Promise<Array<{ id: string; name: string; created_at: string }>> => {
      const { data: panels, error } = await supabase
        .from('control_panels')
        .select('id, name, created_at')
        .eq('paste_id', paste.id)
        .eq('is_keysystem', true)
        .order('created_at', { ascending: false });

      if (error || !panels || panels.length === 0) return [];
      return panels;
    };

    const getPreferredKeyPanel = async () => {
      const panels = await getKeyPanelsForPaste();
      if (panels.length <= 1) return panels[0] ?? null;

      const panelIds = panels.map((panel) => panel.id);
      const { data: keyedPanels } = await supabase
        .from('control_panel_keys')
        .select('panel_id')
        .in('panel_id', panelIds)
        .order('created_at', { ascending: false })
        .limit(1);

      if (keyedPanels?.[0]?.panel_id) {
        const match = panels.find((panel) => panel.id === keyedPanels[0].panel_id);
        if (match) return match;
      }

      return panels[0];
    };

    // ===== KEY SYSTEM VALIDATION =====
    // When ?key=xxx&uid=xxx is provided, validate the key server-side
    if (keyParam && uid) {
      console.log(`[get-paste] KEY VALIDATION slug=${slug} key=${keyParam.substring(0, 8)}... uid=${uid} ip=${clientIp}`);
      
      const keyPanels = await getKeyPanelsForPaste();
      if (keyPanels.length === 0) {
        return new Response('KEY_INVALID:No key system on this paste', { status: 200, headers: textHeaders });
      }

      const panelIds = keyPanels.map((panel) => panel.id);
      const { data: keyMatches } = await supabase
        .from('control_panel_keys')
        .select('*')
        .in('panel_id', panelIds)
        .eq('key_value', keyParam)
        .order('created_at', { ascending: false })
        .limit(1);

      const keyData = keyMatches?.[0];
      if (!keyData) {
        console.log(`[get-paste] KEY_INVALID: key not found for paste ${paste.id}`);
        return new Response('KEY_INVALID:Wrong key', { status: 200, headers: textHeaders });
      }
      
      // Check expiry
      if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
        console.log(`[get-paste] KEY_EXPIRED: key expired for uid=${uid}`);
        return new Response('KEY_EXPIRED:Key has expired', { status: 200, headers: textHeaders });
      }
      
      // Check user ID assignment - keys MUST be pre-assigned to a Roblox User ID
      if (!keyData.roblox_user_id) {
        // Key is not assigned to any user - reject
        console.log(`[get-paste] KEY_UNASSIGNED: key has no user assigned, rejecting uid=${uid}`);
        return new Response('KEY_INVALID:Key not assigned to any user', { status: 200, headers: textHeaders });
      }
      if (keyData.roblox_user_id !== uid) {
        // Key is assigned to a different user
        console.log(`[get-paste] KEY_ASSIGNED: key belongs to ${keyData.roblox_user_id}, not ${uid}`);
        return new Response('KEY_ASSIGNED:Key belongs to another user', { status: 200, headers: textHeaders });
      }
      // Key is assigned to THIS user - allow
      
      // Key is valid! Log execution
      logAccess(uid, 'key_execution', true).catch(() => {});
      await supabase.from('paste_executions').insert({ paste_id: paste.id, roblox_user_id: uid });
      
      // Also cleanup expired keys occasionally
      if (Math.random() < 0.05) {
        try { await supabase.rpc('cleanup_expired_control_panel_keys'); } catch {}
      }
      
      // Key is valid - return content appropriately
      console.log(`[get-paste] KEY_VALID: access granted uid=${uid} for paste ${paste.id} prot=${paste.protection_enabled} pub=${paste.public_protection}`);
      
      // For protected pastes, generate a bypass token and redirect
      // This keeps key system completely separate from the protection flow
      // protection_key pastes must ALSO pass the _G.ScriptKey gate, so route them
      // through the bypass-token redirect instead of serving the payload directly.
      if (paste.protection_enabled || paste.public_protection || paste.protection_mode === 'protection_key') {
        const bypassToken = generateToken();
        await supabase.from('paste_execution_tokens').insert({
          paste_id: paste.id, roblox_user_id: uid, token: bypassToken,
          expires_at: new Date(Date.now() + 30000).toISOString(),
          bound_ip: clientIp,
        });
        // Return a simple script that re-fetches the paste with the bypass token
        // The paste URL will then skip the key system and serve the normal protection loader
        const redirectScript = paste.protection_mode === 'protection_key'
          ? `-- Panel key validated; validate the loader's protection key in the same handoff.
local _raw = rawget(_G, "ScriptKey")
local _pkey = (_raw == nil) and "" or tostring(_raw):gsub("%s+", "")
if _pkey == "" then error("No protection key set") end
pcall(function() rawset(_G, "ScriptKey", nil) end)
local _url = "${baseUrl}?uid=${uid}&kbt=${bypassToken}&pkey=" .. game:GetService("HttpService"):UrlEncode(_pkey) .. "&_=" .. tostring(tick())
local _code = game:HttpGet(_url)
local _fn, _compileError = loadstring(_code)
if not _fn then error(_compileError or "ULT loader failed to compile") end
_fn()`
          : `-- Key validated, loading protected script...
local _url = "${baseUrl}?uid=${uid}&kbt=${bypassToken}&_=" .. tostring(tick())
local _code = game:HttpGet(_url)
local _fn, _compileError = loadstring(_code)
if not _fn then error(_compileError or "ULT loader failed to compile") end
_fn()`;
        console.log(`[get-paste] KEY_VALID: returning bypass redirect for protected paste ${paste.id}`);
        return new Response(`KEY_VALID_SCRIPT:\n${redirectScript}`, { status: 200, headers: textHeaders });
      }
      
      // For non-protected pastes, still use encrypted delivery — never raw
      const npToken = generateToken();
      const npSessionSecret = generateSessionSecret(clientIp, Date.now());
      await supabase.from('paste_execution_tokens').insert({
        paste_id: paste.id, roblox_user_id: uid, token: npToken,
        expires_at: new Date(Date.now() + 30000).toISOString(),
        bound_ip: clientIp,
      });
      const npLoader = generateLoader(slugStr, baseUrl, npToken, npSessionSecret, {
        showConsoleFeedback: paste.show_loading_bar !== false,
      });
      return new Response(`KEY_VALID_SCRIPT:\n${npLoader}`, { status: 200, headers: textHeaders });
    }

    // ===== v19: AUTHORIZED ENTRY POINT ENFORCEMENT (browsers only) =====
    // The hosted website proxies /s/<slug> here. Browsers using that exact host
    // receive the branded copy page; direct backend browser visits are denied
    // and logged without creating a ban. Executors are unaffected.
    if (isLikelyBrowser && !isRobloxRequest) {
      const forwardedHost = (req.headers.get('x-forwarded-host') || '').toLowerCase().split(',')[0].trim();
      const directBackendHost = url.hostname.toLowerCase();
      const arrivedThroughWebsite = Boolean(
        forwardedHost &&
        forwardedHost !== directBackendHost &&
        !forwardedHost.endsWith('.supabase.co') &&
        !forwardedHost.endsWith('.supabase.in') &&
        url.searchParams.has('slug')
      );

      // Any host that proxies /s/<slug> here serves both browsers and executors.
      // Human visits through that branded route get the copy-loader page; only a
      // raw backend-function browser visit is denied and logged.
      if (arrivedThroughWebsite) {
        return new Response(generateBrandedLoaderPage(slugStr, forwardedHost), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
        });
      }


      // Direct backend browser visit: the hidden backend URL is not for humans.
      // Permanently ban every identifier we can link and redirect to /blocked.
      let discordId: string | null = null;
      try {
        const { data: ds } = await supabase
          .from('discord_oauth_sessions')
          .select('discord_user_id')
          .eq('ip_address', clientIp)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();
        discordId = ds?.discord_user_id ?? null;
      } catch { /* fail open on lookup only */ }

      await logAccess(null, 'browser').catch(() => {});
      await banIdentity(
        { ip: clientIp, discordId },
        'unauthorized_backend_access',
        {
          source: 'raw_backend_browser_visit', slug, host: forwardedHost,
          path: url.pathname, query: url.search.substring(0, 200),
          user_agent: userAgent.substring(0, 300),
        },
      ).catch(() => {});
      logThreat('unauthorized_backend_access', clientIp, null, discordId, {
        source: 'raw_backend_browser_visit', slug, host: forwardedHost,
        path: url.pathname, action: 'permanent_ban',
      }, 'critical', true);
      globalBanCache.lastRefresh = 0;

      const blockedHost = Deno.env.get('PUBLIC_SITE_URL')?.replace(/^https?:\/\//, '').replace(/\/+$/, '')
        || 'ultluacodeprotectsyourluacode.onrender.com';
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: `https://${blockedHost}/blocked?reason=backend` },
      });
    }


    const initialDiscordRedirect = getDiscordRedirectResponse();
    if (initialDiscordRedirect) return initialDiscordRedirect;



    if (shouldShowProtectedBrowserPlaceholder) {
      if (paste.ip_tracking_enabled) {
        console.log(`[get-paste] browser placeholder shown slug=${slug} ip=${clientIp}`);
        await logAccess(null, 'browser');
      }

      return new Response(PROTECTED_BROWSER_PLACEHOLDER, { status: 200, headers: textHeaders });
    }

    if (shouldHideBrowserPasteView) {
      const browserDiscordRedirect = getDiscordRedirectResponse();
      if (browserDiscordRedirect) return browserDiscordRedirect;

      if (paste.ip_tracking_enabled) {
        console.log(`[get-paste] browser visitor logged slug=${slug} ip=${clientIp}`);
        await logAccess(null, 'browser');
      }
      // Only the plain ?slug= browser page may follow normal paste rules when hide_code is off.
      // Tokenized / report / auxiliary browser URLs stay blank.
      return new Response('', { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
    }

    // ===== ANTI-FETCH PROTECTION =====
    // When anti_fetch_enabled, block raw fetches that have NO execution context.
    // Allow through: browser requests, requests with uid (loadstring execution), 
    // requests with tk (token-based auth), requests with kbt (key bypass token).
    // This means loadstring(game:HttpGet("url"))() still works because:
    //   - First request (no uid) returns loader/key system GUI (those paths are handled BELOW)
    //   - Second request from loader has uid+tk, so it passes through here
    // But setclipboard(game:HttpGet("url")) gets blocked because it never sends uid/tk.
    // NOTE: We only block here for NON-protected, NON-keysystem pastes.
    // Protected pastes already return a loader (not raw content) when uid is missing.
    // Key system pastes return the key GUI when uid is missing.

    // Validate non-browser requests for protected pastes
    if ((paste.protection_enabled || paste.public_protection || paste.hide_code) && !isLikelyBrowser) {
      if (!validationResult.valid) {
        console.log(`[get-paste] BLOCKED ${validationResult.reason} for protected paste: ${slug} from ${clientIp}`);
        return new Response(generateHoneypot(), { status: 200, headers: textHeaders });
      }
    }

    // ===== KEY SYSTEM GUI (highest priority) =====
    // If this paste has a key-system panel and there is no execution context yet,
    // always show the in-game key GUI — regardless of protection mode or
    // protection_enabled. Previously this only ran for non-protected pastes, so
    // protected / protection_key pastes never rendered the key UI.
    if (!isLikelyBrowser && !tk && !kbt && !keyParam) {
      const gatePanel = await getPreferredKeyPanel();
      if (gatePanel) {
        console.log(`[get-paste] Returning key system GUI (global gate) paste=${paste.id} panel=${gatePanel.name}`);
        const { data: gatePanelDetails } = await supabase
          .from('control_panels').select('logo_url').eq('id', gatePanel.id).single();
        const gateGui = generateKeySystemGui(slugStr, baseUrl, gatePanel.name, '104, 190, 151', gatePanelDetails?.logo_url || undefined);
        return new Response(gateGui, { status: 200, headers: textHeaders });
      }
    }

    // ===== PROTECTION KEY MODE =====
    // When pastes.protection_mode = 'protection_key', the user must set _G.ScriptKey before loadstring.
    // The loader reads _G.ScriptKey, sends it as ?pkey=, we validate + bind to first roblox uid (anti-spoof).
    if (paste.protection_mode === 'protection_key' && !isLikelyBrowser) {
      const pkey = url.searchParams.get('pkey') || '';

      // Phase 1: no pkey yet → return tiny key-grabber loader that reads _G.ScriptKey
      // NOTE: a key-system bypass token (kbt) must NOT skip this gate. Panel key
      // redemption and _G.ScriptKey are independent layers; both must be satisfied.
      if (!pkey && !tk) {
        // Hardened key grabber: validates key shape, blocks empty/oversized payloads,
        // strips whitespace, and refuses to send if the executor is missing core funcs.
        const keyGrabber = `local ok, err = pcall(function()
  if type(game) ~= "userdata" then return end
  if type(game.HttpGet) ~= "function" then return end
  if type(loadstring) ~= "function" then return end
  local raw = rawget(_G, "ScriptKey")
  if type(raw) ~= "string" and type(raw) ~= "number" then
    raw = ""
  end
  local key = tostring(raw):gsub("%s+", "")
  local Players = game:GetService("Players")
  local p = Players.LocalPlayer
  if not p then
    local s2, r2 = pcall(function() return Players.PlayerAdded:Wait() end)
    if s2 then p = r2 end
  end
  if not p then return end
  if key == "" then
    pcall(function() p:Kick("no key set. assign _G.ScriptKey before loading") end)
    return
  end
  if #key < 4 or #key > 128 then
    pcall(function() p:Kick("invalid key format") end)
    return
  end
  -- Strip the global so it cannot be re-read by other scripts after load.
  pcall(function() rawset(_G, "ScriptKey", nil) end)
  local s, r = pcall(function()
    return game:HttpGet("${baseUrl}?uid=" .. tostring(p.UserId) .. "&pkey=" .. key .. "&_=" .. tostring(tick()))
  end)
  if not s or type(r) ~= "string" or r == "" then return end
  local f, lerr = loadstring(r)
  if type(f) ~= "function" then return end
  -- Run the real loader in a protected call so executor quirks (Xeno, etc.)
  -- never surface as bare 'attempt to call a nil value' in the console.
  local rs, rerr = pcall(f)
  if not rs then
    -- Silent fail; do not spam the console with internal error text.
    return
  end
end)
if not ok then
  -- swallow grabber errors; never surface raw nil-call traces
end`;
        return new Response(keyGrabber, { status: 200, headers: textHeaders });
      }

      // Phase 2: pkey present → validate, bind, and return real encrypted loader
      if (pkey && uid) {
        // === HARDENING LAYER 1: shape validation ===
        if (pkey.length < 4 || pkey.length > 128 || /[\r\n\t\0]/.test(pkey)) {
          return new Response(generateKickPlain('invalid key format'), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
          });
        }

        // === HARDENING LAYER 2: brute-force rate limit per IP ===
        // Count invalid attempts from this IP in the last 5 minutes against this paste.
        try {
          const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
          const { count: badCount } = await supabase
            .from('protection_key_events' as any)
            .select('id', { count: 'exact', head: true })
            .eq('paste_id', paste.id)
            .eq('ip_address', clientIp)
            .in('event_type', ['kick_invalid', 'kick_spoof', 'kick_expired', 'kick_disabled'] as any)
            .gte('created_at', fiveMinAgo) as any;
          if ((badCount || 0) >= 10) {
            return new Response(generateKickPlain('too many failed key attempts. try again in a few minutes'), {
              status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
            });
          }
        } catch { /* fail-open on rate limit lookup */ }

        // === HARDENING LAYER 3: executor signal check ===
        // The key flow only runs from real Roblox HttpGet; reject if request lacks any
        // executor/Roblox markers (already gated by !isLikelyBrowser, but double-guard).
        const ua = (req.headers.get('user-agent') || '').toLowerCase();
        if (!ua && !req.headers.get('roblox-id') && !req.headers.get('roblox-game-id')) {
          // No identifying headers AT ALL — almost certainly a scraper.
          return new Response(generateKickPlain('unauthorized client'), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
          });
        }

        const { data: pkRow } = await supabase
          .from('protection_keys' as any)
          .select('*')
          .eq('paste_id', paste.id)
          .eq('key_value', pkey)
          .maybeSingle() as { data: any };

        const logEvent = (eventType: string, keyId: string | null) => {
          supabase.from('protection_key_events' as any).insert({
            key_id: keyId, paste_id: paste.id, event_type: eventType,
            roblox_user_id: uid, ip_address: clientIp,
            user_agent: req.headers.get('user-agent') || '',
          } as any).then(() => {}, () => {});
        };

        if (!pkRow) {
          logEvent('kick_invalid', null);
          return new Response(generateKickPlain('Incorrect key'), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
          });
        }

        // === HARDENING LAYER 4: explicit disabled-key check (separate event) ===
        if (!pkRow.is_active) {
          logEvent('kick_disabled', pkRow.id);
          return new Response(generateKickPlain('This key has been disabled'), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
          });
        }

        // Expiry check
        if (pkRow.expires_at && new Date(pkRow.expires_at) < new Date()) {
          logEvent('kick_expired', pkRow.id);
          return new Response(generateKickPlain('This key has expired'), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
          });
        }

        // Anti-spoof: bind to first user that uses it; reject anyone else
        if (pkRow.bound_roblox_user_id && pkRow.bound_roblox_user_id !== uid) {
          logEvent('kick_spoof', pkRow.id);
          return new Response(generateKickPlain('This key is bound to another account'), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
          });
        }

        // === HARDENING LAYER 5: IP-jump detection on bound keys ===
        // If a key is bound and has a recorded IP, log when it suddenly changes IP.
        // (Doesn't block — VPN/mobile-data switches are legit — but flags the event.)
        if (pkRow.bound_ip && pkRow.bound_ip !== clientIp) {
          logEvent('ip_change', pkRow.id);
        }

        // First-time use → bind it (also bind HWID if available for anti-spoof)
        if (!pkRow.bound_roblox_user_id) {
          await (supabase.from('protection_keys' as any) as any)
            .update({ bound_roblox_user_id: uid, bound_at: new Date().toISOString(), bound_ip: clientIp })
            .eq('id', pkRow.id);
          logEvent('redeem', pkRow.id);
        }
        logEvent('success', pkRow.id);

        // KEY + WHITELIST COMBO: if this paste also has whitelist entries, the key alone
        // is not enough — the user must ALSO be whitelisted. Run that check here so key mode
        // acts as an EXTRA layer on top of whitelist instead of replacing it.
        try {
          const { data: wlList } = await supabase
            .from('paste_access_control')
            .select('access_type,is_eternal,expires_at,roblox_user_id')
            .eq('paste_id', paste.id)
            .in('access_type', ['whitelist', 'blacklist']);
          const nowMs2 = Date.now();
          const anyWhitelist = (wlList || []).some((e: any) => e.access_type === 'whitelist');
          const userBlacklisted = (wlList || []).some((e: any) => {
            if (e.access_type !== 'blacklist' || e.roblox_user_id !== uid) return false;
            if (e.is_eternal || !e.expires_at) return true;
            const t = Date.parse(e.expires_at);
            return Number.isFinite(t) && t > nowMs2;
          });
          if (userBlacklisted) {
            logEvent('kick_blacklist', pkRow.id);
            return new Response(generateKickPlain('You are blacklisted'), {
              status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
            });
          }
          if (anyWhitelist) {
            const userWhitelisted = (wlList || []).some((e: any) => {
              if (e.access_type !== 'whitelist' || e.roblox_user_id !== uid) return false;
              if (e.is_eternal || !e.expires_at) return true;
              const t = Date.parse(e.expires_at);
              return Number.isFinite(t) && t > nowMs2;
            });
            if (!userWhitelisted) {
              logEvent('kick_not_whitelisted', pkRow.id);
              return new Response(generateKickPlain('Valid key, but you are not whitelisted'), {
                status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
              });
            }
          }
        } catch (e) {
          console.warn('[get-paste] key+whitelist combo check failed (fail-open):', e);
        }

        // Issue a regular execution token + return the standard encrypted loader
        const newToken = generateToken();
        const sessionSecret = generateToken().slice(0, 16);
        await supabase.from('paste_execution_tokens').insert({
          paste_id: paste.id, roblox_user_id: uid, token: newToken,
          expires_at: new Date(Date.now() + 30000).toISOString(), bound_ip: clientIp,
        });
        const pkLoader = generateLoader(slugStr, baseUrl, newToken, sessionSecret, {
          showConsoleFeedback: paste.show_loading_bar !== false,
        });
        return new Response(pkLoader, { status: 200, headers: textHeaders });
      }
    }

    // ===== GLOBAL ANTI-FETCH PROTECTION =====
    // This runs for ALL paste types (protected, public-protection, non-protected).
    // When anti_fetch_enabled is on and there's no execution context (no uid, no tk, no kbt, no key),
    // return a mini loader. setclipboard copies "-- Protected by ULT LUA" (useless).
    // loadstring executes the loader which re-fetches with uid to get the real content.
    if (paste.anti_fetch_enabled && !uid && !tk && !kbt && !keyParam && !isLikelyBrowser) {
      console.log(`[get-paste] ANTI-FETCH: returning trap-baited mini loader slug=${slug} ip=${clientIp}`);
      // Trap URL is embedded as fake "source" comments. If the caller copied the
      // fetch result (setclipboard / writefile / dumper) instead of executing it,
      // any human or bot that follows the link is permanently banned at /trap/.
      // If the caller DID execute the response, the mini-loader below re-fetches
      // with uid and never touches the trap URL, so legitimate loadstring works.
      const trapToken = generateToken().slice(0, 24);
      const trapUrlSupabase = `${baseUrl.replace(/\/get-paste.*$/, '')}/get-paste/source/${trapToken}`;
      const siteHost = Deno.env.get('PUBLIC_SITE_URL')?.replace(/\/+$/, '')
        || 'https://ultluacodeprotectsyourluacode.onrender.com';
      const trapUrlDomain = `${siteHost}/s/source_${trapToken}`;
      const miniLoader = `-- ULT LUA Protected Script
-- Redistribution prohibited. Source is bound to the original loader.
-- Source: ${trapUrlDomain}
-- Mirror: ${trapUrlSupabase}
-- Backup: ${trapUrlDomain}?m=1
local _ok, _err = pcall(function()
  local _p = game:GetService("Players").LocalPlayer
  if not _p then _p = game:GetService("Players").PlayerAdded:Wait() end
  local _s, _r = pcall(function() return game:HttpGet("${baseUrl}?uid=" .. tostring(_p.UserId) .. "&_=" .. tostring(tick())) end)
  if not _s or not _r or _r == "" then return end
  local _f, _e = loadstring(_r)
  if not _f then return end
  _f()
end)`;
      return new Response(miniLoader, { status: 200, headers: textHeaders });
    }


    // ===== NON-PROTECTED PASTE (no protection, no public_protection) =====
    // CRITICAL FIX v10.1: Non-protected pastes now use the same 2-phase encrypted flow.
    // Previously returned raw paste.content — allowing curl with spoofed Roblox UA to steal code.
    // Now: Phase 1 (no tk) → return encrypted loader. Phase 2 (with valid tk) → return encrypted content.
    if (!paste.protection_enabled && !paste.public_protection) {
      const keyPanel = await getPreferredKeyPanel();
      
      if (keyPanel && !tk && !kbt && !isLikelyBrowser && !keyParam) {
        console.log(`[get-paste] Returning key system GUI for paste: ${paste.id} panel: ${keyPanel.name}`);
        const { data: panelDetails } = await supabase.from('control_panels').select('logo_url').eq('id', keyPanel.id).single();
        const gui = generateKeySystemGui(slugStr, baseUrl, keyPanel.name, '104, 190, 151', panelDetails?.logo_url || undefined);
        return new Response(gui, { status: 200, headers: textHeaders });
      }
      
      if (paste.game_restriction_enabled && gid && pid) {
        const { data: gameBindings } = await supabase.from('paste_game_bindings').select('game_id').eq('paste_id', paste.id);
        if (gameBindings && gameBindings.length > 0) {
          const allowedGameIds = gameBindings.map(b => b.game_id);
          const isAllowed = allowedGameIds.includes(gid) || allowedGameIds.includes(pid);
          if (!isAllowed) {
            return new Response(generateKickPlain('This script is not supported on this game'), {
              status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
            });
          }
        }
      }

      // Phase 2: Token validated — serve encrypted content (NEVER raw)
      if (uid && tk && ts && /^\d+$/.test(uid)) {
        const timestamp = parseInt(ts);
        const now = Math.floor(Date.now() / 1000);
        if (isNaN(timestamp) || Math.abs(now - timestamp) > 180) {
          return await respondWithFreshLoader();
        }
        
        const { data: tokenData, error: tokenError } = await supabase
          .from('paste_execution_tokens')
          .select('*')
          .eq('token', tk)
          .eq('paste_id', paste.id)
          .maybeSingle();
        
        if (tokenError || !tokenData) return await respondWithFreshLoader();
        if (tokenData.used_at) return await respondWithFreshLoader();
        if (new Date(tokenData.expires_at) < new Date()) return await respondWithFreshLoader();
        // v10.4: IP binding — reject mismatched tokens but DON'T auto-ban on first occurrence
        // Legitimate users can have IP changes (VPN, mobile network, ISP rotation) between the two requests
        if (tokenData.bound_ip && tokenData.bound_ip !== clientIp) {
          console.log(`[get-paste] TOKEN IP MISMATCH: bound=${tokenData.bound_ip} actual=${clientIp} slug=${slug}`);
          const isBanWorthy = shouldBanForIpMismatch(clientIp);
          logThreat('token_ip_mismatch', clientIp, uid, null, {
            bound_ip: tokenData.bound_ip, actual_ip: clientIp, slug,
            action: isBanWorthy ? 'token_rejected_auto_ban' : 'token_rejected_retry',
          }, isBanWorthy ? 'high' : 'low', isBanWorthy);
          if (isBanWorthy) {
            autoBanNewIp(clientIp, 'repeated_token_theft_ip_mismatch', uid, null);
            return new Response(QUIET_ACCESS_DENIED_LUA, { status: 200, headers: textHeaders });
          }
          // Not ban-worthy yet — just give them a fresh loader with their CURRENT IP
          return await respondWithFreshLoader();
        }
        
        // Mark token as used
        await supabase.from('paste_execution_tokens')
          .update({ used_at: new Date().toISOString(), roblox_user_id: uid })
          .eq('id', tokenData.id).is('used_at', null);
        
        // v12: Protection checks for non-protected pastes too
        paste._ua = req.headers.get('user-agent') || '';
        const v12NonProtResult = await applyV12Protections(paste, uid, clientIp, hwid, slug, tk, supabase, baseUrl);
        if (v12NonProtResult) return v12NonProtResult;

        logAccess(uid, 'execution', true).catch(() => {});
        supabase.from('paste_executions').insert({ paste_id: paste.id, roblox_user_id: uid }).then(() => {}, () => {});
        
        fireWebhookAlert(paste, uid, clientIp, hwid, 'execution');

        let nonProtContent = paste.content;
        if (paste.crash_detection_enabled) nonProtContent = wrapWithCrashDetection(nonProtContent);
        if (paste.obfuscation_on_delivery) nonProtContent = applyDeliveryObfuscation(nonProtContent);

        // Return ENCRYPTED content — never raw
        const key = `${slug}:${tk}:ULTv9:${uid}:${entropy || '0'}`;
        const trustLevel = getTrustScore(clientIp);
        // v10.2: Always use chunked encryption (anti-loadstring-hook)
        return new Response(chunkEncrypt(nonProtContent, key), { status: 200, headers: textHeaders });
      }
      
      // Phase 1: No token — serve the loader (which will call back with uid+tk)
      // This is the ONLY path for initial requests. curl gets a loader, not raw code.
      if (!isLikelyBrowser && !isRobloxRequest) {
        console.log(`[get-paste] BLOCKED: non-roblox non-browser on non-prot paste slug=${slug} ip=${clientIp}`);
        return new Response(generateHoneypot(), { status: 200, headers: textHeaders });
      }
      
      // Browser visitors — ALWAYS blank screen, never expose code
      if (shouldHideBrowserPasteView) {
        const browserDiscordRedirect = getDiscordRedirectResponse();
        if (browserDiscordRedirect) return browserDiscordRedirect;

        if (paste.ip_tracking_enabled) await logAccess(null, 'browser');
        return new Response('', { status: 200, headers: textHeaders });
      }
      
      // Roblox client — serve loader that will call back with token for encrypted content
      return await respondWithFreshLoader();
    }

    // ===== PROTECTED PASTE - needs loader =====
    if (!uid || !ts || !tk) {
      // ===== KEY BYPASS TOKEN - comes from key system after validation =====
      if (kbt && uid && /^\d+$/.test(uid)) {
        // Validate the bypass token
        const { data: bypassData } = await supabase
          .from('paste_execution_tokens')
          .select('*')
          .eq('token', kbt)
          .eq('paste_id', paste.id)
          .is('used_at', null)
          .maybeSingle();

        if (bypassData && new Date(bypassData.expires_at) > new Date()) {
          // v10.4: Validate IP binding on bypass token — don't auto-ban on first mismatch
          if (bypassData.bound_ip && bypassData.bound_ip !== clientIp) {
            console.log(`[get-paste] KBT IP MISMATCH: bound=${bypassData.bound_ip} actual=${clientIp}`);
            const isBanWorthy = shouldBanForIpMismatch(clientIp);
            logThreat('kbt_ip_mismatch', clientIp, uid, null, { bound_ip: bypassData.bound_ip, slug }, isBanWorthy ? 'high' : 'low', isBanWorthy);
            if (isBanWorthy) {
              autoBanNewIp(clientIp, 'repeated_kbt_token_theft', uid, null);
              return new Response(QUIET_ACCESS_DENIED_LUA, { status: 200, headers: textHeaders });
            }
            // Give fresh loader with current IP
            return await respondWithFreshLoader();
          }
          // Mark bypass token as used
          await supabase.from('paste_execution_tokens')
            .update({ used_at: new Date().toISOString() })
            .eq('id', bypassData.id);

          // Now serve the normal protection loader (completely separate from key system)
          console.log(`[get-paste] KBT_VALID: serving protection loader for uid=${uid} paste=${paste.id}`);
          const newToken = generateToken();
          const sessionSecret = generateSessionSecret(clientIp, Date.now());
          const serverNonce = generateServerNonce();
          const trustLevel = getTrustScore(clientIp);
          await supabase.from('paste_execution_tokens').insert({
            paste_id: paste.id, roblox_user_id: uid, token: newToken,
            expires_at: new Date(Date.now() + 30000).toISOString(),
            bound_ip: clientIp,
          });
          const loader = generateLoader(slugStr, baseUrl, newToken, sessionSecret, {
            showConsoleFeedback: paste.show_loading_bar !== false,
            serverNonce,
            trustLevel,
          });
          return new Response(loader, { status: 200, headers: textHeaders });
        } else {
          console.log(`[get-paste] KBT_INVALID: expired or used bypass token for paste ${paste.id}`);
          return new Response(generateKickPlain('Session expired, please try again'), { status: 200, headers: textHeaders });
        }
      }

      if (shouldHideBrowserPasteView) {
        const browserDiscordRedirect = getDiscordRedirectResponse();
        if (browserDiscordRedirect) return browserDiscordRedirect;

        if (paste.ip_tracking_enabled) await logAccess(null, 'browser');
        return new Response('', { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
      }

      const keyPanel = await getPreferredKeyPanel();
      
      if (keyPanel) {
        console.log(`[get-paste] Returning key system GUI for protected paste: ${paste.id} panel: ${keyPanel.name}`);
        const { data: panelDetails } = await supabase.from('control_panels').select('logo_url').eq('id', keyPanel.id).single();
        const gui = generateKeySystemGui(slugStr, baseUrl, keyPanel.name, '104, 190, 151', panelDetails?.logo_url || undefined);
        return new Response(gui, { status: 200, headers: textHeaders });
      }

      // Block spoofed uid (serve honeypot, no auto-ban)
      if (uid && /^\d+$/.test(uid) && parseInt(uid) < 1000 && parseInt(uid) !== 0) {
        console.log(`[get-paste] BLOCKED: spoofed uid=${uid} slug=${slug} ip=${clientIp}`);
        logThreat('spoofed_uid', clientIp, uid, null, {
          slug, user_agent: userAgent.substring(0, 200), action: 'honeypot_served_no_ban',
        }, 'medium', true);
        return new Response(generateHoneypot(), { status: 200, headers: textHeaders });
      }

      // ===== Before serving the protection loader, verify request legitimacy =====
      // A non-browser, non-Roblox request should NEVER get the loader — serve honeypot, no ban
      if (!isLikelyBrowser && !isRobloxRequest) {
        console.log(`[get-paste] BLOCKED: non-roblox non-browser requesting loader slug=${slug} ip=${clientIp} ua="${userAgent.substring(0, 80)}"`);
        logThreat('unknown_client_loader', clientIp, uid || null, null, {
          slug, user_agent: userAgent.substring(0, 200), action: 'honeypot_served_no_ban',
        }, 'medium', true);
        return new Response(generateHoneypot(), { status: 200, headers: textHeaders });
      }

      const newToken = generateToken();
      const sessionSecret = generateSessionSecret(clientIp, Date.now());
      const serverNonce = generateServerNonce();
      const trustLevel = getTrustScore(clientIp);
      // v12.2: Non-blocking token insert
      supabase.from('paste_execution_tokens').insert({
        paste_id: paste.id, roblox_user_id: '0', token: newToken,
        expires_at: new Date(Date.now() + 30000).toISOString(),
        bound_ip: clientIp,
      }).then(() => {}, () => {});
      const loader = generateLoader(slugStr, baseUrl, newToken, sessionSecret, {
        showConsoleFeedback: paste.show_loading_bar !== false,
        serverNonce,
        trustLevel,
      });
      return new Response(loader, { status: 200, headers: textHeaders });
    }

    if (!/^\d+$/.test(uid)) {
      return new Response(generateKickEncrypted('Invalid user ID', slug, tk, uid), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    const timestamp = parseInt(ts);
    const now = Math.floor(Date.now() / 1000);
    if (isNaN(timestamp) || Math.abs(now - timestamp) > 180) {
      return await respondWithFreshLoader();
    }

    if (!isRobloxRequest && userAgent.includes('axios')) {
      const strikes = (suspiciousIps.get(clientIp)?.strikes || 0) + 2;
      suspiciousIps.set(clientIp, { strikes, lastStrike: Date.now() });
      return new Response(generateKickEncrypted('Access denied - Invalid client', slug, tk, uid), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // v9+v10: Validate entropy proof + DNA + quantum + stack depth
    if (entropy && snonce) {
      const entropyNum = parseInt(entropy);
      if (entropyNum === 0) {
        // Zero entropy = no real RenderStepped happened
        updateTrustScore(clientIp, -15);
        console.log(`[get-paste] SUSPICIOUS: zero entropy from ${clientIp}`);
      }
    }
    
    // v10: Validate DNA hash (should be non-zero for real game sessions)
    if (dna) {
      const dnaNum = parseInt(dna);
      if (dnaNum === 0 || isNaN(dnaNum)) {
        updateTrustScore(clientIp, -10);
        console.log(`[get-paste] SUSPICIOUS: zero/invalid DNA from ${clientIp}`);
      }
    }
    
    // v10: Validate stack depth (abnormally deep = debugger)
    if (stackDepth) {
      const sdNum = parseInt(stackDepth);
      if (sdNum > 50) {
        updateTrustScore(clientIp, -10);
        logThreat('deep_stack_detected', clientIp, uid, null, {
          stack_depth: sdNum, slug, action: 'trust_degraded_only',
        }, 'low', true);
      }
    }
    
    // v10: Log watermark for leak tracing
    if (watermarkId) {
      // Store watermark-to-user mapping for leak detection
      console.log(`[get-paste] v10: wm=${watermarkId} uid=${uid} ip=${clientIp} dna=${dna || 'none'} qt=${quantumToken || 'none'}`);
    }

    const { data: tokenData, error: tokenError } = await supabase
      .from('paste_execution_tokens')
      .select('*')
      .eq('token', tk)
      .eq('paste_id', paste.id)
      .maybeSingle();

    if (tokenError || !tokenData) return await respondWithFreshLoader();
    if (tokenData.used_at) {
      const strikes = (suspiciousIps.get(clientIp)?.strikes || 0) + 1;
      suspiciousIps.set(clientIp, { strikes, lastStrike: Date.now() });
      return await respondWithFreshLoader();
    }
    if (new Date(tokenData.expires_at) < new Date()) return await respondWithFreshLoader();
    
    // v10.4: IP binding validation — reject but don't auto-ban on first mismatch
    if (tokenData.bound_ip && tokenData.bound_ip !== clientIp) {
      console.log(`[get-paste] PROTECTED TOKEN IP MISMATCH: bound=${tokenData.bound_ip} actual=${clientIp} slug=${slug} uid=${uid}`);
      const isBanWorthy = shouldBanForIpMismatch(clientIp);
      logThreat('protected_token_ip_mismatch', clientIp, uid, null, {
        bound_ip: tokenData.bound_ip, actual_ip: clientIp, slug,
        action: isBanWorthy ? 'token_rejected_auto_ban' : 'token_rejected_retry',
      }, isBanWorthy ? 'critical' : 'low', isBanWorthy);
      if (isBanWorthy) {
        autoBanNewIp(clientIp, 'repeated_token_theft_protected', uid, null);
        return new Response(QUIET_ACCESS_DENIED_LUA, { status: 200, headers: textHeaders });
      }
      return await respondWithFreshLoader();
    }

    // v12.2: Non-blocking token mark-as-used
    supabase
      .from('paste_execution_tokens')
      .update({ used_at: new Date().toISOString(), roblox_user_id: uid })
      .eq('id', tokenData.id)
      .is('used_at', null)
      .then(() => {}, () => {});

    if (paste.game_restriction_enabled && gid && pid) {
      const { data: gameBindings } = await supabase.from('paste_game_bindings').select('game_id').eq('paste_id', paste.id);
      if (gameBindings && gameBindings.length > 0) {
        const allowedGameIds = gameBindings.map(b => b.game_id);
        if (!allowedGameIds.includes(gid) && !allowedGameIds.includes(pid)) {
          return new Response(generateKickEncrypted('This script is not supported on this game', slug, tk, uid), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
          });
        }
      }
    }

    // v9: Determine trust level and whether to poison
    const trustLevel = getTrustScore(clientIp);
    const shouldPoison = trustLevel < 30;

    if (paste.public_protection) {
      const { data: blacklistEntry } = await supabase
        .from('paste_access_control')
        .select('*')
        .eq('paste_id', paste.id)
        .eq('roblox_user_id', uid)
        .eq('access_type', 'blacklist')
        .maybeSingle();

      const nowMs = Date.now();
      const expiresAtMs = blacklistEntry?.expires_at ? Date.parse(blacklistEntry.expires_at) : null;
      const expiresValid = typeof expiresAtMs === "number" && Number.isFinite(expiresAtMs);
      const isBlacklisted = !!blacklistEntry && (
        blacklistEntry.is_eternal || !blacklistEntry.expires_at || (expiresValid && (expiresAtMs as number) > nowMs)
      );

      if (isBlacklisted) {
        return new Response(generateKickEncrypted('You are blacklisted', slug, tk, uid), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }

      // v15: HWID cross-validation for public protection (anti-uid-spoofing)
      if (hwid && hwid.length >= 4) {
        const { data: hwidOwnerPub } = await supabase
          .from('paste_hwid_locks')
          .select('roblox_user_id')
          .eq('paste_id', paste.id)
          .eq('hwid', hwid)
          .neq('roblox_user_id', uid)
          .maybeSingle();
        
        if (hwidOwnerPub) {
          console.log(`[get-paste] UID_SPOOF_PUB: uid=${uid} hwid belongs to ${hwidOwnerPub.roblox_user_id} slug=${slug}`);
          logThreat('uid_spoofing_public', clientIp, uid, null, {
            claimed_uid: uid, hwid_owner: hwidOwnerPub.roblox_user_id, slug,
          }, 'critical', false);
          autoBanNewIp(clientIp, 'uid_spoofing_public_protection', uid, null);
          return new Response(generateKickEncrypted('Access denied - identity mismatch', slug, tk, uid), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
          });
        }
      }

      // v11: HWID verification for public protection pastes
      const pubProtMode = paste.protection_mode || 'whitelist';
      if (pubProtMode === 'hwid' || pubProtMode === 'both') {
        if (hwid && hwid.length >= 4) {
          const { data: existingLock } = await supabase
            .from('paste_hwid_locks')
            .select('*')
            .eq('paste_id', paste.id)
            .eq('roblox_user_id', uid)
            .maybeSingle();

          if (existingLock) {
            if (existingLock.hwid !== hwid) {
              return new Response(generateKickEncrypted('HWID mismatch - locked to another device', slug, tk, uid), {
                status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
              });
            }
            await supabase.from('paste_hwid_locks').update({ updated_at: new Date().toISOString() }).eq('id', existingLock.id);
          } else {
            const { error: hwidInsertError } = await supabase
              .from('paste_hwid_locks')
              .insert({ paste_id: paste.id, roblox_user_id: uid, hwid });

            if (hwidInsertError) {
              console.warn(`[get-paste] HWID lock insert skipped paste=${paste.id} uid=${uid}: ${hwidInsertError.message}`);
            }
          }
        }
      }

      // ===== v12: NEW PROTECTION CHECKS (public protection path) =====
      paste._ua = req.headers.get('user-agent') || '';
      const v12PubResult = await applyV12Protections(paste, uid, clientIp, hwid, slug, tk, supabase, baseUrl);
      if (v12PubResult) return v12PubResult;

      logAccess(uid, 'execution', true).catch(() => {});
      supabase.from('paste_executions').insert({ paste_id: paste.id, roblox_user_id: uid }).then(() => {}, () => {});
      console.log(`Public protection access granted: ${uid} for paste: ${paste.id}`);
      
      fireWebhookAlert(paste, uid, clientIp, hwid, 'execution');

      let pubContent = paste.content;
      if (paste.crash_detection_enabled) pubContent = wrapWithCrashDetection(pubContent);
      if (paste.obfuscation_on_delivery) pubContent = applyDeliveryObfuscation(pubContent);

      const key = `${slug}:${tk}:ULTv9:${uid}:${entropy || '0'}`;
      
      // v10.2: Chunked encryption (anti-loadstring-hook)
      return new Response(chunkEncrypt(pubContent, key), { status: 200, headers: textHeaders });
    }

    const { data: accessList } = await supabase
      .from('paste_access_control')
      .select('*')
      .eq('paste_id', paste.id)
      .eq('roblox_user_id', uid);

    const nowMs = Date.now();
    const isBlacklisted = accessList?.some((entry) => {
      if (entry.access_type !== 'blacklist') return false;
      if (entry.is_eternal) return true;
      if (!entry.expires_at) return true;
      const expiresAtMs = Date.parse(entry.expires_at);
      return Number.isFinite(expiresAtMs) && expiresAtMs > nowMs;
    });

    if (isBlacklisted) {
      return new Response(generateKickEncrypted('You are blacklisted', slug, tk, uid), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    const hasWhitelist = (accessList ?? []).some((e) => e.access_type === 'whitelist');
    const hasValidWhitelist = (accessList ?? []).some((entry) => {
      if (entry.access_type !== 'whitelist') return false;
      if (entry.is_eternal) return true;
      if (!entry.expires_at) return true;
      const expiresAtMs = Date.parse(entry.expires_at);
      return Number.isFinite(expiresAtMs) && expiresAtMs > nowMs;
    });

    if (!hasWhitelist) {
      return new Response(generateKickEncrypted('Not whitelisted', slug, tk, uid), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    if (!hasValidWhitelist) {
      return new Response(generateKickEncrypted('Your whitelist time has expired', slug, tk, uid), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // ===== v15: HWID CROSS-VALIDATION (anti-uid-spoofing) =====
    // Even in 'whitelist' mode, if a HWID is provided, check if it belongs to a DIFFERENT user.
    // This catches attackers who spoof a whitelisted user's ID but have their own HWID.
    if (hwid && hwid.length >= 4) {
      const { data: hwidOwner } = await supabase
        .from('paste_hwid_locks')
        .select('roblox_user_id')
        .eq('paste_id', paste.id)
        .eq('hwid', hwid)
        .neq('roblox_user_id', uid)
        .maybeSingle();
      
      if (hwidOwner) {
        // This HWID is already bound to a DIFFERENT user — uid spoofing detected!
        console.log(`[get-paste] UID_SPOOF_DETECTED: uid=${uid} but hwid belongs to ${hwidOwner.roblox_user_id} slug=${slug} ip=${clientIp}`);
        logThreat('uid_spoofing', clientIp, uid, null, {
          claimed_uid: uid,
          hwid_owner: hwidOwner.roblox_user_id,
          hwid: hwid.substring(0, 16),
          slug,
          action: 'blocked_and_banned',
        }, 'critical', false);
        // Auto-ban the spoofing IP and the fake uid
        autoBanNewIp(clientIp, `uid_spoofing_hwid_mismatch`, uid, null);
        return new Response(generateKickEncrypted('Access denied - identity mismatch detected', slug, tk, uid), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }
      
      // Also check: if this USER already has a different HWID bound, they're on a different device
      const { data: userHwid } = await supabase
        .from('paste_hwid_locks')
        .select('hwid')
        .eq('paste_id', paste.id)
        .eq('roblox_user_id', uid)
        .maybeSingle();
      
      if (userHwid && userHwid.hwid !== hwid) {
        // This user already has a HWID lock with a DIFFERENT hwid — different device or spoof
        console.log(`[get-paste] HWID_CROSS_MISMATCH: uid=${uid} expected=${userHwid.hwid.substring(0,8)}... got=${hwid.substring(0,8)}... slug=${slug}`);
        logThreat('hwid_cross_mismatch', clientIp, uid, null, {
          expected_hwid: userHwid.hwid.substring(0, 16),
          actual_hwid: hwid.substring(0, 16),
          slug,
        }, 'high', false);
        return new Response(generateKickEncrypted('HWID mismatch - this script is locked to another device. Contact the script owner to reset your HWID.', slug, tk, uid), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }
    }

    // ===== v11: HWID VERIFICATION =====
    const protectionMode = paste.protection_mode || 'whitelist';
    if (protectionMode === 'hwid' || protectionMode === 'both') {
      if (!hwid || hwid.length < 4) {
        // No HWID sent — executor doesn't support gethwid()
        console.log(`[get-paste] HWID_MISSING: uid=${uid} slug=${slug} mode=${protectionMode}`);
        return new Response(generateKickEncrypted('Your executor does not support HWID locking. Please use an executor with gethwid() support.', slug, tk, uid), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }

      // Check existing HWID lock
      const { data: existingLock } = await supabase
        .from('paste_hwid_locks')
        .select('*')
        .eq('paste_id', paste.id)
        .eq('roblox_user_id', uid)
        .maybeSingle();

      if (existingLock) {
        // HWID lock exists — verify it matches
        if (existingLock.hwid !== hwid) {
          console.log(`[get-paste] HWID_MISMATCH: uid=${uid} expected=${existingLock.hwid.substring(0,8)}... got=${hwid.substring(0,8)}... slug=${slug}`);
          logThreat('hwid_mismatch', clientIp, uid, null, {
            expected_hwid: existingLock.hwid.substring(0, 16),
            actual_hwid: hwid.substring(0, 16),
            slug,
          }, 'high', false);
          return new Response(generateKickEncrypted('HWID mismatch - this script is locked to another device. Contact the script owner to reset your HWID.', slug, tk, uid), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
          });
        }
        // HWID matches — update last seen
        await supabase.from('paste_hwid_locks')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', existingLock.id);
        console.log(`[get-paste] HWID_VALID: uid=${uid} hwid=${hwid.substring(0,8)}... slug=${slug}`);
      } else {
        // No lock yet — create one (first execution binds HWID)
        const { error: insertError } = await supabase
          .from('paste_hwid_locks')
          .insert({
            paste_id: paste.id,
            roblox_user_id: uid,
            hwid: hwid,
          });
        if (insertError) {
          console.error(`[get-paste] HWID_INSERT_ERROR:`, insertError);
          // Don't block execution on insert failure
        } else {
          console.log(`[get-paste] HWID_LOCKED: uid=${uid} hwid=${hwid.substring(0,8)}... slug=${slug} (first execution)`);
        }
      }
    }

    // v15: Auto-bind HWID for ALL protected pastes (even whitelist-only mode)
    // This ensures uid spoofing is always detectable on subsequent requests
    if (hwid && hwid.length >= 4 && protectionMode === 'whitelist') {
      const { data: existingAutoLock } = await supabase
        .from('paste_hwid_locks')
        .select('id, hwid')
        .eq('paste_id', paste.id)
        .eq('roblox_user_id', uid)
        .maybeSingle();
      
      if (!existingAutoLock) {
        // First execution — silently bind HWID for anti-spoof tracking
        supabase.from('paste_hwid_locks').insert({
          paste_id: paste.id, roblox_user_id: uid, hwid,
        }).then(() => {
          console.log(`[get-paste] v15 AUTO_HWID_BIND: uid=${uid} hwid=${hwid.substring(0,8)}... slug=${slug}`);
        }).then(undefined, () => {});
      }
    }

    // ===== v12: NEW PROTECTION CHECKS =====
    paste._ua = req.headers.get('user-agent') || '';
    const v12Result = await applyV12Protections(paste, uid, clientIp, hwid, slug, tk, supabase, baseUrl);
    if (v12Result) return v12Result;

    logAccess(uid, 'execution', true).catch(() => {});
    supabase.from('paste_executions').insert({ paste_id: paste.id, roblox_user_id: uid }).then(() => {}, () => {});
    console.log(`Access granted: ${uid} for paste: ${paste.id}`);

    // v12: Send webhook alert if enabled
    fireWebhookAlert(paste, uid, clientIp, hwid, 'execution');

    let finalContent = paste.content;
    if (paste.crash_detection_enabled) finalContent = wrapWithCrashDetection(finalContent);
    if (paste.obfuscation_on_delivery) finalContent = applyDeliveryObfuscation(finalContent);

    const key = `${slug}:${tk}:ULTv9:${uid}:${entropy || '0'}`;
    
    // v10.2: Chunked encryption (anti-loadstring-hook)
    return new Response(chunkEncrypt(finalContent, key), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response('warn("[ULT] Server error - please retry")', { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
  }
};

// v17.1: any Kick(...) or honeypot payload leaving the function for a non-Roblox
// fetcher (Discord bot, curl, node-fetch, browser dump tool) gets rewritten to
// trap-baited fake source. Real Roblox clients still get the kick text.
Deno.serve(async (req) => {
  const res = await _ultHandle(req);
  try {
    const ua = req.headers.get('user-agent') || '';
    if (isRobloxLikeUserAgent(ua)) return res;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/plain')) return res;
    if (res.status !== 200) return res;
    const body = await res.clone().text();
    const looksLikeKick = /LocalPlayer:Kick\(/.test(body)
      || /ULT Protection: unauthorized/.test(body)
      || /\[ULT\]/.test(body);
    if (!looksLikeKick) return res;
    const host = Deno.env.get('PUBLIC_SITE_URL')?.replace(/^https?:\/\//, '').replace(/\/+$/, '')
      || 'ultluacodeprotectsyourluacode.onrender.com';
    const supaOrigin = new URL(req.url).origin;
    const tok = generateToken().slice(0, 24);
    const trapBody = `-- ULT LUA Protected Script
-- Source manifest: https://${host}/s/source_${tok}
-- Compatibility manifest: ${supaOrigin}/functions/v1/get-paste/source/${tok}
-- Revision manifest: https://${host}/s/source_${tok}?m=1

return (function() return nil end)()
`;
    return new Response(trapBody, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
  } catch {
    return res;
  }
});

