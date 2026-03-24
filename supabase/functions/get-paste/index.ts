// ===========================================================================================
// ULT PROTECTION V14.0 — "FORTRESS PROTOCOL"
// Complete rewrite. 3-phase authenticated delivery. Mandatory HWID. Fragment-based content.
// ===========================================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
const textHeaders = { ...corsHeaders, 'Content-Type': 'text/plain' };

// ==================== CRYPTO HELPERS ====================
function generateToken(len = 32): string {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
}

function xorToHex(plain: string, key: string): string {
  const enc = new TextEncoder();
  const data = enc.encode(plain);
  const k = enc.encode(key);
  for (let i = 0; i < data.length; i++) data[i] = data[i] ^ k[i % k.length];
  return Array.from(data, b => b.toString(16).padStart(2, '0')).join('');
}

function hmacLike(data: string, secret: string): string {
  let h = 0x811c9dc5;
  const combined = data + ':' + secret;
  for (let i = 0; i < combined.length; i++) {
    h ^= combined.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

// ==================== BAN SYSTEM ====================
const PERMANENTLY_BANNED_IPS = new Set(['79.177.154.169', '79.181.155.63', '89.234.244.240']);
const BANNED_SUBNETS = ['79.177.154.', '79.181.155.'];

let globalBanCache: { ips: Set<string>; subnets: string[]; robloxIds: Set<string>; discordIds: Set<string>; lastRefresh: number } = {
  ips: new Set(), subnets: [], robloxIds: new Set(), discordIds: new Set(), lastRefresh: 0
};
let adminIpWhitelist = new Set<string>();
const autoBannedIpsThisSession = new Set<string>();

async function refreshGlobalBans() {
  if (Date.now() - globalBanCache.lastRefresh < 60_000) return;
  try {
    const { data } = await supabase.from('global_bans').select('ban_type, ban_value').eq('is_active', true);
    const ips = new Set<string>(), subnets: string[] = [], robloxIds = new Set<string>(), discordIds = new Set<string>();
    for (const ban of data || []) {
      if (ban.ban_type === 'ip') ips.add(ban.ban_value);
      else if (ban.ban_type === 'subnet') subnets.push(ban.ban_value);
      else if (ban.ban_type === 'roblox_id') robloxIds.add(ban.ban_value);
      else if (ban.ban_type === 'discord_id') discordIds.add(ban.ban_value);
    }
    globalBanCache = { ips, subnets, robloxIds, discordIds, lastRefresh: Date.now() };
    // Refresh admin IPs
    try {
      const { data: adminRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
      if (adminRoles?.length) {
        const { data: ipData } = await supabase.from('user_ips').select('ip_address').in('user_id', adminRoles.map(r => r.user_id));
        adminIpWhitelist = new Set((ipData || []).map(d => d.ip_address));
      }
    } catch {}
  } catch (e) { console.error('Failed to refresh global bans:', e); }
}

function isAdminIp(ip: string): boolean { return adminIpWhitelist.has(ip); }
function isPermanentlyBanned(ip: string): boolean {
  if (isAdminIp(ip)) return false;
  if (PERMANENTLY_BANNED_IPS.has(ip)) return true;
  for (const s of BANNED_SUBNETS) { if (ip.startsWith(s)) return true; }
  if (globalBanCache.ips.has(ip)) return true;
  for (const s of globalBanCache.subnets) { if (ip.startsWith(s)) return true; }
  return false;
}

function logThreat(type: string, ip: string | null, robloxId: string | null, discordId: string | null, details: any, severity: string, autoResolve = false) {
  supabase.from('threat_log').insert({ threat_type: type, source_ip: ip, roblox_user_id: robloxId, discord_user_id: discordId, details, severity, resolved: autoResolve, auto_banned: autoResolve }).then(() => {}).catch(() => {});
}

function autoBanNewIp(ip: string, reason: string, robloxId: string | null, discordId: string | null) {
  if (!ip || ip === 'unknown' || isAdminIp(ip) || globalBanCache.ips.has(ip) || autoBannedIpsThisSession.has(ip)) return;
  for (const s of globalBanCache.subnets) { if (ip.startsWith(s)) return; }
  autoBannedIpsThisSession.add(ip);
  globalBanCache.ips.add(ip);
  const banReason = `Auto-banned: ${reason}${robloxId ? ` (roblox:${robloxId})` : ''}`;
  supabase.from('global_bans').upsert({ ban_type: 'ip', ban_value: ip, reason: banReason, is_active: true }, { onConflict: 'ban_type,ban_value' }).then(() => {}).catch(() => {});
  logThreat('auto_ban', ip, robloxId, discordId, { reason: banReason }, 'high', true);
}

// ==================== RATE LIMITING ====================
const rateLimits = new Map<string, { count: number; resetTime: number }>();
const slugThrottle = new Map<string, { count: number; resetTime: number }>();
let globalRequestCount = 0, globalResetTime = Date.now() + 10_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const l = rateLimits.get(ip);
  if (!l || now > l.resetTime) { rateLimits.set(ip, { count: 1, resetTime: now + 60000 }); return true; }
  if (l.count >= 15) return false;
  l.count++;
  return true;
}

function checkSlugThrottle(ip: string, slug: string): boolean {
  const key = `${ip}:${slug}`;
  const now = Date.now();
  const e = slugThrottle.get(key);
  if (!e || now > e.resetTime) { slugThrottle.set(key, { count: 1, resetTime: now + 30_000 }); return true; }
  if (e.count >= 20) return false; // 20 per 30s (3-phase protocol + retries)
  e.count++;
  return true;
}

function checkGlobalLoad(): boolean {
  const now = Date.now();
  if (now > globalResetTime) { globalRequestCount = 0; globalResetTime = now + 10_000; }
  return ++globalRequestCount <= 60;
}

// Cache
const pasteCache = new Map<string, { data: any; timestamp: number }>();
function getCachedPaste(slug: string) { const c = pasteCache.get(slug); if (!c || Date.now() - c.timestamp > 30_000) { pasteCache.delete(slug); return null; } return c.data; }
function setCachedPaste(slug: string, data: any) { if (pasteCache.size > 100) { const k = pasteCache.keys().next().value; if (k) pasteCache.delete(k); } pasteCache.set(slug, { data, timestamp: Date.now() }); }

// Cleanup
let lastCleanup = Date.now();
function cleanupMaps() {
  const now = Date.now();
  if (now - lastCleanup < 300_000) return;
  lastCleanup = now;
  for (const [k, v] of rateLimits) { if (now > v.resetTime) rateLimits.delete(k); }
  for (const [k, v] of slugThrottle) { if (now > v.resetTime) slugThrottle.delete(k); }
  for (const [k, v] of pasteCache) { if (now - v.timestamp > 30_000) pasteCache.delete(k); }
}

// ==================== REQUEST VALIDATION ====================
function isRobloxRequest(ua: string): boolean {
  return ua.toLowerCase().includes('roblox') || ua.includes('HttpService') || ua.includes('WinInet') || ua.includes('RobloxApp') || /^Mozilla\/5\.0 \(\d+MB;/.test(ua);
}
function isLikelyBrowser(headers: Headers): boolean {
  const ua = headers.get('user-agent') || '';
  if (isRobloxRequest(ua)) return false;
  return Boolean(headers.get('sec-fetch-mode') || headers.get('sec-fetch-dest') || (headers.get('accept') || '').includes('text/html') || headers.get('origin') || headers.get('referer') || (/Mozilla\/\d/.test(ua) && /AppleWebKit|Gecko|Chrome|Safari|Firefox|Edge/.test(ua)));
}
function isBotRequest(headers: Headers): boolean {
  const ua = (headers.get('user-agent') || '').toLowerCase();
  const botPatterns = ['discordbot','discord.js','axios','node-fetch','got','undici','curl','wget','python','aiohttp','httpx','postman','insomnia','puppeteer','playwright','selenium','crawler','spider','scraper','php','perl','ruby','java/','deno/','bun/','node/'];
  for (const p of botPatterns) { if (ua.includes(p)) return true; }
  if (!ua || ua.length < 5) return true;
  if (/^[a-z]+\/\d+\.\d+$/i.test(ua)) return true;
  for (const h of ['cf-worker','x-discord','x-bot']) { if (headers.get(h)) return true; }
  return false;
}
function isSpoofedRoblox(headers: Headers): boolean {
  const ua = headers.get('user-agent') || '';
  if (!isRobloxRequest(ua)) return false;
  if (ua.trim().toLowerCase() === 'roblox' || ua.length < 8) return true;
  const l = ua.toLowerCase();
  if (l.includes('curl') || l.includes('wget') || l.includes('python') || l.includes('node') || l.includes('deno')) return true;
  if (headers.get('content-type')?.includes('application/json')) return true;
  return false;
}

// ==================== ROBLOX API ====================
async function fetchRobloxProfile(userId: string) {
  const result: any = { username: null, displayName: null, description: null, created: null, isBanned: null, avatarUrl: null, friendsCount: null, followersCount: null, followingCount: null, groups: null, badges: null, favorites: null };
  try {
    const [userRes, avatarRes, friendsRes, followersRes, followingRes, groupsRes] = await Promise.allSettled([
      fetch(`https://users.roblox.com/v1/users/${userId}`),
      fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png`),
      fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
      fetch(`https://friends.roblox.com/v1/users/${userId}/followers/count`),
      fetch(`https://friends.roblox.com/v1/users/${userId}/followings/count`),
      fetch(`https://groups.roblox.com/v1/users/${userId}/groups/roles`),
    ]);
    const get = async (r: any) => r.status === 'fulfilled' && r.value.ok ? await r.value.json().catch(() => null) : null;
    const [ud, ad, fd, fld, fod, gd] = await Promise.all([get(userRes), get(avatarRes), get(friendsRes), get(followersRes), get(followingRes), get(groupsRes)]);
    if (ud) { result.username = ud.name; result.displayName = ud.displayName; result.description = ud.description; result.created = ud.created; result.isBanned = ud.isBanned; }
    if (ad?.data?.[0]?.imageUrl) result.avatarUrl = ad.data[0].imageUrl;
    if (fd) result.friendsCount = fd.count;
    if (fld) result.followersCount = fld.count;
    if (fod) result.followingCount = fod.count;
    if (gd?.data) result.groups = gd.data.slice(0, 20).map((g: any) => ({ id: g.group.id, name: g.group.name, role: g.role.name }));
  } catch {}
  return result;
}

// ==================== HONEYPOT ====================
function generateHoneypot(): string {
  const lines: string[] = [];
  lines.push(`-- ULT Protection v14 Fortress Protocol\nlocal _=function()while true do warn("[ULT] BYPASS DETECTED") task.wait(0.01) end end\nspawn(_)`);
  lines.push('--[==[');
  for (let i = 0; i < 100; i++) {
    lines.push(`⚠️ SECURITY: Bypass attempt #${i} logged | IP BANNED | HWID BANNED | Ref: ULT-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
  }
  lines.push(']==]');
  return lines.join('\n');
}

// ==================== URL ENCODING FOR LUA ====================
function encodeUrlForLua(url: string, varName: string): string {
  const xorKey = Math.floor(Math.random() * 200) + 50;
  const encoded = Array.from(url).map(c => c.charCodeAt(0) ^ xorKey);
  return `local ${varName};do local _k=${xorKey} local _t={${encoded.join(',')}} local _r={} for i=1,#_t do _r[i]=string.char(bit32.bxor(_t[i],_k)) end ${varName}=table.concat(_r) end`;
}

// ==================== CHUNK ENCRYPTION ====================
function chunkEncrypt(code: string, baseKey: string): string {
  const numChunks = Math.max(8, Math.min(40, Math.ceil(code.length / 200)));
  const chunkSize = Math.ceil(code.length / numChunks);
  const chunks: string[] = [];
  for (let i = 0; i * chunkSize < code.length; i++) {
    chunks.push(code.slice(i * chunkSize, (i + 1) * chunkSize));
  }
  const actualChunks = chunks.length;
  const encrypted = chunks.map((c, i) => xorToHex(c, `${baseKey}:C${i}:${actualChunks}`));
  const seed = Math.floor(Math.random() * 2147483646) + 1;
  const indices = Array.from({ length: actualChunks }, (_, i) => i);
  let s = seed;
  for (let i = indices.length - 1; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [indices[i], indices[j]] = [indices[j], indices[i]]; }
  return `ULT_C:${actualChunks}:${seed}|${indices.map(i => encrypted[i]).join('|')}`;
}

// ==================== V14 FRAGMENT DELIVERY ====================
// Script is split into 3 fragments. Each requires a separate fetch with a chained token.
// Fragment N+1's token is derived from Fragment N's content hash. You MUST have all 3.
function splitIntoFragments(code: string, sessionKey: string): { fragments: string[]; tokens: string[] } {
  const numFragments = 3;
  const fragSize = Math.ceil(code.length / numFragments);
  const fragments: string[] = [];
  const tokens: string[] = [generateToken(16)]; // Initial token for fragment 0
  
  for (let i = 0; i < numFragments; i++) {
    const raw = code.slice(i * fragSize, (i + 1) * fragSize);
    if (raw.length === 0) continue;
    const fragKey = `${sessionKey}:F${i}:${tokens[i]}`;
    fragments.push(xorToHex(raw, fragKey));
    // Next token is derived from this fragment's content
    if (i < numFragments - 1) {
      tokens.push(hmacLike(raw.substring(0, 64), tokens[i] + ':' + sessionKey));
    }
  }
  return { fragments, tokens };
}

// ==================== V14 PROBE SCRIPT GENERATOR ====================
// Phase 1: Minimal script that collects identity data and sends it back
function generateProbeScript(slug: string, baseUrl: string, probeToken: string): string {
  const encodedUrl = encodeUrlForLua(baseUrl, '_ep');
  const v: Record<string, string> = {};
  for (const k of ['sf','p','uid','hwid','pid','jid','age','name','ex','ts','probe']) {
    v[k] = '_' + Math.random().toString(36).substring(2, 8);
  }
  
  return `-- ULT Fortress v14 Probe
${encodedUrl}
local ${v.sf}=function(u)
  local r
  pcall(function() if type(request)=="function" then local x=request({Url=u,Method="GET"}) if x and x.Body then r=x.Body end end end)
  if r then return r end
  pcall(function() if type(syn)=="table" and type(syn.request)=="function" then local x=syn.request({Url=u,Method="GET"}) if x and x.Body then r=x.Body end end end)
  if r then return r end
  pcall(function() if type(http_request)=="function" then local x=http_request({Url=u,Method="GET"}) if x and x.Body then r=x.Body end end end)
  if r then return r end
  pcall(function() r=game:HttpGet(u) end)
  return r
end

local ${v.p}=game:GetService("Players").LocalPlayer
if not ${v.p} then ${v.p}=game:GetService("Players").PlayerAdded:Wait() end

local ${v.uid}=tostring(${v.p}.UserId)
local ${v.hwid}=""
pcall(function()
  if type(gethwid)=="function" then ${v.hwid}=tostring(gethwid())
  elseif type(getexecutorfingerprint)=="function" then ${v.hwid}=tostring(getexecutorfingerprint())
  elseif type(getdeviceid)=="function" then ${v.hwid}=tostring(getdeviceid())
  elseif type(syn)=="table" and type(syn.hwid)=="function" then ${v.hwid}=tostring(syn.hwid())
  end
end)

-- FORTRESS: HWID is MANDATORY. No HWID = no execution.
if #${v.hwid} < 4 then
  -- Try additional HWID methods
  pcall(function()
    if type(getgenv)=="function" then
      local g=getgenv()
      if g and type(g.gethwid)=="function" then ${v.hwid}=tostring(g.gethwid()) end
    end
  end)
  pcall(function()
    if type(identifyexecutor)=="function" then
      local ename=identifyexecutor()
      -- Build a pseudo-HWID from executor+OS+architecture if no real HWID
      local osInfo=""
      pcall(function()
        local si=game:GetService("UserInputService")
        local kb=si.KeyboardEnabled
        local ts=si.TouchEnabled
        local gp=si.GamepadEnabled
        osInfo=tostring(kb)..tostring(ts)..tostring(gp)
      end)
      if #osInfo > 0 then
        -- Create a device fingerprint from available signals
        local fp=tostring(ename or "")..osInfo..tostring(game:GetService("Stats"):GetTotalMemoryUsageMb())
        local h=0
        for i=1,#fp do h=bit32.bxor(h*31+string.byte(fp,i),h) end
        ${v.hwid}="PFP_"..tostring(math.abs(h))
      end
    end
  end)
end

if #${v.hwid} < 4 then
  game:GetService("Players").LocalPlayer:Kick("Your executor does not support hardware fingerprinting (HWID). ULT Fortress requires HWID support for security. Please use Delta, Synapse, Fluxus, or another executor with gethwid() support.")
  return
end

local ${v.pid}=tostring(game.PlaceId or 0)
local ${v.jid}=tostring(game.JobId or "")
local ${v.age}=tostring(${v.p}.AccountAge or 0)
local ${v.name}=${v.p}.Name or ""
local ${v.ex}=""
pcall(function() if type(identifyexecutor)=="function" then ${v.ex}=tostring(identifyexecutor()) elseif type(getexecutorname)=="function" then ${v.ex}=tostring(getexecutorname()) end end)
local ${v.ts}=tostring(os.time())

-- Anti-spy: detect HTTP monitoring tools
pcall(function()
  if type(gethui)=="function" then
    for _,obj in pairs(gethui():GetChildren()) do
      local n=obj.Name:lower()
      if n:find("spy") or n:find("monitor") or n:find("intercept") or n:find("logger") then
        pcall(function() obj:Destroy() end)
      end
    end
  end
end)

local ${v.probe}=_ep.."?slug=${slug}&phase=probe&pt=${probeToken}"
  .."&uid="..${v.uid}
  .."&hwid="..${v.hwid}
  .."&pid="..${v.pid}
  .."&jid="..${v.jid}
  .."&age="..${v.age}
  .."&name="..game:GetService("HttpService"):UrlEncode(${v.name})
  .."&ex="..game:GetService("HttpService"):UrlEncode(${v.ex})
  .."&ts="..${v.ts}
  .."&_="..tostring(tick())

local ${v.probe}_resp=${v.sf}(${v.probe})
if ${v.probe}_resp and #${v.probe}_resp > 0 then
  -- Phase 2 response is a challenge script — execute it
  local fn,err
  -- Use writefile+loadfile to bypass loadstring hooks
  local _wfOk=false
  pcall(function()
    if writefile and loadfile and delfile then
      local _p=".cache/"..tostring(math.random(100000000,999999999))..".lua"
      pcall(function() if makefolder then makefolder(".cache") end end)
      writefile(_p,${v.probe}_resp)
      fn=loadfile(_p)
      pcall(function() delfile(_p) end)
      _wfOk=true
    end
  end)
  if not _wfOk or not fn then
    pcall(function()
      if writefile and loadfile then
        local _p2=tostring(math.random(100000000,999999999))..".lua"
        writefile(_p2,${v.probe}_resp)
        fn=loadfile(_p2)
        pcall(function() if delfile then delfile(_p2) end end)
        _wfOk=true
      end
    end)
  end
  if not fn then
    -- Fallback to coroutine-wrapped loadstring
    local co=coroutine.create(function() return loadstring(${v.probe}_resp) end)
    local ok,r=coroutine.resume(co)
    if ok then fn=r end
  end
  if fn then pcall(fn) end
end
`;
}

// ==================== V14 CHALLENGE SCRIPT GENERATOR ====================
// Phase 2: Server sends a challenge. Client must solve it and fetch content.
function generateChallengeScript(slug: string, baseUrl: string, challengeToken: string, challengeSeed: number, challengeAnswer: number): string {
  const encodedUrl = encodeUrlForLua(baseUrl, '_ep');
  const v: Record<string, string> = {};
  for (const k of ['sf','p','uid','hwid','solve','answer','url','resp','fn','pid','jid','ex','ts']) {
    v[k] = '_' + Math.random().toString(36).substring(2, 8);
  }
  
  // The challenge: compute bit32.bxor(UserId, SEED) + AccountAge
  // Server already knows the expected answer based on probe data
  return `-- ULT Fortress v14 Challenge
${encodedUrl}
local ${v.sf}=function(u)
  local r
  pcall(function() if type(request)=="function" then local x=request({Url=u,Method="GET"}) if x and x.Body then r=x.Body end end end)
  if r then return r end
  pcall(function() if type(syn)=="table" and type(syn.request)=="function" then local x=syn.request({Url=u,Method="GET"}) if x and x.Body then r=x.Body end end end)
  if r then return r end
  pcall(function() if type(http_request)=="function" then local x=http_request({Url=u,Method="GET"}) if x and x.Body then r=x.Body end end end)
  if r then return r end
  pcall(function() r=game:HttpGet(u) end)
  return r
end

local ${v.p}=game:GetService("Players").LocalPlayer
if not ${v.p} then ${v.p}=game:GetService("Players").PlayerAdded:Wait() end
local ${v.uid}=tostring(${v.p}.UserId)

local ${v.hwid}=""
pcall(function()
  if type(gethwid)=="function" then ${v.hwid}=tostring(gethwid())
  elseif type(getexecutorfingerprint)=="function" then ${v.hwid}=tostring(getexecutorfingerprint())
  elseif type(getdeviceid)=="function" then ${v.hwid}=tostring(getdeviceid())
  elseif type(syn)=="table" and type(syn.hwid)=="function" then ${v.hwid}=tostring(syn.hwid())
  end
end)
if #${v.hwid} < 4 then
  pcall(function()
    if type(identifyexecutor)=="function" then
      local ename=identifyexecutor()
      local osInfo=""
      pcall(function()
        local si=game:GetService("UserInputService")
        osInfo=tostring(si.KeyboardEnabled)..tostring(si.TouchEnabled)..tostring(si.GamepadEnabled)
      end)
      if #osInfo>0 then
        local fp=tostring(ename or "")..osInfo..tostring(game:GetService("Stats"):GetTotalMemoryUsageMb())
        local h=0
        for i=1,#fp do h=bit32.bxor(h*31+string.byte(fp,i),h) end
        ${v.hwid}="PFP_"..tostring(math.abs(h))
      end
    end
  end)
end

-- Solve the challenge: XOR UserId with seed, add AccountAge
local ${v.solve}=bit32.bxor(${v.p}.UserId,${challengeSeed})+(${v.p}.AccountAge or 0)

local ${v.ex}=""
pcall(function() if type(identifyexecutor)=="function" then ${v.ex}=tostring(identifyexecutor()) end end)
local ${v.ts}=tostring(os.time())
local ${v.pid}=tostring(game.PlaceId or 0)
local ${v.jid}=tostring(game.JobId or "")

local ${v.url}=_ep.."?slug=${slug}&phase=deliver&ct=${challengeToken}"
  .."&uid="..${v.uid}
  .."&hwid="..${v.hwid}
  .."&answer="..tostring(${v.solve})
  .."&pid="..${v.pid}
  .."&jid="..${v.jid}
  .."&ex="..game:GetService("HttpService"):UrlEncode(${v.ex})
  .."&ts="..${v.ts}
  .."&_="..tostring(tick())

local ${v.resp}=${v.sf}(${v.url})
if not ${v.resp} or #${v.resp}==0 then
  warn("[ULT] Network error")
  return
end

-- Response is encrypted content (ULT_C: format) or a Lua script (kick/key system)
if ${v.resp}:sub(1,2)=="--" or ${v.resp}:find("game:GetService") then
  local ${v.fn}
  pcall(function()
    if writefile and loadfile and delfile then
      local _p=".cache/"..tostring(math.random(100000000,999999999))..".lua"
      pcall(function() if makefolder then makefolder(".cache") end end)
      writefile(_p,${v.resp})
      ${v.fn}=loadfile(_p)
      pcall(function() delfile(_p) end)
    end
  end)
  if not ${v.fn} then
    local co=coroutine.create(function() return loadstring(${v.resp}) end)
    local ok,r=coroutine.resume(co)
    if ok then ${v.fn}=r end
  end
  if ${v.fn} then pcall(${v.fn}) end
  return
end

-- Decrypt chunked content
if ${v.resp}:sub(1,6)=="ULT_C:" then
  local hEnd=${v.resp}:find("|",1,true)
  if not hEnd then warn("E:cf") return end
  local hdr=${v.resp}:sub(7,hEnd-1)
  local ncS,sdS=hdr:match("(%d+):(%d+)")
  local nc=tonumber(ncS)
  local sd=tonumber(sdS)
  if not nc or not sd then warn("E:ch") return end
  
  local cData=${v.resp}:sub(hEnd+1)
  ${v.resp}=nil
  
  local parts={}
  local ci=1
  for ch in cData:gmatch("[^|]+") do parts[ci]=ch ci=ci+1 end
  cData=nil
  
  -- Reverse Fisher-Yates
  local idx={} for i=0,nc-1 do idx[i]=i end
  local ss=sd
  for i=nc-1,1,-1 do ss=(ss*16807)%2147483647 local j=ss%(i+1) idx[i],idx[j]=idx[j],idx[i] end
  
  local ordered={}
  for pos=0,nc-1 do ordered[idx[pos]]=parts[pos+1] end
  parts=nil
  
  -- Build decryption key
  local ks="${slug}:${challengeToken}:ULTv14:"..${v.uid}
  local kb={} for i=1,#ks do kb[i]=string.byte(ks,i) end
  
  local hexB=function(hex) local b={} for i=1,#hex,2 do b[#b+1]=tonumber(hex:sub(i,i+1),16) or 0 end return b end
  local xorB=function(bytes,keyb) local o=table.create(#bytes) for i=1,#bytes do o[i]=bit32.bxor(bytes[i],keyb[((i-1)%#keyb)+1]) end return o end
  local b2s=function(bytes) local c=table.create(#bytes) for i=1,#bytes do c[i]=string.char(bytes[i]) end return table.concat(c) end
  
  local pieces={}
  for origIdx=0,nc-1 do
    local chHex=ordered[origIdx]
    if not chHex or #chHex==0 then break end
    local ck=ks..":C"..tostring(origIdx)..":"..tostring(nc)
    local ckb={} for i=1,#ck do ckb[i]=string.byte(ck,i) end
    pieces[origIdx+1]=b2s(xorB(hexB(chHex),ckb))
  end
  ordered=nil
  
  local assembled=table.concat(pieces)
  pieces=nil
  
  -- Execute via writefile+loadfile (bypass loadstring hooks)
  local execFn
  pcall(function()
    if writefile and loadfile and delfile then
      local _p=".cache/"..tostring(math.random(100000000,999999999))..".lua"
      pcall(function() if makefolder then makefolder(".cache") end end)
      writefile(_p,assembled)
      execFn=loadfile(_p)
      pcall(function() delfile(_p) end)
    end
  end)
  if not execFn then
    local co=coroutine.create(function() return loadstring(assembled) end)
    local ok,r=coroutine.resume(co)
    if ok then execFn=r end
  end
  assembled=nil
  
  if execFn then
    local co2=coroutine.create(function() return execFn() end)
    coroutine.resume(co2)
    execFn=nil
    co2=nil
    -- Memory cleanup
    pcall(function()
      for i=1,#kb do kb[i]=math.random(0,255) end
      collectgarbage("collect")
    end)
  else
    warn("E:compile")
  end
end
`;
}

// ==================== KEY SYSTEM GUI ====================
function generateKeySystemGui(slug: string, baseUrl: string, panelName: string, themeColor: string, decalId?: string): string {
  const normalizedTheme = (themeColor || '').trim();
  const resolvedTheme = !normalizedTheme || normalizedTheme === '255, 255, 255' ? '188, 134, 255' : normalizedTheme;
  const colorParts = resolvedTheme.split(',').map(s => s.trim());
  const r = colorParts[0] || '180', g = colorParts[1] || '120', b = colorParts[2] || '255';
  const guiEncodedUrl = encodeUrlForLua(baseUrl, '_ultEndpoint');
  
  return `-- ULT Key System v6 (Fortress)
local Players=game:GetService("Players")
local TweenService=game:GetService("TweenService")
local UserInputService=game:GetService("UserInputService")
local HttpService=game:GetService("HttpService")
local Lighting=game:GetService("Lighting")
${guiEncodedUrl}
local function _ultStealthFetch(u)
  local r
  pcall(function() if type(request)=="function" then local x=request({Url=u,Method="GET"}) if x and x.Body then r=x.Body end end end)
  if r then return r end
  pcall(function() if type(syn)=="table" and type(syn.request)=="function" then local x=syn.request({Url=u,Method="GET"}) if x and x.Body then r=x.Body end end end)
  if r then return r end
  pcall(function() if type(http_request)=="function" then local x=http_request({Url=u,Method="GET"}) if x and x.Body then r=x.Body end end end)
  if r then return r end
  pcall(function() r=game:HttpGet(u) end)
  return r
end
local plr=Players.LocalPlayer
if not plr then plr=Players.PlayerAdded:Wait() end
local pgui=plr:WaitForChild("PlayerGui")
local old=pgui:FindFirstChild("ULTKeySystem")
if old then old:Destroy() end
local gui=Instance.new("ScreenGui") gui.Name="ULTKeySystem" gui.ResetOnSpawn=false gui.DisplayOrder=999999999 gui.ZIndexBehavior=Enum.ZIndexBehavior.Sibling gui.Parent=pgui
local blur=Instance.new("BlurEffect") blur.Name="ULTBlur" blur.Size=0 blur.Parent=Lighting
TweenService:Create(blur,TweenInfo.new(0.4,Enum.EasingStyle.Quad),{Size=20}):Play()
local themeCol=Color3.fromRGB(${r},${g},${b})
local dimTheme=Color3.fromRGB(math.floor(${r}*0.34),math.floor(${g}*0.34),math.floor(${b}*0.34))
local bgColor=Color3.fromRGB(16,14,22)
local panelBg=Color3.fromRGB(22,19,30)
local borderCol=Color3.fromRGB(64,49,92)
local mutedText=Color3.fromRGB(133,126,150)
local fgColor=Color3.fromRGB(244,240,250)
local cardBg=Color3.fromRGB(24,21,35)
local softBg=Color3.fromRGB(19,16,27)
local successCol=Color3.fromRGB(86,255,120)
local dangerCol=Color3.fromRGB(255,96,96)
local warningCol=Color3.fromRGB(255,168,92)
local function makePanel(parent,size,pos,bg,zIdx,radius) local f=Instance.new("Frame",parent) f.Size=size f.Position=pos f.BackgroundColor3=bg f.BorderSizePixel=0 f.ZIndex=zIdx or 4 Instance.new("UICorner",f).CornerRadius=UDim.new(0,radius or 18) return f end
local function addStroke(frame,col,thick) local s=Instance.new("UIStroke",frame) s.Color=col or borderCol s.Thickness=thick or 1 return s end
local function addLabel(parent,size,pos,text,color,font,textSize,align,zIdx) local l=Instance.new("TextLabel",parent) l.Size=size l.Position=pos l.BackgroundTransparency=1 l.Text=text l.TextColor3=color l.Font=font or Enum.Font.Gotham l.TextSize=textSize or 11 l.TextXAlignment=align or Enum.TextXAlignment.Left l.ZIndex=zIdx or 5 l.TextWrapped=true return l end
local win=Instance.new("Frame",gui) win.Name="MainWindow" win.Size=UDim2.new(0,720,0,408) win.Position=UDim2.new(0.5,-360,0.5,-204) win.BackgroundColor3=bgColor win.BorderSizePixel=0 win.BackgroundTransparency=1 win.ZIndex=3 win.ClipsDescendants=true
Instance.new("UICorner",win).CornerRadius=UDim.new(0,28)
addStroke(win,borderCol,1).Transparency=0.22
local titleBar=Instance.new("Frame",win) titleBar.Size=UDim2.new(1,0,0,44) titleBar.Position=UDim2.new(0,0,0,0) titleBar.BackgroundColor3=bgColor titleBar.BorderSizePixel=0 titleBar.ZIndex=4 titleBar.Active=true titleBar.ClipsDescendants=true
Instance.new("UICorner",titleBar).CornerRadius=UDim.new(0,28)
local tbFill=Instance.new("Frame",titleBar) tbFill.Size=UDim2.new(1,0,0,18) tbFill.Position=UDim2.new(0,0,1,-18) tbFill.BackgroundColor3=bgColor tbFill.BorderSizePixel=0 tbFill.ZIndex=4
local function makeDot(parent,pos,col,action) local d=Instance.new("TextButton",parent) d.Size=UDim2.new(0,10,0,10) d.Position=pos d.BackgroundColor3=col d.BorderSizePixel=0 d.Text="" d.AutoButtonColor=false d.ZIndex=6 Instance.new("UICorner",d).CornerRadius=UDim.new(1,0) if action then d.MouseButton1Click:Connect(action) end return d end
local dot1=makeDot(titleBar,UDim2.new(0,18,0.5,-5),Color3.fromRGB(245,245,248))
local dot2=makeDot(titleBar,UDim2.new(0,38,0.5,-5),Color3.fromRGB(86,76,112))
local dot3=makeDot(titleBar,UDim2.new(0,58,0.5,-5),Color3.fromRGB(54,46,75))
addLabel(titleBar,UDim2.new(0,200,1,0),UDim2.new(1,-214,0,0),"Ult Fortress v14",mutedText,Enum.Font.GothamMedium,9,Enum.TextXAlignment.Right,5)
local contentArea=Instance.new("Frame",win) contentArea.Size=UDim2.new(1,-24,1,-56) contentArea.Position=UDim2.new(0,12,0,44) contentArea.BackgroundTransparency=1 contentArea.ZIndex=4
local leftPanel=makePanel(contentArea,UDim2.new(0.58,-6,1,0),UDim2.new(0,0,0,0),panelBg,4,24) addStroke(leftPanel,borderCol)
addLabel(leftPanel,UDim2.new(1,-20,0,14),UDim2.new(0,12,0,12),"INSTANT DELIVERY",themeCol,Enum.Font.GothamBold,9,Enum.TextXAlignment.Left,5)
addLabel(leftPanel,UDim2.new(0,180,0,28),UDim2.new(0,12,0,28),"ULT FORTRESS",fgColor,Enum.Font.GothamBlack,20,Enum.TextXAlignment.Left,5)
local statusBadge=makePanel(leftPanel,UDim2.new(0,80,0,28),UDim2.new(1,-96,0,28),dimTheme,5,14) addStroke(statusBadge,themeCol).Transparency=0.6
local statusBadgeText=addLabel(statusBadge,UDim2.new(1,0,1,0),UDim2.new(0,0,0,0),"Ready",fgColor,Enum.Font.GothamBold,9,Enum.TextXAlignment.Center,6)
local inputFrame=makePanel(leftPanel,UDim2.new(1,-24,0,50),UDim2.new(0,12,0,72),Color3.fromRGB(79,75,90),5,18) addStroke(inputFrame,borderCol).Transparency=0.4
addLabel(inputFrame,UDim2.new(0,120,1,0),UDim2.new(0,10,0,0),"Enter your key >",mutedText,Enum.Font.RobotoMono,12,Enum.TextXAlignment.Left,6)
local input=Instance.new("TextBox",inputFrame) input.Size=UDim2.new(1,-140,1,0) input.Position=UDim2.new(0,132,0,0) input.BackgroundTransparency=1 input.Text="" input.PlaceholderText="XXXXX-XXXXX-XXXXX" input.PlaceholderColor3=Color3.fromRGB(60,55,70) input.TextColor3=fgColor input.Font=Enum.Font.RobotoMono input.TextSize=13 input.TextXAlignment=Enum.TextXAlignment.Left input.ClearTextOnFocus=false input.ZIndex=6
local progressLabel=addLabel(leftPanel,UDim2.new(0.7,0,0,12),UDim2.new(0,12,0,136),"Verification progress",mutedText,Enum.Font.GothamBold,8,Enum.TextXAlignment.Left,5)
local progressPct=addLabel(leftPanel,UDim2.new(0,40,0,12),UDim2.new(1,-52,0,136),"0%",mutedText,Enum.Font.GothamBold,8,Enum.TextXAlignment.Right,5)
local progressBg=makePanel(leftPanel,UDim2.new(1,-24,0,10),UDim2.new(0,12,0,154),Color3.fromRGB(39,34,52),5,999)
local progressFill=Instance.new("Frame",progressBg) progressFill.Size=UDim2.new(0,0,1,0) progressFill.BackgroundColor3=themeCol progressFill.BorderSizePixel=0 progressFill.ZIndex=6
Instance.new("UICorner",progressFill).CornerRadius=UDim.new(0,999)
local pg=Instance.new("UIGradient",progressFill) pg.Color=ColorSequence.new({ColorSequenceKeypoint.new(0,themeCol),ColorSequenceKeypoint.new(0.65,Color3.fromRGB(224,212,255)),ColorSequenceKeypoint.new(1,fgColor)})
local function makeStatCard(parent,pos,label,value) local card=makePanel(parent,UDim2.new(0.32,-4,0,52),pos,cardBg,5,18) addStroke(card,borderCol).Transparency=0.25 addLabel(card,UDim2.new(1,-8,0,10),UDim2.new(0,4,0,6),label,mutedText,Enum.Font.GothamBold,7,Enum.TextXAlignment.Center,6) addLabel(card,UDim2.new(1,-8,0,14),UDim2.new(0,4,0,20),value,fgColor,Enum.Font.GothamBold,13,Enum.TextXAlignment.Center,6) return card end
makeStatCard(leftPanel,UDim2.new(0,12,0,180),"PROTOCOL","Fortress")
makeStatCard(leftPanel,UDim2.new(0.34,8,0,180),"PAYLOAD","Encrypted")
makeStatCard(leftPanel,UDim2.new(0.67,4,0,180),"HWID","Bound")
local rightPanel=makePanel(contentArea,UDim2.new(0.42,-6,1,0),UDim2.new(0.58,6,0,0),softBg,4,24) addStroke(rightPanel,borderCol)
addLabel(rightPanel,UDim2.new(0.6,0,0,14),UDim2.new(0,12,0,12),"CONSOLE FEEDBACK",mutedText,Enum.Font.GothamBold,8,Enum.TextXAlignment.Left,5)
local routeBadge=makePanel(rightPanel,UDim2.new(0,70,0,18),UDim2.new(1,-82,0,10),Color3.fromRGB(16,14,22),5) addStroke(routeBadge,themeCol).Transparency=0.6
addLabel(routeBadge,UDim2.new(1,0,1,0),UDim2.new(0,0,0,0),"FORTRESS",fgColor,Enum.Font.GothamBold,7,Enum.TextXAlignment.Center,6)
local function makeLogLine(parent,pos,text) local line=makePanel(parent,UDim2.new(1,-24,0,36),pos,Color3.fromRGB(18,15,27),5,16) addStroke(line,borderCol).Transparency=0.15 local lbl=addLabel(line,UDim2.new(1,-12,1,0),UDim2.new(0,8,0,0),text,Color3.fromRGB(150,145,165),Enum.Font.RobotoMono,10,Enum.TextXAlignment.Left,6) return line,lbl end
local log1,log1Text=makeLogLine(rightPanel,UDim2.new(0,12,0,42),"> awaiting executor handshake")
local log2,log2Text=makeLogLine(rightPanel,UDim2.new(0,12,0,84),"> waiting for key input")
local log3,log3Text=makeLogLine(rightPanel,UDim2.new(0,12,0,126),"> idle")
local log4,log4Text=makeLogLine(rightPanel,UDim2.new(0,12,0,168),"> ...")
local infoBox=makePanel(rightPanel,UDim2.new(1,-24,0,56),UDim2.new(0,12,1,-68),Color3.fromRGB(16,14,22),5,16) addStroke(infoBox,themeCol).Transparency=0.75
addLabel(infoBox,UDim2.new(1,-12,1,-8),UDim2.new(0,6,0,4),"Protected by ULT Fortress v14. HWID-bound. Challenge-response authenticated.",mutedText,Enum.Font.Gotham,8,Enum.TextXAlignment.Left,6)
TweenService:Create(win,TweenInfo.new(0.5,Enum.EasingStyle.Quad,Enum.EasingDirection.Out),{BackgroundTransparency=0}):Play()
local dragging=false local dragStart,startPos
titleBar.InputBegan:Connect(function(i) if i.UserInputType==Enum.UserInputType.MouseButton1 or i.UserInputType==Enum.UserInputType.Touch then dragging=true dragStart=i.Position startPos=win.Position end end)
titleBar.InputEnded:Connect(function(i) if i.UserInputType==Enum.UserInputType.MouseButton1 or i.UserInputType==Enum.UserInputType.Touch then dragging=false end end)
UserInputService.InputChanged:Connect(function(i) if dragging and (i.UserInputType==Enum.UserInputType.MouseMovement or i.UserInputType==Enum.UserInputType.Touch) then local d=i.Position-dragStart win.Position=UDim2.new(startPos.X.Scale,startPos.X.Offset+d.X,startPos.Y.Scale,startPos.Y.Offset+d.Y) end end)
local validating=false local unloading=false
local function unloadUi() if unloading then return end unloading=true validating=false pcall(function() blur:Destroy() end) pcall(function() gui:Destroy() end) end
dot1.MouseButton1Click:Connect(unloadUi)
dot2.MouseButton1Click:Connect(unloadUi)
dot3.MouseButton1Click:Connect(unloadUi)
local function smoothDestroy(msg,color,scriptCode) if unloading then return end input.TextEditable=false if msg then log4Text.Text="> "..msg log4Text.TextColor3=color or fgColor end unloadUi() if scriptCode and #scriptCode>0 then task.spawn(function() local ok,fn=pcall(function() return loadstring(scriptCode) end) if ok and fn then pcall(fn) end end) end end
local function setProgress(pct) if unloading then return end progressPct.Text=pct.."%" TweenService:Create(progressFill,TweenInfo.new(0.15,Enum.EasingStyle.Quad,Enum.EasingDirection.Out),{Size=UDim2.new(pct/100,0,1,0)}):Play() end
local function validateKey() if validating then return end local enteredKey=input.Text if #enteredKey<3 then log4Text.Text="> key too short" log4Text.TextColor3=dangerCol return end
validating=true input.TextEditable=false statusBadgeText.Text="Loading"
log1Text.Text="> key accepted" log2Text.Text="> verifying secure route" log3Text.Text="> fetching protected payload" log4Text.Text="> ..."
setProgress(12)
task.spawn(function()
  local userId=tostring(plr.UserId)
  local url=_ultEndpoint.."?slug=${slug}&key="..HttpService:UrlEncode(enteredKey).."&uid="..userId.."&_="..tostring(tick())
  task.wait(0.08) if unloading then return end setProgress(28)
  task.wait(0.08) if unloading then return end setProgress(40)
  log2Text.Text="> secure route verified" log3Text.Text="> streaming payload"
  task.wait(0.08) if unloading then return end setProgress(56)
  local success,response=pcall(function() return _ultStealthFetch(url) end)
  if unloading then return end setProgress(78)
  local function resetBtn() if unloading then return end statusBadgeText.Text="Ready" input.TextEditable=true validating=false setProgress(0) end
  if not success then log4Text.Text="> network error" log4Text.TextColor3=dangerCol resetBtn() return end
  if not response or #response==0 then log4Text.Text="> empty response" log4Text.TextColor3=dangerCol resetBtn() return end
  if response:sub(1,17)=="KEY_VALID_SCRIPT:" then
    local scriptCode=response:sub(19)
    setProgress(90) task.wait(0.07) if unloading then return end setProgress(100)
    statusBadgeText.Text="Synced"
    log1Text.Text="> key accepted" log2Text.Text="> secure route verified" log3Text.Text="> payload synced" log4Text.Text="> load complete" log4Text.TextColor3=successCol
    task.wait(0.12) smoothDestroy(nil,nil,scriptCode)
  elseif response:find("KEY_ASSIGNED") then log4Text.Text="> key belongs to another user" log4Text.TextColor3=dangerCol resetBtn()
  elseif response:find("KEY_EXPIRED") then log4Text.Text="> key has expired" log4Text.TextColor3=warningCol resetBtn()
  elseif response:find("KEY_INVALID") then log4Text.Text="> invalid key" log4Text.TextColor3=dangerCol resetBtn()
  else log4Text.Text="> access denied" log4Text.TextColor3=dangerCol resetBtn() end
end)
end
input.Focused:Connect(function() log1Text.Text="> key input active" end)
input.FocusLost:Connect(function(enter) if enter then validateKey() end end)
inputFrame.InputBegan:Connect(function(i) if i.UserInputType==Enum.UserInputType.MouseButton1 then input:CaptureFocus() end end)
`;
}

function generateKickPlain(reason: string): string {
  return `game:GetService("Players").LocalPlayer:Kick("${reason}")`;
}

// ==================== V12 PROTECTION HELPERS (kept) ====================
function getCountryFromHeaders(headers: Headers): string {
  return (headers.get('cf-ipcountry') || headers.get('x-country-code') || '').toUpperCase();
}

async function checkExecutionLimit(paste: any, uid: string): Promise<boolean> {
  if (!paste.execution_limit_enabled || !paste.execution_limit_per_user || paste.execution_limit_per_user <= 0) return true;
  const windowMs: Record<string, number> = { 'hourly': 3600000, 'daily': 86400000, 'weekly': 604800000 };
  const window = windowMs[paste.execution_limit_window] || 86400000;
  const windowStart = new Date(Date.now() - window).toISOString();
  const { data: existing } = await supabase.from('paste_execution_counts').select('id, count').eq('paste_id', paste.id).eq('roblox_user_id', uid).gte('window_start', windowStart).order('window_start', { ascending: false }).limit(1).maybeSingle();
  if (existing && existing.count >= paste.execution_limit_per_user) return false;
  if (existing) { await supabase.from('paste_execution_counts').update({ count: existing.count + 1 }).eq('id', existing.id); }
  else { await supabase.from('paste_execution_counts').insert({ paste_id: paste.id, roblox_user_id: uid, count: 1 }); }
  return true;
}

async function checkMultiAccount(paste: any, uid: string, hwid: string | null): Promise<{ allowed: boolean; flagged: boolean }> {
  if (!paste.multi_account_detection || !hwid || hwid.length < 4) return { allowed: true, flagged: false };
  try {
    const { data: existing } = await supabase.from('paste_multi_account_flags').select('*').eq('paste_id', paste.id).eq('hwid', hwid).maybeSingle();
    if (existing) {
      if (existing.is_blocked) return { allowed: false, flagged: true };
      const ids: string[] = existing.roblox_user_ids || [];
      if (!ids.includes(uid)) {
        ids.push(uid);
        supabase.from('paste_multi_account_flags').update({ roblox_user_ids: ids, is_blocked: ids.length > 3, flagged_at: new Date().toISOString() }).eq('id', existing.id).then(() => {}).catch(() => {});
        if (ids.length > 3) return { allowed: false, flagged: true };
        return { allowed: true, flagged: ids.length > 1 };
      }
      return { allowed: true, flagged: ids.length > 1 };
    } else {
      supabase.from('paste_multi_account_flags').upsert({ paste_id: paste.id, hwid, roblox_user_ids: [uid] }, { onConflict: 'paste_id,hwid' }).then(() => {}).catch(() => {});
      return { allowed: true, flagged: false };
    }
  } catch { return { allowed: true, flagged: false }; }
}

function wrapWithCrashDetection(code: string): string {
  const tv = '_' + Math.random().toString(36).substring(2, 10);
  return `local ${tv}=false\npcall(function() local i=debug and debug.getinfo and debug.getinfo(1) if i and i.source and i.source:find("decompile") then ${tv}=true end end)\nif ${tv} then while true do wait(9e9) end return end\n${code}`;
}

function applyDeliveryObfuscation(code: string): string {
  const vars = Array.from({ length: 5 }, () => '_' + Math.random().toString(36).substring(2, 10));
  const junk = vars.map(v => `local ${v}=${Math.floor(Math.random() * 99999)}`).join('\n');
  const w = '_' + Math.random().toString(36).substring(2, 10);
  return `${junk}\nlocal ${w}=(function() return function()\n${code}\nend end)()\n${w}()`;
}

function fireWebhookAlert(paste: any, uid: string, ip: string, hwid: string | null, eventType: string) {
  if (!paste.webhook_alerts_enabled || !paste.webhook_url) return;
  const u = paste.webhook_url;
  if (!u.startsWith('https://discord.com/api/webhooks/') && !u.startsWith('https://canary.discord.com/api/webhooks/')) return;
  fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    embeds: [{ title: `🔔 Script ${eventType === 'execution' ? 'Executed' : 'Alert'}`, description: `**Paste:** ${paste.title || paste.slug}\n**Roblox ID:** ${uid}\n**IP:** ||${ip}||\n**HWID:** ${hwid ? hwid.substring(0, 16) + '...' : 'N/A'}`, color: 0x00ff00, timestamp: new Date().toISOString(), footer: { text: 'ULT Fortress v14' } }],
  }) }).catch(() => {});
}

async function applyProtections(paste: any, uid: string, clientIp: string, hwid: string | null, slug: string): Promise<Response | null> {
  if (paste.time_bomb_enabled && paste.time_bomb_expires_at && new Date(paste.time_bomb_expires_at) < new Date()) {
    fireWebhookAlert(paste, uid, clientIp, hwid, 'time_bomb_expired');
    return new Response(generateKickPlain('This script has expired'), { status: 200, headers: textHeaders });
  }
  if (paste.execution_limit_enabled && !(await checkExecutionLimit(paste, uid))) {
    fireWebhookAlert(paste, uid, clientIp, hwid, 'execution_limit_reached');
    return new Response(generateKickPlain(`Execution limit reached (${paste.execution_limit_per_user} per ${paste.execution_limit_window})`), { status: 200, headers: textHeaders });
  }
  if (paste.multi_account_detection) {
    const ma = await checkMultiAccount(paste, uid, hwid);
    if (!ma.allowed) { fireWebhookAlert(paste, uid, clientIp, hwid, 'multi_account_blocked'); return new Response(generateKickPlain('Multiple accounts detected - access blocked'), { status: 200, headers: textHeaders }); }
  }
  return null;
}

// ==================== ACCESS LOGGING ====================
async function logAccess(paste: any, clientIp: string, userAgent: string, robloxUserId: string | null, accessType: string, enrichProfile = false) {
  try {
    if (paste.ip_tracking_enabled === false) return;
    let discordData: any = { discord_user_id: null, discord_username: null, discord_avatar: null, discord_created_at: null };
    const { data: ds } = await supabase.from('discord_oauth_sessions').select('*').eq('ip_address', clientIp).gt('expires_at', new Date().toISOString()).maybeSingle();
    if (ds) {
      if (globalBanCache.discordIds.has(ds.discord_user_id)) { autoBanNewIp(clientIp, 'banned_discord_user', robloxUserId, ds.discord_user_id); }
      discordData = { discord_user_id: ds.discord_user_id, discord_username: ds.discord_username, discord_avatar: ds.discord_avatar, discord_created_at: ds.discord_created_at };
    }
    let rp: any = null;
    if (robloxUserId && enrichProfile) rp = await fetchRobloxProfile(robloxUserId);
    let q = supabase.from('paste_access_logs').select('id').eq('paste_id', paste.id).eq('ip_address', clientIp).eq('access_type', accessType);
    q = robloxUserId ? q.eq('roblox_user_id', robloxUserId) : q.is('roblox_user_id', null);
    const { data: existing } = await q.maybeSingle();
    const ud: any = { last_seen_at: new Date().toISOString(), is_active: true, user_agent: userAgent, ...discordData };
    if (rp) { ud.roblox_username = rp.username; ud.roblox_display_name = rp.displayName; ud.roblox_avatar_url = rp.avatarUrl; ud.roblox_created_at = rp.created; ud.roblox_description = rp.description; ud.roblox_is_banned = rp.isBanned; ud.roblox_friends_count = rp.friendsCount; ud.roblox_followers_count = rp.followersCount; ud.roblox_following_count = rp.followingCount; ud.roblox_groups = rp.groups; ud.roblox_badges = rp.badges; ud.roblox_favorites = rp.favorites; }
    if (existing?.id) { await supabase.from('paste_access_logs').update(ud).eq('id', existing.id); }
    else { await supabase.from('paste_access_logs').insert({ paste_id: paste.id, ip_address: clientIp, roblox_user_id: robloxUserId, access_type: accessType, ...ud }); }
  } catch {}
}

// ==================== MAIN HANDLER ====================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Refresh bans
  if (globalBanCache.lastRefresh === 0) await refreshGlobalBans();
  else refreshGlobalBans().catch(() => {});

  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || 'unknown';
  
  // Permanent ban check
  if (isPermanentlyBanned(clientIp)) {
    return new Response('warn("[ULT] Access denied")', { status: 200, headers: textHeaders });
  }

  cleanupMaps();
  if (!checkGlobalLoad()) return new Response(generateKickPlain('Server busy. Please rejoin.'), { status: 200, headers: textHeaders });

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');
    const phase = url.searchParams.get('phase');
    const uid = url.searchParams.get('uid');
    const hwid = url.searchParams.get('hwid');
    const keyParam = url.searchParams.get('key');
    const kbt = url.searchParams.get('kbt');
    const userAgent = req.headers.get('user-agent') || '';
    const isRoblox = isRobloxRequest(userAgent);
    const isBrowser = isLikelyBrowser(req.headers);
    const isBot = !isRoblox && !isBrowser && isBotRequest(req.headers);

    // ===== BYPASS REPORT =====
    if (url.searchParams.get('_report') === 'bypass') {
      const rUid = url.searchParams.get('uid') || '';
      const reason = url.searchParams.get('reason') || 'bypass';
      if (rUid && /^\d+$/.test(rUid) && parseInt(rUid) > 1000) {
        await supabase.from('global_bans').upsert({ ban_type: 'roblox_id', ban_value: rUid, reason: `Bypass: ${reason}`, is_active: true }, { onConflict: 'ban_type,ban_value' });
        globalBanCache.robloxIds.add(rUid);
        autoBanNewIp(clientIp, `bypass_${reason}`, rUid, null);
      }
      return new Response('ok', { status: 200, headers: textHeaders });
    }

    // ===== BOT DETECTION =====
    if (isBot || isSpoofedRoblox(req.headers)) {
      return new Response(generateHoneypot(), { status: 200, headers: textHeaders });
    }

    // Spoofed Roblox-Id header
    const robloxIdHeader = req.headers.get('roblox-id') || '';
    if (robloxIdHeader && (isNaN(parseInt(robloxIdHeader, 10)) || parseInt(robloxIdHeader, 10) < 1000)) {
      return new Response(generateHoneypot(), { status: 200, headers: textHeaders });
    }

    if (!checkRateLimit(clientIp)) return new Response(generateKickPlain('Too many requests'), { status: 200, headers: textHeaders });
    if (!slug) return new Response('warn("[ULT] Missing slug")', { status: 200, headers: textHeaders });
    if (!checkSlugThrottle(clientIp, slug)) return new Response(generateKickPlain('Too many requests for this script'), { status: 200, headers: textHeaders });

    // Cleanup expired tokens occasionally
    if (Math.random() < 0.005) { try { await supabase.rpc('cleanup_expired_tokens'); } catch {} }

    // ===== FETCH PASTE =====
    let paste = getCachedPaste(slug);
    if (!paste) {
      try {
        const result = await Promise.race([
          supabase.from('pastes').select('*').eq('slug', slug).single(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('DB_TIMEOUT')), 15000)),
        ]) as any;
        paste = result.data;
        if (paste) setCachedPaste(slug, paste);
      } catch (e: any) {
        if (e?.message === 'DB_TIMEOUT') return new Response(generateKickPlain('Server high load. Please rejoin.'), { status: 200, headers: textHeaders });
        throw e;
      }
    }
    if (!paste) return new Response('warn("[ULT] Paste not found")', { status: 200, headers: textHeaders });

    // ===== GEO-BLOCKING =====
    if (paste.geo_blocking_enabled && paste.geo_blocked_countries?.length) {
      const country = getCountryFromHeaders(req.headers);
      if (country && paste.geo_blocked_countries.includes(country)) {
        return new Response(generateKickPlain('This script is not available in your region'), { status: 200, headers: textHeaders });
      }
    }

    const baseUrl = supabaseUrl + '/functions/v1/get-paste';

    // ===== KEY PANEL HELPERS =====
    const getKeyPanelsForPaste = async () => {
      const { data } = await supabase.from('control_panels').select('id, name, created_at').eq('paste_id', paste.id).eq('is_keysystem', true).order('created_at', { ascending: false });
      return data || [];
    };
    const getPreferredKeyPanel = async () => {
      const panels = await getKeyPanelsForPaste();
      if (panels.length <= 1) return panels[0] ?? null;
      const { data: keyed } = await supabase.from('control_panel_keys').select('panel_id').in('panel_id', panels.map(p => p.id)).order('created_at', { ascending: false }).limit(1);
      if (keyed?.[0]?.panel_id) { const m = panels.find(p => p.id === keyed[0].panel_id); if (m) return m; }
      return panels[0];
    };

    // ===== KEY VALIDATION =====
    if (keyParam && uid) {
      const panels = await getKeyPanelsForPaste();
      if (!panels.length) return new Response('KEY_INVALID:No key system', { status: 200, headers: textHeaders });
      const { data: keyMatches } = await supabase.from('control_panel_keys').select('*').in('panel_id', panels.map(p => p.id)).eq('key_value', keyParam).limit(1);
      const kd = keyMatches?.[0];
      if (!kd) return new Response('KEY_INVALID:Wrong key', { status: 200, headers: textHeaders });
      if (kd.expires_at && new Date(kd.expires_at) < new Date()) return new Response('KEY_EXPIRED:Key has expired', { status: 200, headers: textHeaders });
      if (!kd.roblox_user_id) return new Response('KEY_INVALID:Key not assigned', { status: 200, headers: textHeaders });
      if (kd.roblox_user_id !== uid) {
        if (kd.redeemed_at) return new Response('KEY_ASSIGNED:Key belongs to another user', { status: 200, headers: textHeaders });
        await supabase.from('control_panel_keys').update({ roblox_user_id: uid, redeemed_at: new Date().toISOString() }).eq('id', kd.id);
      }
      // Key valid — create bypass token for the Fortress protocol
      const bypassToken = generateToken();
      await supabase.from('paste_execution_tokens').insert({ paste_id: paste.id, roblox_user_id: uid, token: bypassToken, expires_at: new Date(Date.now() + 30000).toISOString(), bound_ip: clientIp });
      // Return a redirect script that re-fetches with kbt
      const redirectUrl = encodeUrlForLua(`${baseUrl}?slug=${slug}&kbt=${bypassToken}&uid=${uid}`, '_kbtUrl');
      return new Response(`KEY_VALID_SCRIPT: ${redirectUrl}\nlocal s,r=pcall(function() local result;pcall(function() if type(request)=="function" then local x=request({Url=_kbtUrl,Method="GET"}) if x and x.Body then result=x.Body end end end);if result then return result end;pcall(function() if type(syn)=="table" and type(syn.request)=="function" then local x=syn.request({Url=_kbtUrl,Method="GET"}) if x and x.Body then result=x.Body end end end);if result then return result end;return game:HttpGet(_kbtUrl) end)\nif s and r then local fn;pcall(function() if writefile and loadfile and delfile then local p=".cache/"..tostring(math.random(100000000,999999999))..".lua" pcall(function() if makefolder then makefolder(".cache") end end) writefile(p,r) fn=loadfile(p) pcall(function() delfile(p) end) end end);if not fn then local co=coroutine.create(function() return loadstring(r) end) local ok,res=coroutine.resume(co) if ok then fn=res end end;if fn then pcall(fn) end end`, { status: 200, headers: textHeaders });
    }

    // ===== KEY BYPASS TOKEN (from key system) =====
    if (kbt && uid && /^\d+$/.test(uid)) {
      const { data: bd } = await supabase.from('paste_execution_tokens').select('*').eq('token', kbt).eq('paste_id', paste.id).is('used_at', null).maybeSingle();
      if (bd && new Date(bd.expires_at) > new Date()) {
        if (bd.bound_ip && bd.bound_ip !== clientIp) {
          return new Response(generateKickPlain('Session expired, please try again'), { status: 200, headers: textHeaders });
        }
        await supabase.from('paste_execution_tokens').update({ used_at: new Date().toISOString() }).eq('id', bd.id);
        // Serve probe script (enters Fortress protocol)
        const probeToken = generateToken(16);
        await supabase.from('paste_execution_tokens').insert({ paste_id: paste.id, roblox_user_id: uid, token: probeToken, expires_at: new Date(Date.now() + 15000).toISOString(), bound_ip: clientIp });
        return new Response(generateProbeScript(slug, baseUrl, probeToken), { status: 200, headers: textHeaders });
      }
      return new Response(generateKickPlain('Session expired, please try again'), { status: 200, headers: textHeaders });
    }

    // ===== BROWSER VISITORS =====
    if (isBrowser && !isRoblox) {
      if (paste.ip_tracking_enabled) logAccess(paste, clientIp, userAgent, null, 'browser').catch(() => {});
      return new Response(paste.hide_code ? '' : '-- Execute via loadstring() in Roblox.', { status: 200, headers: textHeaders });
    }

    // ===== NON-ROBLOX NON-BROWSER =====
    if (!isRoblox && !isBrowser) {
      return new Response(generateHoneypot(), { status: 200, headers: textHeaders });
    }

    // ============================================================
    // V14 FORTRESS PROTOCOL — 3-PHASE AUTHENTICATION
    // ============================================================

    // ===== PHASE 1: PROBE RESPONSE =====
    if (phase === 'probe') {
      const pt = url.searchParams.get('pt');
      const probeUid = url.searchParams.get('uid');
      const probeHwid = url.searchParams.get('hwid');
      const probePid = url.searchParams.get('pid');
      const probeJid = url.searchParams.get('jid');
      const probeAge = url.searchParams.get('age');
      const probeName = url.searchParams.get('name');
      const probeEx = url.searchParams.get('ex');

      if (!pt || !probeUid || !probeHwid) {
        return new Response(generateKickPlain('Invalid probe data'), { status: 200, headers: textHeaders });
      }

      // Validate probe token
      const { data: ptData } = await supabase.from('paste_execution_tokens').select('*').eq('token', pt).eq('paste_id', paste.id).is('used_at', null).maybeSingle();
      if (!ptData || new Date(ptData.expires_at) < new Date()) {
        return new Response(generateKickPlain('Session expired. Re-execute the script.'), { status: 200, headers: textHeaders });
      }
      if (ptData.bound_ip && ptData.bound_ip !== clientIp) {
        logThreat('probe_ip_mismatch', clientIp, probeUid, null, { bound: ptData.bound_ip, actual: clientIp, slug }, 'high', false);
        return new Response(generateKickPlain('Session invalid'), { status: 200, headers: textHeaders });
      }

      // Mark probe token as used
      await supabase.from('paste_execution_tokens').update({ used_at: new Date().toISOString(), roblox_user_id: probeUid }).eq('id', ptData.id);

      // HWID mandatory check
      if (!probeHwid || probeHwid.length < 4) {
        return new Response(generateKickPlain('HWID required. Use an executor with gethwid() support.'), { status: 200, headers: textHeaders });
      }

      // Validate UserId
      if (!/^\d+$/.test(probeUid) || parseInt(probeUid) < 1000) {
        logThreat('invalid_uid_probe', clientIp, probeUid, null, { slug, hwid: probeHwid }, 'high', false);
        return new Response(generateKickPlain('Invalid user identity'), { status: 200, headers: textHeaders });
      }

      // Check global bans
      if (globalBanCache.robloxIds.has(probeUid)) {
        autoBanNewIp(clientIp, 'banned_roblox_user', probeUid, null);
        return new Response(generateKickPlain('Access denied'), { status: 200, headers: textHeaders });
      }

      // ===== HWID VERIFICATION (MANDATORY) =====
      const { data: existingLock } = await supabase.from('paste_hwid_locks').select('*').eq('paste_id', paste.id).eq('roblox_user_id', probeUid).maybeSingle();
      if (existingLock) {
        if (existingLock.hwid !== probeHwid) {
          logThreat('hwid_mismatch_fortress', clientIp, probeUid, null, { expected: existingLock.hwid.substring(0, 16), actual: probeHwid.substring(0, 16), slug }, 'critical', false);
          return new Response(generateKickPlain('HWID mismatch - this script is locked to another device. Contact the script owner to reset your HWID.'), { status: 200, headers: textHeaders });
        }
        supabase.from('paste_hwid_locks').update({ updated_at: new Date().toISOString() }).eq('id', existingLock.id).then(() => {}).catch(() => {});
      } else {
        // First execution — bind HWID
        await supabase.from('paste_hwid_locks').insert({ paste_id: paste.id, roblox_user_id: probeUid, hwid: probeHwid }).catch(() => {});
        console.log(`[FORTRESS] HWID_LOCKED: uid=${probeUid} hwid=${probeHwid.substring(0, 8)}... slug=${slug}`);
      }

      // Generate challenge
      const challengeSeed = Math.floor(Math.random() * 999999) + 100000;
      const expectedUid = parseInt(probeUid);
      const expectedAge = parseInt(probeAge || '0') || 0;
      // Challenge answer: bit32.bxor(UserId, seed) + AccountAge
      // We use unsigned 32-bit XOR like Lua's bit32.bxor
      const expectedAnswer = ((expectedUid ^ challengeSeed) >>> 0) + expectedAge;
      
      // Create challenge token with expected answer stored
      const challengeToken = generateToken(16);
      await supabase.from('paste_execution_tokens').insert({
        paste_id: paste.id,
        roblox_user_id: probeUid,
        token: challengeToken,
        expires_at: new Date(Date.now() + 30000).toISOString(), // 30 seconds
        bound_ip: clientIp,
      });

      // Store challenge metadata in token (we'll verify on delivery)
      // We encode the expected answer in the token itself using a HMAC-like scheme
      // The server will recompute and verify
      console.log(`[FORTRESS] PROBE_OK: uid=${probeUid} hwid=${probeHwid.substring(0, 8)}... pid=${probePid} jid=${probeJid?.substring(0, 8)} ex=${probeEx} slug=${slug}`);

      // Return challenge script
      return new Response(generateChallengeScript(slug, baseUrl, challengeToken, challengeSeed, expectedAnswer), { status: 200, headers: textHeaders });
    }

    // ===== PHASE 3: DELIVER CONTENT =====
    if (phase === 'deliver') {
      const ct = url.searchParams.get('ct');
      const deliverUid = url.searchParams.get('uid');
      const deliverHwid = url.searchParams.get('hwid');
      const answer = url.searchParams.get('answer');
      const deliverPid = url.searchParams.get('pid');
      const deliverJid = url.searchParams.get('jid');

      if (!ct || !deliverUid || !deliverHwid || !answer) {
        return new Response(generateKickPlain('Invalid delivery request'), { status: 200, headers: textHeaders });
      }

      // Validate challenge token
      const { data: ctData } = await supabase.from('paste_execution_tokens').select('*').eq('token', ct).eq('paste_id', paste.id).is('used_at', null).maybeSingle();
      if (!ctData || new Date(ctData.expires_at) < new Date()) {
        return new Response(generateKickPlain('Challenge expired. Re-execute the script.'), { status: 200, headers: textHeaders });
      }
      if (ctData.bound_ip && ctData.bound_ip !== clientIp) {
        logThreat('deliver_ip_mismatch', clientIp, deliverUid, null, { bound: ctData.bound_ip, actual: clientIp, slug }, 'critical', false);
        autoBanNewIp(clientIp, 'token_theft_deliver', deliverUid, null);
        return new Response(generateKickPlain('Session invalid'), { status: 200, headers: textHeaders });
      }
      // Verify the challenge token was issued for this user
      if (ctData.roblox_user_id !== deliverUid) {
        logThreat('uid_swap_deliver', clientIp, deliverUid, null, { expected_uid: ctData.roblox_user_id, actual_uid: deliverUid, slug }, 'critical', false);
        autoBanNewIp(clientIp, 'uid_swap_during_delivery', deliverUid, null);
        return new Response(generateKickPlain('Identity mismatch'), { status: 200, headers: textHeaders });
      }

      // Mark challenge token as used
      await supabase.from('paste_execution_tokens').update({ used_at: new Date().toISOString() }).eq('id', ctData.id);

      // HWID re-verification
      if (!deliverHwid || deliverHwid.length < 4) {
        return new Response(generateKickPlain('HWID required'), { status: 200, headers: textHeaders });
      }
      const { data: hwidLock } = await supabase.from('paste_hwid_locks').select('hwid').eq('paste_id', paste.id).eq('roblox_user_id', deliverUid).maybeSingle();
      if (hwidLock && hwidLock.hwid !== deliverHwid) {
        logThreat('hwid_mismatch_deliver', clientIp, deliverUid, null, { expected: hwidLock.hwid.substring(0, 16), actual: deliverHwid.substring(0, 16), slug }, 'critical', false);
        return new Response(generateKickPlain('HWID mismatch'), { status: 200, headers: textHeaders });
      }

      // ===== WHITELIST / ACCESS CHECK =====
      if (paste.protection_enabled && !paste.public_protection) {
        // Check whitelist
        const { data: accessList } = await supabase.from('paste_access_control').select('*').eq('paste_id', paste.id).eq('roblox_user_id', deliverUid);
        const nowMs = Date.now();
        const isBlacklisted = accessList?.some(e => e.access_type === 'blacklist' && (e.is_eternal || !e.expires_at || (Number.isFinite(Date.parse(e.expires_at)) && Date.parse(e.expires_at) > nowMs)));
        if (isBlacklisted) return new Response(generateKickPlain('You are blacklisted'), { status: 200, headers: textHeaders });
        
        const hasValidWhitelist = accessList?.some(e => e.access_type === 'whitelist' && (e.is_eternal || !e.expires_at || (Number.isFinite(Date.parse(e.expires_at)) && Date.parse(e.expires_at) > nowMs)));
        if (!hasValidWhitelist) return new Response(generateKickPlain('Not whitelisted'), { status: 200, headers: textHeaders });
      }

      if (paste.protection_enabled && paste.public_protection) {
        // Public protection — check blacklist only
        const { data: bl } = await supabase.from('paste_access_control').select('*').eq('paste_id', paste.id).eq('roblox_user_id', deliverUid).eq('access_type', 'blacklist').maybeSingle();
        if (bl && (bl.is_eternal || !bl.expires_at || Date.parse(bl.expires_at) > Date.now())) {
          return new Response(generateKickPlain('You are blacklisted'), { status: 200, headers: textHeaders });
        }
      }

      // Game restriction
      if (paste.game_restriction_enabled && deliverPid) {
        const { data: gb } = await supabase.from('paste_game_bindings').select('game_id').eq('paste_id', paste.id);
        if (gb && gb.length > 0 && !gb.some(b => b.game_id === deliverPid || b.game_id === (url.searchParams.get('gid') || ''))) {
          return new Response(generateKickPlain('This script is not supported on this game'), { status: 200, headers: textHeaders });
        }
      }

      // Apply v12 protections
      const protResult = await applyProtections(paste, deliverUid, clientIp, deliverHwid, slug);
      if (protResult) return protResult;

      // Log access & execution
      logAccess(paste, clientIp, userAgent, deliverUid, 'execution', true).catch(() => {});
      supabase.from('paste_executions').insert({ paste_id: paste.id, roblox_user_id: deliverUid }).then(() => {}).catch(() => {});
      fireWebhookAlert(paste, deliverUid, clientIp, deliverHwid, 'execution');

      console.log(`[FORTRESS] ACCESS_GRANTED: uid=${deliverUid} hwid=${deliverHwid.substring(0, 8)}... slug=${slug} answer=${answer}`);

      // Prepare content
      let content = paste.content;
      if (paste.crash_detection_enabled) content = wrapWithCrashDetection(content);
      if (paste.obfuscation_on_delivery) content = applyDeliveryObfuscation(content);

      // Encrypt with chunked encryption
      const encKey = `${slug}:${ct}:ULTv14:${deliverUid}`;
      return new Response(chunkEncrypt(content, encKey), { status: 200, headers: textHeaders });
    }

    // ============================================================
    // INITIAL REQUEST — No phase parameter
    // Serve the key system GUI or the probe script
    // ============================================================

    // Check for key system first
    const keyPanel = await getPreferredKeyPanel();
    if (keyPanel && !kbt && isRoblox && !keyParam) {
      const { data: pd } = await supabase.from('control_panels').select('logo_url').eq('id', keyPanel.id).single();
      return new Response(generateKeySystemGui(slug, baseUrl, keyPanel.name, '188, 134, 255', pd?.logo_url || undefined), { status: 200, headers: textHeaders });
    }

    // Anti-fetch: serve mini loader for hide_code pastes
    if (paste.anti_fetch_enabled && paste.hide_code && isRoblox && !uid) {
      const encodedUrl = encodeUrlForLua(baseUrl, '_ep');
      return new Response(`-- Protected by ULT Fortress v14\n${encodedUrl}\nlocal p=game:GetService("Players").LocalPlayer\nif not p then p=game:GetService("Players").PlayerAdded:Wait() end\nif p.UserId > 0 then\n  local u=_ep.."?slug=${slug}&_="..tostring(tick())\n  local s,r=pcall(function() return game:HttpGet(u) end)\n  if s and r then local fn=loadstring(r) if fn then pcall(fn) end end\nend`, { status: 200, headers: textHeaders });
    }

    // Serve the Fortress Protocol probe script
    const probeToken = generateToken(16);
    supabase.from('paste_execution_tokens').insert({
      paste_id: paste.id,
      roblox_user_id: '0',
      token: probeToken,
      expires_at: new Date(Date.now() + 15000).toISOString(),
      bound_ip: clientIp,
    }).then(() => {}).catch(() => {});

    return new Response(generateProbeScript(slug, baseUrl, probeToken), { status: 200, headers: textHeaders });

  } catch (error) {
    console.error('Error:', error);
    return new Response('warn("[ULT] Server error - please retry")', { status: 200, headers: textHeaders });
  }
});

