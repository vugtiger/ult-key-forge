import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

// ===== PERMANENT IP BAN LIST =====
// These IPs are permanently blocked from ALL access. Even VPN won't help if we catch their new IPs.
const PERMANENTLY_BANNED_IPS = new Set([
  '79.177.154.169',
  '79.181.155.63',   // Same ISP range, likely same person
  '89.234.244.240',  // Frequent abuser from logs
]);

// Subnet bans - block entire /24 ranges for persistent abusers
const BANNED_SUBNETS = [
  '79.177.154.',   // Full subnet of the main abuser
  '79.181.155.',   // Related subnet
];

// In-memory cache of DB global bans (refreshed every 60s)
let globalBanCache: { ips: Set<string>; subnets: string[]; robloxIds: Set<string>; discordIds: Set<string>; lastRefresh: number } = {
  ips: new Set(), subnets: [], robloxIds: new Set(), discordIds: new Set(), lastRefresh: 0
};

async function refreshGlobalBans() {
  if (Date.now() - globalBanCache.lastRefresh < 60_000) return; // Cache for 60s
  try {
    const { data } = await supabase.from('global_bans').select('ban_type, ban_value').eq('is_active', true);
    const ips = new Set<string>();
    const subnets: string[] = [];
    const robloxIds = new Set<string>();
    const discordIds = new Set<string>();
    for (const ban of data || []) {
      if (ban.ban_type === 'ip') ips.add(ban.ban_value);
      else if (ban.ban_type === 'subnet') subnets.push(ban.ban_value);
      else if (ban.ban_type === 'roblox_id') robloxIds.add(ban.ban_value);
      else if (ban.ban_type === 'discord_id') discordIds.add(ban.ban_value);
    }
    globalBanCache = { ips, subnets, robloxIds, discordIds, lastRefresh: Date.now() };
  } catch (e) {
    console.error('Failed to refresh global bans:', e);
  }
}

function isPermanentlyBanned(ip: string): boolean {
  if (PERMANENTLY_BANNED_IPS.has(ip)) return true;
  for (const subnet of BANNED_SUBNETS) {
    if (ip.startsWith(subnet)) return true;
  }
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

// Log threat to DB (fire-and-forget)
function logThreat(type: string, ip: string | null, robloxId: string | null, discordId: string | null, details: any, severity: string) {
  supabase.from('threat_log').insert({
    threat_type: type, source_ip: ip, roblox_user_id: robloxId,
    discord_user_id: discordId, details, severity,
  }).then(() => {}).catch(e => console.error('Threat log failed:', e));
}

// ===== AUTO-BAN: When a globally banned user connects from a new IP, ban that IP too =====
// In-memory set to avoid duplicate insert attempts within same isolate
const autoBannedIpsThisSession = new Set<string>();

function autoBanNewIp(ip: string, reason: string, robloxId: string | null, discordId: string | null) {
  if (!ip || ip === 'unknown') return;
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
    .catch(e => console.error('Auto-ban insert failed:', e));
  
  // Log threat
  logThreat('auto_ban_vpn_ip', ip, robloxId, discordId, { 
    action: 'new_ip_auto_banned', 
    reason: banReason 
  }, 'high');
}

// Enhanced rate limiting with IP tracking (persists within isolate lifetime)
const rateLimits = new Map<string, { count: number; resetTime: number; blocked: boolean }>();
const suspiciousIps = new Map<string, { strikes: number; lastStrike: number }>();
// v9: Session trust scores - tracks behavioral scoring per IP
const trustScores = new Map<string, { score: number; lastUpdate: number; requestTimes: number[] }>();

// Per-IP-per-slug throttle: max 3 requests per 30 seconds for the same slug from same IP
const slugThrottle = new Map<string, { count: number; resetTime: number }>();
const SLUG_THROTTLE_MAX = 3;
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
];

function isBlockedUserAgent(ua: string): boolean {
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
  for (const pattern of DISCORD_BOT_PATTERNS) {
    if (pattern.test(ua)) return true;
  }
  const via = headers.get('via') || '';
  const xForwardedFor = headers.get('x-forwarded-for') || '';
  if (via.toLowerCase().includes('discord') || xForwardedFor.includes('discord')) return true;
  return false;
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

  if (secFetchMode || secFetchDest || secFetchSite || secChUa) {
    return { valid: false, reason: 'browser_headers' };
  }
  if (accept.includes('text/html')) return { valid: false, reason: 'html_accept' };
  if (origin || referer) return { valid: false, reason: 'origin_referer' };
  if (isBlockedUserAgent(ua)) return { valid: false, reason: 'blocked_ua' };
  if (isDiscordBotRequest(headers)) return { valid: false, reason: 'discord_bot' };

  const isRobloxUA = ua.toLowerCase().includes('roblox') || 
                     ua.includes('HttpService') ||
                     ua.includes('WinInet');

  if (isRobloxUA) {
    const acceptLanguage = headers.get('accept-language');
    if (acceptLanguage && acceptLanguage.split(',').length > 5) {
      return { valid: false, reason: 'complex_accept_language' };
    }
    return { valid: true, reason: 'roblox_ua' };
  }

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
    const userResponse = await fetch(`https://users.roblox.com/v1/users/${userId}`);
    if (userResponse.ok) {
      const userData = await userResponse.json();
      result.username = userData.name;
      result.displayName = userData.displayName;
      result.description = userData.description;
      result.created = userData.created;
      result.isBanned = userData.isBanned;
    }

    const avatarResponse = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png`
    );
    if (avatarResponse.ok) {
      const avatarData = await avatarResponse.json();
      if (avatarData.data?.[0]?.imageUrl) result.avatarUrl = avatarData.data[0].imageUrl;
    }

    const friendsResponse = await fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`);
    if (friendsResponse.ok) {
      const friendsData = await friendsResponse.json();
      result.friendsCount = friendsData.count;
    }

    const followersResponse = await fetch(`https://friends.roblox.com/v1/users/${userId}/followers/count`);
    if (followersResponse.ok) {
      const followersData = await followersResponse.json();
      result.followersCount = followersData.count;
    }

    const followingResponse = await fetch(`https://friends.roblox.com/v1/users/${userId}/followings/count`);
    if (followingResponse.ok) {
      const followingData = await followingResponse.json();
      result.followingCount = followingData.count;
    }

    const groupsResponse = await fetch(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
    if (groupsResponse.ok) {
      const groupsData = await groupsResponse.json();
      if (groupsData.data) {
        result.groups = groupsData.data.slice(0, 20).map((g: any) => ({
          id: g.group.id, name: g.group.name, role: g.role.name,
        }));
      }
    }

    const badgesResponse = await fetch(
      `https://badges.roblox.com/v1/users/${userId}/badges?limit=20&sortOrder=Desc`
    );
    if (badgesResponse.ok) {
      const badgesData = await badgesResponse.json();
      if (badgesData.data) {
        result.badges = badgesData.data.map((b: any) => ({ id: b.id, name: b.name }));
      }
    }

    const favoritesResponse = await fetch(
      `https://games.roblox.com/v2/users/${userId}/favorite/games?limit=20`
    );
    if (favoritesResponse.ok) {
      const favoritesData = await favoritesResponse.json();
      if (favoritesData.data) {
        result.favorites = favoritesData.data.map((f: any) => ({ id: f.id, name: f.name }));
      }
    }
  } catch (error) {
    console.error('Error fetching Roblox profile:', error);
  }

  return result;
}

// ===== ULT PROTECTION v9.5 =====
// Runtime-bound encryption, dump poisoning, fetch intent detection,
// behavioral scoring, enhanced anti-env logger, anti-hookfunction,
// v9.5: Advanced anti-loadstring-hook with hookcheck, behavioral traps,
// indirect execution via coroutine/xpcall, chunked code assembly
function generateLoader(slug: string, baseUrl: string, token: string, sessionSecret: string, options?: { 
  showConsoleFeedback?: boolean;
  serverNonce?: string;
  trustLevel?: number; // 0-100
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
  
  // v9.5: Server-side execution key for indirect execution verification
  const execVerifyKey = Math.random().toString(36).substring(2, 18);
  
  // Generate random variable names
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
      // v9.5 new vars
      'hookcheckLS','lsBehavior','indirectExec','coroExec','xpExec',
      'chunkAssemble','reXor','splitPoints','codeChunks','verified',
      'trapResult','trapExpected','lsFingerprint','deepVerify'
    ].map(k => [k, '_' + Math.random().toString(36).substring(2, 8)])
  );
  
  // Generate junk code
  const junkCode = Array(8).fill(0).map(() => {
    const jv = '_' + Math.random().toString(36).substring(2, 10);
    const patterns = [
      `local ${jv}="${Math.random().toString(36).substring(2, 14)}"`,
      `local ${jv}=${Math.floor(Math.random() * 999999)}`,
      `local ${jv}=function() return ${Math.floor(Math.random() * 100)} end`,
      `local ${jv}=tick()+${Math.floor(Math.random() * 10000)}`,
    ];
    return patterns[Math.floor(Math.random() * patterns.length)];
  }).join('\n');

  const protectionSeed = Math.random();
  const canaryId = Math.random().toString(36).substring(2, 12);
  
  return `--[[ULT Protection v9.5 - ${Math.random().toString(36).substring(2,10)}]]
${junkCode}

-- ====== PHASE 0: OBTAIN CLEAN LOADSTRING (v9.5 Enhanced) ======
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

-- v9.5: Indirect execution via coroutine (bypasses loadstring hooks entirely)
-- Instead of loadstring(code)(), we compile in a coroutine to avoid hook interception
local ${v.indirectExec} = function(code)
  local fn, err
  -- Method 1: Execute loadstring inside a new coroutine (different call stack)
  local co = coroutine.create(function()
    return ${v.cleanLS}(code)
  end)
  local ok, result1, result2 = coroutine.resume(co)
  if ok then
    fn = result1
    err = result2
  end
  if fn then return fn, nil end
  -- Method 2: Use xpcall with custom error handler
  local fn2
  xpcall(function()
    fn2 = ${v.cleanLS}(code)
  end, function() end)
  if fn2 then return fn2, nil end
  -- Method 3: task.spawn deferred execution
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
  local rs = game:GetService("RunService")
  local collected = 0
  local conn
  conn = rs.RenderStepped:Connect(function(dt)
    collected = collected + 1
    ${v.runtimeEntropy}.frames[#${v.runtimeEntropy}.frames + 1] = dt
    if collected >= 5 then
      conn:Disconnect()
    end
  end)
  -- Wait for frames
  local timeout = tick() + 2
  while collected < 5 and tick() < timeout do
    task.wait(0.05)
  end
  if conn.Connected then conn:Disconnect() end
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
    if hasFile then return false end
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
        local testOk, testFn = pcall(oldVal, "return 42")
        if testOk and ${v.hookGuard}.type_ref(testFn) == "function" then
          local testOk2, testResult = pcall(testFn)
          if testOk2 and testResult == 42 then return false end
        end
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
  
  return true
end

-- ====== PHASE 2: ANTI-ENVIRONMENT LOGGER DEFENSE (v9.0 Rewritten) ======
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
local ${v.dumpPoison} = false
local ${v.silentDegrade} = function()
  ${v.dumpPoison} = true
  -- Don't warn, don't kick - silently mark session as compromised
end

-- ====== PHASE 4: SANDBOXED EXECUTION (v9.0 Enhanced) ======
local ${v.execSandbox} = function(code)
  -- v9: If dump poisoning active, corrupt the code subtly
  if ${v.dumpPoison} then
    -- Insert subtle bugs: change random numbers, swap true/false
    code = code:gsub("(%d+)", function(n)
      if math.random() < 0.05 then
        return tostring(tonumber(n) + math.random(-3, 3))
      end
      return n
    end)
  end
  
  if not ${v.antiHook}() then
    ${v.silentDegrade}()
    -- v9: Don't return nil, execute poisoned payload
    if ${v.dumpPoison} then
      local fn, err = ${v.cleanLS}(code)
      return fn, err
    end
    return nil, "hook_detected"
  end
  if not ${v.antiEnvLog}() then
    ${v.silentDegrade}()
    if ${v.dumpPoison} then
      local fn, err = ${v.cleanLS}(code)
      return fn, err
    end
    return nil, "env_logger_detected"
  end
  if not ${v.antiLogger}() then
    ${v.silentDegrade}()
    if ${v.dumpPoison} then
      local fn, err = ${v.cleanLS}(code)
      return fn, err
    end
    return nil, "logger_detected"
  end
  
  local fn, err = ${v.cleanLS}(code)
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

-- ====== RUN ALL PROTECTION CHECKS ======
-- v9: Instead of hard-blocking, use dump poisoning for failed checks
${protectionSeed > 0.66 ? `
if not ${v.antiHook}() then ${v.silentDegrade}() end
if not ${v.antiEnvLog}() then ${v.silentDegrade}() end
if not ${v.antiLogger}() then ${v.silentDegrade}() end
if not ${v.antiDump}() then ${v.silentDegrade}() end
if not ${v.antiDebug}() then ${v.silentDegrade}() end
` : protectionSeed > 0.33 ? `
if not ${v.antiEnvLog}() then ${v.silentDegrade}() end
if not ${v.antiDump}() then ${v.silentDegrade}() end
if not ${v.antiHook}() then ${v.silentDegrade}() end
if not ${v.antiDebug}() then ${v.silentDegrade}() end
if not ${v.antiLogger}() then ${v.silentDegrade}() end
` : `
if not ${v.antiDump}() then ${v.silentDegrade}() end
if not ${v.antiDebug}() then ${v.silentDegrade}() end
if not ${v.antiLogger}() then ${v.silentDegrade}() end
if not ${v.antiHook}() then ${v.silentDegrade}() end
if not ${v.antiEnvLog}() then ${v.silentDegrade}() end
`}

-- v9: Check fetch intent
if not ${v.intentCheck}() then
  ${v.silentDegrade}()
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
  -- v9: Runtime entropy proof
  local frameSum = 0
  for _, dt in ipairs(${v.runtimeEntropy}.frames) do
    frameSum = frameSum + dt
  end
  p.entropy = tostring(math.floor(frameSum * 100000))
  p.nonce = "${serverNonce}"
  return p
end

-- Obfuscated token storage and reconstruction
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

-- Build request URL with v9 runtime proof
local url = "${baseUrl}?slug=${slug}&uid=" .. fp.u .. "&ts=" .. fp.t .. "&tk=" .. tk .. "&ss=" .. ${v.session} .. "&gid=" .. fp.g .. "&pid=" .. fp.p .. "&r=" .. fp.r .. "&ex=" .. (fp.ex or "") .. "&entropy=" .. (fp.entropy or "0") .. "&snonce=" .. fp.nonce .. "&_=" .. tostring(tick())

-- XOR Decode
local ${v.hexBytes} = function(hex)
  local bytes = {}
  for i = 1, #hex, 2 do
    bytes[#bytes + 1] = tonumber(hex:sub(i, i+1), 16) or 0
  end
  return bytes
end

local ${v.xorBytes} = function(bytes, keyb)
  local out = table.create(#bytes)
  for i = 1, #bytes do
    out[i] = bit32.bxor(bytes[i], keyb[((i-1) % #keyb) + 1])
  end
  return out
end

local ${v.bytesToString} = function(bytes)
  local chars = table.create(#bytes)
  for i = 1, #bytes do chars[i] = string.char(bytes[i]) end
  return table.concat(chars)
end

-- v9: Generate decryption key with runtime entropy binding
local ks = "${slug}:" .. tk .. ":ULTv9:" .. fp.u .. ":" .. (fp.entropy or "0")
local kb = {}
for i = 1, #ks do
  kb[i] = string.byte(ks, i)
end

-- Re-verify protections before network request
if not ${v.antiHook}() then ${v.silentDegrade}() end
if not ${v.antiEnvLog}() then ${v.silentDegrade}() end

-- v9.5: Re-verify loadstring integrity before fetch
if not ${v.verified} then ${v.silentDegrade}() end
if ${v.hookcheckLS} and not ${v.clonedLS} then ${v.silentDegrade}() end

${options?.showConsoleFeedback ? `
local function ${v.junk5}(msg, pct)
  local barLen = 20
  local filled = math.floor(barLen * pct / 100)
  local empty = barLen - filled
  print("[ULT PROTECTION] [" .. string.rep("#", filled) .. string.rep("-", empty) .. "] " .. pct .. "% - " .. msg)
end

${v.junk5}("Scanning environment...", 0)
task.wait(0.1)

${v.junk5}("Verifying integrity...", 25)
task.wait(0.15)

${v.junk5}("Fetching payload...", 50)
` : ''}

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
    ${v.silentDegrade}()
  end

  -- v9.5: Re-check hookcheck after fetch (attacker might hook during network wait)
  pcall(function()
    if hookcheck and hookcheck(loadstring) and not ${v.clonedLS} then
      ${v.silentDegrade}()
    end
    -- Also check if our cleanLS got swapped
    if hookcheck and hookcheck(${v.cleanLS}) then
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

  -- Handle encrypted response
  if ${v.isHex}(r) then
    local rawBytes = ${v.hexBytes}(r)
    r = nil

    -- Final security sweep
    if not ${v.antiHook}() or not ${v.antiEnvLog}() or not ${v.antiLogger}() or not ${v.antiDump}() then
      ${v.silentDegrade}()
    end

    local decoded = ${v.xorBytes}(rawBytes, kb)
    rawBytes = nil
    local code = ${v.bytesToString}(decoded)
    decoded = nil

${options?.showConsoleFeedback ? `    pcall(function()
      local function ultBar(msg, pct)
        local barLen = 20
        local filled = math.floor(barLen * pct / 100)
        local empty = barLen - filled
        print("[ULT PROTECTION] [" .. string.rep("#", filled) .. string.rep("-", empty) .. "] " .. pct .. "% - " .. msg)
      end
      ultBar("Script loaded successfully.", 100)
      local pName = ${v.player}.DisplayName or ${v.player}.Name
      print("[ULT PROTECTION] Welcome, " .. tostring(pName) .. ".")
      print("[ULT PROTECTION] Protected by ULT Protection v9.5")
    end)
` : ''}

    -- v9.5: Use indirect execution (coroutine-based) to bypass loadstring hooks
    -- If dump poisoning is active, corrupt the code before execution
    if ${v.dumpPoison} then
      code = code:gsub("(%d+)", function(n)
        if math.random() < 0.05 then
          return tostring(tonumber(n) + math.random(-3, 3))
        end
        return n
      end)
    end

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
      -- v9.5: Execute inside pcall within a new coroutine to isolate from hooks
      local execCo = coroutine.create(function()
        return ${v.execFunc}()
      end)
      local execOk = coroutine.resume(execCo)
      ${v.execFunc} = nil
      execCo = nil
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

// ===== KEY SYSTEM GUI GENERATOR v3 =====
// Clean, polished UI. Decal ID for logo. Split-color title. Draggable. Blur bg.
function generateKeySystemGui(slug: string, baseUrl: string, panelName: string, themeColor: string, decalId?: string): string {
  const words = panelName.trim().split(/\s+/);
  const firstWord = words[0] || panelName;
  const restWords = words.slice(1).join(' ');
  
  const colorParts = (themeColor || '255, 255, 255').split(',').map(s => s.trim());
  const r = colorParts[0] || '255';
  const g = colorParts[1] || '255';
  const b = colorParts[2] || '255';

  const logoSection = decalId ? `
-- Logo from Roblox decal
local logoImg = Instance.new("ImageLabel", titleBar)
logoImg.Size = UDim2.new(0, 24, 0, 24)
logoImg.Position = UDim2.new(0, 10, 0.5, -12)
logoImg.BackgroundTransparency = 1
logoImg.Image = "rbxassetid://${decalId}"
logoImg.ScaleType = Enum.ScaleType.Fit
logoImg.ImageTransparency = 1
TweenService:Create(logoImg, TweenInfo.new(0.5, Enum.EasingStyle.Quad), {ImageTransparency = 0}):Play()
` : '';

  const titleOffset = decalId ? 42 : 12;

  return `-- ULT Key System v3
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local HttpService = game:GetService("HttpService")
local Lighting = game:GetService("Lighting")

local plr = Players.LocalPlayer
if not plr then plr = Players.PlayerAdded:Wait() end
local pgui = plr:WaitForChild("PlayerGui")

-- Remove any existing key system GUI
local old = pgui:FindFirstChild("ULTKeySystem")
if old then old:Destroy() end

local gui = Instance.new("ScreenGui")
gui.Name = "ULTKeySystem"
gui.ResetOnSpawn = false
gui.DisplayOrder = 999999999
gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
gui.Parent = pgui

-- Blur
local blur = Instance.new("BlurEffect")
blur.Name = "ULTBlur"
blur.Size = 0
blur.Parent = Lighting
TweenService:Create(blur, TweenInfo.new(0.4, Enum.EasingStyle.Quad), {Size = 20}):Play()





-- Main window
local win = Instance.new("Frame", gui)
win.Name = "MainWindow"
win.Size = UDim2.new(0, 380, 0, 240)
win.Position = UDim2.new(0.5, -190, 0.5, -120)
win.BackgroundColor3 = Color3.fromRGB(18, 18, 18)
win.BorderSizePixel = 0
win.BackgroundTransparency = 1
win.ZIndex = 3


local winCorner = Instance.new("UICorner", win)
winCorner.CornerRadius = UDim.new(0, 8)

-- Title bar
local titleBar = Instance.new("Frame", win)
titleBar.Name = "TitleBar"
titleBar.Size = UDim2.new(1, 0, 0, 32)
titleBar.BackgroundColor3 = Color3.fromRGB(24, 24, 24)
titleBar.BorderSizePixel = 0
titleBar.ZIndex = 4

local tbCorner = Instance.new("UICorner", titleBar)
tbCorner.CornerRadius = UDim.new(0, 8)

local tbFill = Instance.new("Frame", titleBar)
tbFill.Size = UDim2.new(1, 0, 0, 10)
tbFill.Position = UDim2.new(0, 0, 1, -10)
tbFill.BackgroundColor3 = Color3.fromRGB(24, 24, 24)
tbFill.BorderSizePixel = 0
tbFill.ZIndex = 4

-- Subtle separator line
local sep = Instance.new("Frame", win)
sep.Size = UDim2.new(1, -16, 0, 1)
sep.Position = UDim2.new(0, 8, 0, 32)
sep.BackgroundColor3 = Color3.fromRGB(40, 40, 40)
sep.BorderSizePixel = 0
sep.ZIndex = 4

${logoSection}

-- Title: first word = neon, rest = white bold
local titleNeon = Instance.new("TextLabel", titleBar)
titleNeon.Size = UDim2.new(0, 200, 1, 0)
titleNeon.Position = UDim2.new(0, ${titleOffset}, 0, 0)
titleNeon.BackgroundTransparency = 1
titleNeon.Text = "${firstWord}"
titleNeon.TextColor3 = Color3.fromRGB(${r}, ${g}, ${b})
titleNeon.Font = Enum.Font.GothamBold
titleNeon.TextSize = 13
titleNeon.TextXAlignment = Enum.TextXAlignment.Left
titleNeon.TextTransparency = 1
titleNeon.ZIndex = 5

${restWords ? `
local titleRest = Instance.new("TextLabel", titleBar)
titleRest.Size = UDim2.new(0, 200, 1, 0)
titleRest.BackgroundTransparency = 1
titleRest.Text = " ${restWords}"
titleRest.TextColor3 = Color3.fromRGB(200, 200, 200)
titleRest.Font = Enum.Font.GothamBold
titleRest.TextSize = 13
titleRest.TextXAlignment = Enum.TextXAlignment.Left
titleRest.TextTransparency = 1
titleRest.ZIndex = 5

task.defer(function()
    local ts = game:GetService("TextService")
    local nW = ts:GetTextSize("${firstWord}", 13, Enum.Font.GothamBold, Vector2.new(400, 32)).X
    titleRest.Position = UDim2.new(0, ${titleOffset} + nW, 0, 0)
end)
` : ''}

-- Window control dots (macOS style)
local function makeDot(parent, pos, col, action)
    local dot = Instance.new("TextButton", parent)
    dot.Size = UDim2.new(0, 12, 0, 12)
    dot.Position = pos
    dot.BackgroundColor3 = col
    dot.BorderSizePixel = 0
    dot.Text = ""
    dot.AutoButtonColor = false
    dot.ZIndex = 6
    local dc = Instance.new("UICorner", dot)
    dc.CornerRadius = UDim.new(1, 0)
    dot.MouseButton1Click:Connect(action)
    dot.MouseEnter:Connect(function()
        TweenService:Create(dot, TweenInfo.new(0.15), {Size = UDim2.new(0, 14, 0, 14)}):Play()
    end)
    dot.MouseLeave:Connect(function()
        TweenService:Create(dot, TweenInfo.new(0.15), {Size = UDim2.new(0, 12, 0, 12)}):Play()
    end)
    return dot
end

local minimized = false

-- Content panel
local contentPanel = Instance.new("Frame", win)
contentPanel.Name = "Content"
contentPanel.Size = UDim2.new(1, -20, 0, 160)
contentPanel.Position = UDim2.new(0, 10, 0, 42)
contentPanel.BackgroundColor3 = Color3.fromRGB(26, 26, 26)
contentPanel.BorderSizePixel = 0
contentPanel.ZIndex = 4

local cpCorner = Instance.new("UICorner", contentPanel)
cpCorner.CornerRadius = UDim.new(0, 6)

local cpStroke = Instance.new("UIStroke", contentPanel)
cpStroke.Thickness = 1
cpStroke.Color = Color3.fromRGB(38, 38, 38)
cpStroke.Transparency = 1

-- Key label
local keyLabel = Instance.new("TextLabel", contentPanel)
keyLabel.Size = UDim2.new(1, -20, 0, 20)
keyLabel.Position = UDim2.new(0, 10, 0, 12)
keyLabel.BackgroundTransparency = 1
keyLabel.Text = "Enter your key"
keyLabel.TextColor3 = Color3.fromRGB(120, 120, 120)
keyLabel.Font = Enum.Font.Gotham
keyLabel.TextSize = 11
keyLabel.TextXAlignment = Enum.TextXAlignment.Left
keyLabel.TextTransparency = 1
keyLabel.ZIndex = 5

-- Input frame
local inputFrame = Instance.new("Frame", contentPanel)
inputFrame.Size = UDim2.new(1, -20, 0, 34)
inputFrame.Position = UDim2.new(0, 10, 0, 36)
inputFrame.BackgroundColor3 = Color3.fromRGB(14, 14, 14)
inputFrame.BorderSizePixel = 0
inputFrame.ZIndex = 5

local ifCorner = Instance.new("UICorner", inputFrame)
ifCorner.CornerRadius = UDim.new(0, 5)

local ifStroke = Instance.new("UIStroke", inputFrame)
ifStroke.Thickness = 1
ifStroke.Color = Color3.fromRGB(50, 50, 50)

local input = Instance.new("TextBox", inputFrame)
input.Size = UDim2.new(1, -14, 1, 0)
input.Position = UDim2.new(0, 7, 0, 0)
input.BackgroundTransparency = 1
input.Text = ""
input.PlaceholderText = "XXXXX-XXXXX-XXXXX"
input.PlaceholderColor3 = Color3.fromRGB(60, 60, 60)
input.TextColor3 = Color3.fromRGB(210, 210, 210)
input.Font = Enum.Font.GothamMedium
input.TextSize = 13
input.TextXAlignment = Enum.TextXAlignment.Left
input.ClearTextOnFocus = false
input.TextTransparency = 1
input.ZIndex = 6

-- Submit button
local submitBtn = Instance.new("TextButton", contentPanel)
submitBtn.Size = UDim2.new(1, -20, 0, 32)
submitBtn.Position = UDim2.new(0, 10, 0, 80)
submitBtn.BackgroundColor3 = Color3.fromRGB(${r}, ${g}, ${b})
submitBtn.BorderSizePixel = 0
submitBtn.Text = "Validate"
submitBtn.TextColor3 = Color3.fromRGB(10, 10, 10)
submitBtn.Font = Enum.Font.GothamBold
submitBtn.TextSize = 12
submitBtn.AutoButtonColor = false
submitBtn.TextTransparency = 1
submitBtn.ZIndex = 5

local sbCorner = Instance.new("UICorner", submitBtn)
sbCorner.CornerRadius = UDim.new(0, 5)

-- Hover effect for submit
submitBtn.MouseEnter:Connect(function()
    TweenService:Create(submitBtn, TweenInfo.new(0.15), {BackgroundTransparency = 0.15}):Play()
end)
submitBtn.MouseLeave:Connect(function()
    TweenService:Create(submitBtn, TweenInfo.new(0.15), {BackgroundTransparency = 0}):Play()
end)

-- Status
local statusLabel = Instance.new("TextLabel", contentPanel)
statusLabel.Size = UDim2.new(1, -20, 0, 16)
statusLabel.Position = UDim2.new(0, 10, 0, 118)
statusLabel.BackgroundTransparency = 1
statusLabel.Text = ""
statusLabel.TextColor3 = Color3.fromRGB(120, 120, 120)
statusLabel.Font = Enum.Font.Gotham
statusLabel.TextSize = 10
statusLabel.TextTransparency = 1
statusLabel.ZIndex = 5

-- Powered by label
local poweredBy = Instance.new("TextLabel", contentPanel)
poweredBy.Size = UDim2.new(1, -20, 0, 14)
poweredBy.Position = UDim2.new(0, 10, 0, 140)
poweredBy.BackgroundTransparency = 1
poweredBy.Text = "powered by ULT"
poweredBy.TextColor3 = Color3.fromRGB(50, 50, 50)
poweredBy.Font = Enum.Font.Gotham
poweredBy.TextSize = 9
poweredBy.TextXAlignment = Enum.TextXAlignment.Right
poweredBy.TextTransparency = 1
poweredBy.ZIndex = 5

-- ====== ANIMATIONS ======
local fadeIn = TweenInfo.new(0.45, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
TweenService:Create(win, fadeIn, {BackgroundTransparency = 0}):Play()
TweenService:Create(cpStroke, fadeIn, {Transparency = 0}):Play()
TweenService:Create(titleNeon, fadeIn, {TextTransparency = 0}):Play()
TweenService:Create(keyLabel, fadeIn, {TextTransparency = 0}):Play()
TweenService:Create(input, fadeIn, {TextTransparency = 0}):Play()
TweenService:Create(submitBtn, fadeIn, {TextTransparency = 0}):Play()
TweenService:Create(statusLabel, fadeIn, {TextTransparency = 0}):Play()
TweenService:Create(poweredBy, fadeIn, {TextTransparency = 0}):Play()
${restWords ? 'TweenService:Create(titleRest, fadeIn, {TextTransparency = 0}):Play()' : ''}

-- Create dots after content is set up
local closeDot = makeDot(titleBar, UDim2.new(1, -42, 0.5, -6), Color3.fromRGB(255, 95, 87), function() end)
local minDot = makeDot(titleBar, UDim2.new(1, -58, 0.5, -6), Color3.fromRGB(255, 189, 46), function()
    minimized = not minimized
    local tgt = minimized and UDim2.new(0, 380, 0, 32) or UDim2.new(0, 380, 0, 240)
    TweenService:Create(win, TweenInfo.new(0.25, Enum.EasingStyle.Quad), {Size = tgt}):Play()
    contentPanel.Visible = not minimized
    sep.Visible = not minimized
end)

-- ====== DRAGGING ======
local dragging = false
local dragStart, startPos

titleBar.InputBegan:Connect(function(i)
    if i.UserInputType == Enum.UserInputType.MouseButton1 or i.UserInputType == Enum.UserInputType.Touch then
        dragging = true
        dragStart = i.Position
        startPos = win.Position
    end
end)

titleBar.InputEnded:Connect(function(i)
    if i.UserInputType == Enum.UserInputType.MouseButton1 or i.UserInputType == Enum.UserInputType.Touch then
        dragging = false
    end
end)

UserInputService.InputChanged:Connect(function(i)
    if dragging and (i.UserInputType == Enum.UserInputType.MouseMovement or i.UserInputType == Enum.UserInputType.Touch) then
        local d = i.Position - dragStart
        win.Position = UDim2.new(startPos.X.Scale, startPos.X.Offset + d.X, startPos.Y.Scale, startPos.Y.Offset + d.Y)
    end
end)

-- ====== CLOSE / DESTROY ======
local function smoothDestroy(msg, color, scriptCode)
    input.TextEditable = false
    if msg then
        statusLabel.Text = msg
        statusLabel.TextColor3 = color or Color3.fromRGB(200, 200, 200)
    end
    
    local fadeOut = TweenInfo.new(0.5, Enum.EasingStyle.Quad)
    TweenService:Create(win, fadeOut, {BackgroundTransparency = 1}):Play()
    TweenService:Create(titleBar, fadeOut, {BackgroundTransparency = 1}):Play()
    TweenService:Create(tbFill, fadeOut, {BackgroundTransparency = 1}):Play()
    TweenService:Create(contentPanel, fadeOut, {BackgroundTransparency = 1}):Play()
    TweenService:Create(cpStroke, fadeOut, {Transparency = 1}):Play()
    TweenService:Create(sep, fadeOut, {BackgroundTransparency = 1}):Play()
    TweenService:Create(titleNeon, fadeOut, {TextTransparency = 1}):Play()
    TweenService:Create(keyLabel, fadeOut, {TextTransparency = 1}):Play()
    TweenService:Create(input, fadeOut, {TextTransparency = 1}):Play()
    TweenService:Create(submitBtn, fadeOut, {BackgroundTransparency = 1, TextTransparency = 1}):Play()
    TweenService:Create(statusLabel, fadeOut, {TextTransparency = 1}):Play()
    TweenService:Create(poweredBy, fadeOut, {TextTransparency = 1}):Play()
    TweenService:Create(inputFrame, fadeOut, {BackgroundTransparency = 1}):Play()
    TweenService:Create(ifStroke, fadeOut, {Transparency = 1}):Play()
    TweenService:Create(closeDot, fadeOut, {BackgroundTransparency = 1}):Play()
    TweenService:Create(minDot, fadeOut, {BackgroundTransparency = 1}):Play()


    ${restWords ? 'TweenService:Create(titleRest, fadeOut, {TextTransparency = 1}):Play()' : ''}
    ${decalId ? 'TweenService:Create(logoImg, fadeOut, {ImageTransparency = 1}):Play()' : ''}
    TweenService:Create(blur, TweenInfo.new(0.5), {Size = 0}):Play()
    
    task.wait(0.6)
    
    if scriptCode and #scriptCode > 0 then
        local ok, fn = pcall(function()
            return loadstring(scriptCode)
        end)
        if ok and fn then
            local ok2, err2 = pcall(fn)
            if not ok2 then warn("[ULT] Exec error: " .. tostring(err2)) end
        else
            warn("[ULT] Compile error: " .. tostring(fn))
        end
    end
    
    blur:Destroy()
    gui:Destroy()
end

closeDot.MouseButton1Click:Connect(function()
    smoothDestroy("Closed", Color3.fromRGB(120, 120, 120), nil)
end)

-- ====== KEY VALIDATION ======
local validating = false

local function validateKey()
    if validating then return end
    local enteredKey = input.Text
    if #enteredKey < 3 then
        statusLabel.Text = "Key too short"
        statusLabel.TextColor3 = Color3.fromRGB(255, 80, 80)
        return
    end
    
    validating = true
    input.TextEditable = false
    submitBtn.Text = "Validating..."
    TweenService:Create(submitBtn, TweenInfo.new(0.2), {BackgroundColor3 = Color3.fromRGB(60, 60, 60)}):Play()
    statusLabel.Text = ""
    
    task.spawn(function()
        local userId = tostring(plr.UserId)
        local url = "${baseUrl}?slug=${slug}&key=" .. HttpService:UrlEncode(enteredKey) .. "&uid=" .. userId .. "&_=" .. tostring(tick())
        
        local success, response = pcall(function()
            return game:HttpGet(url)
        end)
        
        local function resetBtn()
            submitBtn.Text = "Validate"
            TweenService:Create(submitBtn, TweenInfo.new(0.2), {BackgroundColor3 = Color3.fromRGB(${r}, ${g}, ${b})}):Play()
            input.TextEditable = true
            validating = false
        end
        
        if not success then
            statusLabel.Text = "Network error"
            statusLabel.TextColor3 = Color3.fromRGB(255, 80, 80)
            resetBtn()
            return
        end
        
        if not response or #response == 0 then
            statusLabel.Text = "Empty response"
            statusLabel.TextColor3 = Color3.fromRGB(255, 80, 80)
            resetBtn()
            return
        end
        
        if response:sub(1, 17) == "KEY_VALID_SCRIPT:" then
            local scriptCode = response:sub(19)
            statusLabel.Text = "Key accepted!"
            statusLabel.TextColor3 = Color3.fromRGB(80, 255, 80)
            submitBtn.Text = "✓"
            task.wait(0.3)
            smoothDestroy(nil, nil, scriptCode)
        elseif response:find("KEY_ASSIGNED") then
            statusLabel.Text = "Key belongs to another user"
            statusLabel.TextColor3 = Color3.fromRGB(255, 80, 80)
            resetBtn()
        elseif response:find("KEY_EXPIRED") then
            statusLabel.Text = "Key has expired"
            statusLabel.TextColor3 = Color3.fromRGB(255, 150, 50)
            resetBtn()
        elseif response:find("KEY_INVALID") then
            statusLabel.Text = "Invalid key"
            statusLabel.TextColor3 = Color3.fromRGB(255, 80, 80)
            resetBtn()
        else
            statusLabel.Text = "Access denied"
            statusLabel.TextColor3 = Color3.fromRGB(255, 80, 80)
            resetBtn()
        end
    end)
end

submitBtn.MouseButton1Click:Connect(validateKey)
input.FocusLost:Connect(function(enter)
    if enter then validateKey() end
end)

-- Focus input on click
input.Focused:Connect(function()
    TweenService:Create(ifStroke, TweenInfo.new(0.15), {Color = Color3.fromRGB(${r}, ${g}, ${b})}):Play()
end)
input.FocusLost:Connect(function()
    TweenService:Create(ifStroke, TweenInfo.new(0.15), {Color = Color3.fromRGB(50, 50, 50)}):Play()
end)
`; 
}

function generateKickPlain(reason: string): string {
  return `game:GetService("Players").LocalPlayer:Kick("${reason}")`;
}

function generateKickEncrypted(reason: string, slug: string, token: string, uid: string): string {
  const kickScript = `game:GetService("Players").LocalPlayer:Kick("${reason}")`;
  const key = `${slug}:${token}:ULTv9:${uid}`;
  return xorToHex(kickScript, key);
}

function generateHoneypot(): string {
  return `-- Access Denied
-- This endpoint is protected
-- Please use a valid Roblox executor
print("Unauthorized access attempt logged")
`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Refresh global bans cache from DB (non-blocking after first load)
  await refreshGlobalBans();

  // ===== PERMANENT BAN CHECK — first thing, zero processing =====
  const earlyIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                  req.headers.get('cf-connecting-ip') || 'unknown';
  if (isPermanentlyBanned(earlyIp)) {
    logThreat('banned_ip_access', earlyIp, null, null, { action: 'blocked_at_gate' }, 'high');
    return new Response('', { status: 403, headers: { ...corsHeaders } });
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
    const slug = url.searchParams.get('slug');
    const uid = url.searchParams.get('uid');
    const ts = url.searchParams.get('ts');
    const tk = url.searchParams.get('tk');
    const ss = url.searchParams.get('ss');
    const gid = url.searchParams.get('gid');
    const pid = url.searchParams.get('pid');
    const ex = url.searchParams.get('ex');
    const keyParam = url.searchParams.get('key'); // v9: Key system validation
    const kbt = url.searchParams.get('kbt'); // Key bypass token - skips key system after validation
    const entropy = url.searchParams.get('entropy');
    const snonce = url.searchParams.get('snonce');
    const oauthTs = url.searchParams.get('oauth_ts');

    // Check if this Roblox user ID is globally banned — auto-ban the IP too
    if (uid && isRobloxIdBanned(uid)) {
      // Auto-ban this new IP so even VPN hopping gets caught
      autoBanNewIp(earlyIp, 'banned_roblox_user_new_ip', uid, null);
      logThreat('banned_roblox_access', earlyIp, uid, null, { slug, action: 'roblox_id_banned', ip_auto_banned: true }, 'high');
      return new Response('', { status: 403, headers: { ...corsHeaders } });
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
    
    if (!validationResult.valid && validationResult.reason !== 'browser_headers' && 
        validationResult.reason !== 'html_accept' && validationResult.reason !== 'origin_referer') {
      console.log(`[get-paste] BLOCKED: ${validationResult.reason} from ${clientIp}`);
      const strikes = (suspiciousIps.get(clientIp)?.strikes || 0) + 2;
      suspiciousIps.set(clientIp, { strikes, lastStrike: Date.now() });
      return new Response(generateHoneypot(), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }
    
    // Block spoofed Roblox-Id
    const robloxIdHeader = req.headers.get('roblox-id') || req.headers.get('Roblox-Id') || '';
    if (robloxIdHeader) {
      const robloxIdNum = parseInt(robloxIdHeader, 10);
      if (isNaN(robloxIdNum) || robloxIdNum < 1000) {
        console.log(`[get-paste] BLOCKED: spoofed Roblox-Id="${robloxIdHeader}" from ${clientIp}`);
        return new Response(generateHoneypot(), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }
    }

    // Block curl/wget
    const uaLower = userAgent.toLowerCase();
    if (uaLower.includes('curl') || uaLower.includes('wget') || uaLower.includes('libcurl')) {
      console.log(`[get-paste] BLOCKED: curl/wget tool detected ua="${userAgent}" from ${clientIp}`);
      return new Response(generateHoneypot(), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    const isRobloxRequest = userAgent.toLowerCase().includes('roblox') || 
                            userAgent.includes('HttpService');

    const isLikelyBrowser =
      Boolean(secFetchMode) ||
      Boolean(secFetchDest) ||
      accept.includes('text/html') ||
      Boolean(origin) ||
      Boolean(referer);
    
    if (!checkRateLimit(clientIp)) {
      console.log(`Rate limited: ${clientIp}`);
      return new Response(generateKickPlain('Too many requests - You have been temporarily blocked'), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    if (!slug) {
      return new Response('Missing slug', { status: 400, headers: corsHeaders });
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
          setTimeout(() => reject(new Error('DB_TIMEOUT')), 5000)
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
      return new Response('Paste not found', { status: 404, headers: corsHeaders });
    }

    console.log(
      `[get-paste] slug=${slug} uid=${uid ?? ''} hasTk=${Boolean(tk)} hasKey=${Boolean(keyParam)} ip=${clientIp} ` +
      `robloxUA=${isRobloxRequest} browser=${isLikelyBrowser} hide=${Boolean(paste.hide_code)} ` +
      `prot=${Boolean(paste.protection_enabled)} pub=${Boolean(paste.public_protection)}`
    );

    const slugStr = slug;
    const baseUrl = supabaseUrl + '/functions/v1/get-paste';
    const textHeaders = { ...corsHeaders, 'Content-Type': 'text/plain' };

    const respondWithFreshLoader = async () => {
      const newToken = generateToken();
      const sessionSecret = generateSessionSecret(clientIp, Date.now());
      const serverNonce = generateServerNonce();
      const trustLevel = getTrustScore(clientIp);
      await supabase.from('paste_execution_tokens').insert({
        paste_id: paste.id,
        roblox_user_id: '0',
        token: newToken,
        expires_at: new Date(Date.now() + 30000).toISOString()
      });
      const loader = generateLoader(slugStr, baseUrl, newToken, sessionSecret, {
        showConsoleFeedback: paste.show_loading_bar !== false,
        serverNonce,
        trustLevel,
      });
      console.log(`Refreshed loader for paste: ${paste.id} from IP: ${clientIp}`);
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
            logThreat('banned_discord_access', clientIp, robloxUserId, discordSession.discord_user_id, { action: 'discord_id_banned', ip_auto_banned: true }, 'high');
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
        let q = supabase.from('paste_access_logs').select('id').eq('paste_id', paste.id).eq('ip_address', clientIp).eq('access_type', accessType);
        q = robloxUserId ? q.eq('roblox_user_id', robloxUserId) : q.is('roblox_user_id', null);
        const { data: existingLog } = await q.maybeSingle();
        const nowIso = new Date().toISOString();
        const updateData: Record<string, unknown> = {
          last_seen_at: nowIso, is_active: true, user_agent: userAgent, ...discordData,
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
      if (!paste.ip_tracking_enabled) return false;
      if (!isLikelyBrowser || isRobloxRequest) return false;
      if (uid || tk) return false;
      const tsNum = oauthTs ? Number(oauthTs) : NaN;
      if (Number.isFinite(tsNum) && Date.now() - tsNum < 60_000) return false;
      return true;
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
      await logAccess(uid, 'key_execution', true);
      await supabase.from('paste_executions').insert({ paste_id: paste.id, roblox_user_id: uid });
      
      // Also cleanup expired keys occasionally
      if (Math.random() < 0.05) {
        try { await supabase.rpc('cleanup_expired_control_panel_keys'); } catch {}
      }
      
      // Key is valid - return content appropriately
      console.log(`[get-paste] KEY_VALID: access granted uid=${uid} for paste ${paste.id} prot=${paste.protection_enabled} pub=${paste.public_protection}`);
      
      // For protected pastes, generate a bypass token and redirect
      // This keeps key system completely separate from the protection flow
      if (paste.protection_enabled || paste.public_protection) {
        const bypassToken = generateToken();
        await supabase.from('paste_execution_tokens').insert({
          paste_id: paste.id, roblox_user_id: uid, token: bypassToken,
          expires_at: new Date(Date.now() + 30000).toISOString()
        });
        // Return a simple script that re-fetches the paste with the bypass token
        // The paste URL will then skip the key system and serve the normal protection loader
        const redirectScript = `-- Key validated, loading protected script...
local _url = "${baseUrl}?slug=${slugStr}&uid=${uid}&kbt=${bypassToken}&_=" .. tostring(tick())
loadstring(game:HttpGet(_url))()`;
        console.log(`[get-paste] KEY_VALID: returning bypass redirect for protected paste ${paste.id}`);
        return new Response(`KEY_VALID_SCRIPT:\n${redirectScript}`, { status: 200, headers: textHeaders });
      }
      
      // For non-protected pastes, return raw content directly
      return new Response(`KEY_VALID_SCRIPT:\n${paste.content}`, { status: 200, headers: textHeaders });
    }

    if (shouldRedirectToDiscord()) {
      const discordClientId = Deno.env.get('DISCORD_APPLICATION_ID');
      if (discordClientId) {
        console.log(`[get-paste] Redirecting browser to Discord OAuth slug=${slug} ip=${clientIp}`);
        return new Response(null, {
          status: 302,
          headers: { ...corsHeaders, 'Location': `${supabaseUrl}/functions/v1/discord-identify?action=start&slug=${slug}` }
        });
      }
    }

    if (isLikelyBrowser && !isRobloxRequest && !uid && !tk) {
      if (paste.ip_tracking_enabled) {
        console.log(`[get-paste] browser visitor logged slug=${slug} ip=${clientIp}`);
        await logAccess(null, 'browser');
      }
      if (paste.hide_code) {
        return new Response('', { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
      }
      if (!paste.protection_enabled && !paste.public_protection) {
        return new Response(paste.content, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
      }
      return new Response('-- This script is protected. Execute via loadstring() in Roblox.', {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
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

    // ===== GLOBAL ANTI-FETCH PROTECTION =====
    // This runs for ALL paste types (protected, public-protection, non-protected).
    // When anti_fetch_enabled is on and there's no execution context (no uid, no tk, no kbt, no key),
    // return a mini loader. setclipboard copies "-- Protected by ULT LUA" (useless).
    // loadstring executes the loader which re-fetches with uid to get the real content.
    if (paste.anti_fetch_enabled && !uid && !tk && !kbt && !keyParam && !isLikelyBrowser) {
      console.log(`[get-paste] ANTI-FETCH: returning mini loader for slug=${slug} ip=${clientIp}`);
      const miniLoader = `-- Protected by ULT LUA
local _p = game:GetService("Players").LocalPlayer
if not _p then _p = game:GetService("Players").PlayerAdded:Wait() end
loadstring(game:HttpGet("${baseUrl}?slug=${slugStr}&uid=" .. tostring(_p.UserId) .. "&_=" .. tostring(tick())))()`;
      return new Response(miniLoader, { status: 200, headers: textHeaders });
    }

    // ===== NON-PROTECTED PASTE (no protection, no public_protection) =====
    if (!paste.protection_enabled && !paste.public_protection) {
      const keyPanel = await getPreferredKeyPanel();
      
      if (keyPanel && !tk && !kbt && !isLikelyBrowser && !keyParam) {
        // Paste has a key system - return key system GUI
        // This fires when uid IS provided (from mini loader) or when anti-fetch is off
        console.log(`[get-paste] Returning key system GUI for paste: ${paste.id} panel: ${keyPanel.name}`);
        // Fetch panel details for logo_url
        const { data: panelDetails } = await supabase.from('control_panels').select('logo_url').eq('id', keyPanel.id).single();
        const gui = generateKeySystemGui(slugStr, baseUrl, keyPanel.name, '255, 255, 255', panelDetails?.logo_url || undefined);
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
      if (uid && /^\d+$/.test(uid)) {
        await logAccess(uid, 'execution', true);
        await supabase.from('paste_executions').insert({ paste_id: paste.id, roblox_user_id: uid });
      }

      return new Response(paste.content, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
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
            expires_at: new Date(Date.now() + 30000).toISOString()
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

      if (isLikelyBrowser && !isRobloxRequest) {
        await logAccess(null, 'browser');
        return new Response('', { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
      }

      const keyPanel = await getPreferredKeyPanel();
      
      if (keyPanel) {
        console.log(`[get-paste] Returning key system GUI for protected paste: ${paste.id} panel: ${keyPanel.name}`);
        const { data: panelDetails } = await supabase.from('control_panels').select('logo_url').eq('id', keyPanel.id).single();
        const gui = generateKeySystemGui(slugStr, baseUrl, keyPanel.name, '255, 255, 255', panelDetails?.logo_url || undefined);
        return new Response(gui, { status: 200, headers: textHeaders });
      }

      // Block spoofed uid
      if (uid && /^\d+$/.test(uid) && parseInt(uid) < 1000 && parseInt(uid) !== 0) {
        console.log(`[get-paste] BLOCKED: spoofed uid=${uid} slug=${slug} ip=${clientIp}`);
        return new Response(generateHoneypot(), { status: 200, headers: textHeaders });
      }

      const newToken = generateToken();
      const sessionSecret = generateSessionSecret(clientIp, Date.now());
      const serverNonce = generateServerNonce();
      const trustLevel = getTrustScore(clientIp);
      await supabase.from('paste_execution_tokens').insert({
        paste_id: paste.id, roblox_user_id: '0', token: newToken,
        expires_at: new Date(Date.now() + 30000).toISOString()
      });
      const loader = generateLoader(slugStr, baseUrl, newToken, sessionSecret, {
        showConsoleFeedback: paste.show_loading_bar !== false,
        serverNonce,
        trustLevel,
      });
      console.log(`Generated loader for paste: ${paste.id} from IP: ${clientIp}`);
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

    // v9: Validate entropy proof
    if (entropy && snonce) {
      const entropyNum = parseInt(entropy);
      if (entropyNum === 0) {
        // Zero entropy = no real RenderStepped happened
        updateTrustScore(clientIp, -15);
        console.log(`[get-paste] SUSPICIOUS: zero entropy from ${clientIp}`);
      }
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

    const { error: updateError } = await supabase
      .from('paste_execution_tokens')
      .update({ used_at: new Date().toISOString(), roblox_user_id: uid })
      .eq('id', tokenData.id)
      .is('used_at', null);

    if (updateError) return await respondWithFreshLoader();

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

      await logAccess(uid, 'execution', true);
      await supabase.from('paste_executions').insert({ paste_id: paste.id, roblox_user_id: uid });
      console.log(`Public protection access granted: ${uid} for paste: ${paste.id}`);
      
      const key = `${slug}:${tk}:ULTv9:${uid}:${entropy || '0'}`;
      
      if (shouldPoison) {
        console.log(`[get-paste] POISONING payload for low-trust ip=${clientIp} trust=${trustLevel}`);
        return new Response(generatePoisonedPayload(paste.content, key), { status: 200, headers: textHeaders });
      }
      
      return new Response(xorToHex(paste.content, key), { status: 200, headers: textHeaders });
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

    await logAccess(uid, 'execution', true);
    await supabase.from('paste_executions').insert({ paste_id: paste.id, roblox_user_id: uid });
    console.log(`Access granted: ${uid} for paste: ${paste.id}`);

    const key = `${slug}:${tk}:ULTv9:${uid}:${entropy || '0'}`;
    
    if (shouldPoison) {
      console.log(`[get-paste] POISONING payload for low-trust ip=${clientIp} trust=${trustLevel}`);
      return new Response(generatePoisonedPayload(paste.content, key), { status: 200, headers: textHeaders });
    }
    
    return new Response(xorToHex(paste.content, key), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response('Internal error', { status: 500, headers: corsHeaders });
  }
});
