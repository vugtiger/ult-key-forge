// ===========================================================================================
// ULT CITADEL v15.0 — Complete rebuild. 2-phase signed delivery. Zero race conditions.
// Phase 1: Signed loader (no DB writes). Phase 2: Identity validation + encrypted delivery.
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

// ==================== CRYPTO ====================
const SIGNING_SECRET = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!.substring(0, 32);

async function hmacSign(data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(SIGNING_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacVerify(data: string, signature: string): Promise<boolean> {
  const expected = await hmacSign(data);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

function generateToken(len = 32): string {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
}

function xorEncrypt(plain: string, key: string): string {
  const enc = new TextEncoder();
  const data = enc.encode(plain);
  const k = enc.encode(key);
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i] ^ k[i % k.length];
  return Array.from(out, b => b.toString(16).padStart(2, '0')).join('');
}

// ==================== BAN SYSTEM ====================
const HARDCODED_BANNED_IPS = new Set(['79.177.154.169', '79.181.155.63', '89.234.244.240']);
const BANNED_SUBNETS = ['79.177.154.', '79.181.155.'];

let banCache = { ips: new Set<string>(), subnets: [] as string[], robloxIds: new Set<string>(), discordIds: new Set<string>(), adminIps: new Set<string>(), ts: 0 };
const sessionBans = new Set<string>();

async function refreshBans() {
  if (Date.now() - banCache.ts < 60_000) return;
  try {
    const { data } = await supabase.from('global_bans').select('ban_type, ban_value').eq('is_active', true);
    const ips = new Set<string>(), subnets: string[] = [], robloxIds = new Set<string>(), discordIds = new Set<string>();
    for (const b of data || []) {
      if (b.ban_type === 'ip') ips.add(b.ban_value);
      else if (b.ban_type === 'subnet') subnets.push(b.ban_value);
      else if (b.ban_type === 'roblox_id') robloxIds.add(b.ban_value);
      else if (b.ban_type === 'discord_id') discordIds.add(b.ban_value);
    }
    // Admin IPs
    const adminIps = new Set<string>();
    try {
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
      if (roles?.length) {
        const { data: ipd } = await supabase.from('user_ips').select('ip_address').in('user_id', roles.map(r => r.user_id));
        for (const i of ipd || []) adminIps.add(i.ip_address);
      }
    } catch {}
    banCache = { ips, subnets, robloxIds, discordIds, adminIps, ts: Date.now() };
  } catch (e) { console.error('Ban refresh failed:', e); }
}

function isAdmin(ip: string): boolean { return banCache.adminIps.has(ip); }

function isBanned(ip: string): boolean {
  if (isAdmin(ip)) return false;
  if (HARDCODED_BANNED_IPS.has(ip)) return true;
  for (const s of BANNED_SUBNETS) if (ip.startsWith(s)) return true;
  if (banCache.ips.has(ip)) return true;
  for (const s of banCache.subnets) if (ip.startsWith(s)) return true;
  return false;
}

function autoBan(ip: string, reason: string, uid: string | null) {
  if (!ip || ip === 'unknown' || isAdmin(ip) || banCache.ips.has(ip) || sessionBans.has(ip)) return;
  sessionBans.add(ip);
  banCache.ips.add(ip);
  const r = `Auto: ${reason}${uid ? ` (roblox:${uid})` : ''}`;
  supabase.from('global_bans').upsert({ ban_type: 'ip', ban_value: ip, reason: r, is_active: true }, { onConflict: 'ban_type,ban_value' }).then(() => {}).catch(() => {});
  logThreat('auto_ban', ip, uid, null, { reason: r }, 'high');
}

function logThreat(type: string, ip: string | null, uid: string | null, did: string | null, details: any, severity: string) {
  supabase.from('threat_log').insert({ threat_type: type, source_ip: ip, roblox_user_id: uid, discord_user_id: did, details, severity, resolved: false, auto_banned: type === 'auto_ban' }).then(() => {}).catch(() => {});
}

// ==================== RATE LIMITING ====================
const ipRates = new Map<string, { c: number; r: number }>();
const slugRates = new Map<string, { c: number; r: number }>();
let globalReqs = 0, globalReset = Date.now() + 10000;

function rateOk(ip: string): boolean {
  const n = Date.now();
  const e = ipRates.get(ip);
  if (!e || n > e.r) { ipRates.set(ip, { c: 1, r: n + 60000 }); return true; }
  return ++e.c <= 60;
}

function slugOk(ip: string, slug: string): boolean {
  const k = `${ip}:${slug}`, n = Date.now();
  const e = slugRates.get(k);
  if (!e || n > e.r) { slugRates.set(k, { c: 1, r: n + 30000 }); return true; }
  return ++e.c <= 30;
}

function globalOk(): boolean {
  const n = Date.now();
  if (n > globalReset) { globalReqs = 0; globalReset = n + 10000; }
  return ++globalReqs <= 500;
}

// Periodic cleanup
let lastClean = Date.now();
function cleanup() {
  const n = Date.now();
  if (n - lastClean < 120_000) return;
  lastClean = n;
  for (const [k, v] of ipRates) if (n > v.r) ipRates.delete(k);
  for (const [k, v] of slugRates) if (n > v.r) slugRates.delete(k);
  for (const [k, v] of pasteCache) if (n - v.ts > 30000) pasteCache.delete(k);
}

// ==================== PASTE CACHE ====================
const pasteCache = new Map<string, { d: any; ts: number }>();
function getPaste(slug: string) { const c = pasteCache.get(slug); if (!c || Date.now() - c.ts > 30000) { pasteCache.delete(slug); return null; } return c.d; }
function setPaste(slug: string, d: any) { if (pasteCache.size > 100) { const k = pasteCache.keys().next().value; if (k) pasteCache.delete(k); } pasteCache.set(slug, { d, ts: Date.now() }); }

// ==================== REQUEST CLASSIFICATION ====================
function isRoblox(ua: string): boolean {
  const l = ua.toLowerCase();
  return l.includes('roblox') || ua.includes('HttpService') || ua.includes('WinInet') || ua.includes('RobloxApp') || /^Mozilla\/5\.0 \(\d+MB;/.test(ua);
}

function isBrowser(h: Headers): boolean {
  const ua = h.get('user-agent') || '';
  if (isRoblox(ua)) return false;
  return Boolean(h.get('sec-fetch-mode') || h.get('sec-fetch-dest') || (h.get('accept') || '').includes('text/html') || h.get('origin') || h.get('referer') || (/Mozilla\/\d/.test(ua) && /AppleWebKit|Gecko|Chrome|Safari|Firefox|Edge/.test(ua)));
}

function isBot(h: Headers): boolean {
  const ua = (h.get('user-agent') || '').toLowerCase();
  const pats = ['discordbot','discord.js','axios','node-fetch','got','undici','curl','wget','python','aiohttp','httpx','postman','insomnia','puppeteer','playwright','selenium','crawler','spider','scraper','php','perl','ruby','java/','deno/','bun/','node/'];
  for (const p of pats) if (ua.includes(p)) return true;
  if (!ua || ua.length < 5) return true;
  if (/^[a-z]+\/\d+\.\d+$/i.test(ua)) return true;
  for (const h2 of ['cf-worker','x-discord','x-bot']) if (h.get(h2)) return true;
  return false;
}

function isSpoofed(h: Headers): boolean {
  const ua = h.get('user-agent') || '';
  if (!isRoblox(ua)) return false;
  if (ua.trim().toLowerCase() === 'roblox' || ua.length < 8) return true;
  const l = ua.toLowerCase();
  if (l.includes('curl') || l.includes('wget') || l.includes('python') || l.includes('node') || l.includes('deno')) return true;
  if (h.get('content-type')?.includes('application/json')) return true;
  return false;
}

// ==================== HONEYPOT ====================
function honeypot(): string {
  const lines = [`-- ULT Citadel v15\nlocal _=function()while true do warn("[ULT] BYPASS DETECTED") task.wait(0.01) end end\nspawn(_)`, '--[==['];
  for (let i = 0; i < 100; i++) lines.push(`⚠️ SECURITY: Attempt #${i} | IP BANNED | HWID BANNED | Ref: ULT-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
  lines.push(']==]');
  return lines.join('\n');
}

function kick(msg: string): string {
  return `game:GetService("Players").LocalPlayer:Kick("${msg.replace(/"/g, '\\"')}")`;
}

// ==================== URL ENCODING ====================
function encodeUrl(url: string, varName: string): string {
  const xk = Math.floor(Math.random() * 200) + 50;
  const enc = Array.from(url).map(c => c.charCodeAt(0) ^ xk);
  return `local ${varName};do local _k=${xk} local _t={${enc.join(',')}} local _r={} for i=1,#_t do _r[i]=string.char(bit32.bxor(_t[i],_k)) end ${varName}=table.concat(_r) end`;
}

// ==================== CHUNK ENCRYPTION ====================
function chunkEncrypt(code: string, key: string): string {
  const n = Math.max(8, Math.min(40, Math.ceil(code.length / 200)));
  const cs = Math.ceil(code.length / n);
  const chunks: string[] = [];
  for (let i = 0; i * cs < code.length; i++) chunks.push(code.slice(i * cs, (i + 1) * cs));
  const ac = chunks.length;
  const encrypted = chunks.map((c, i) => xorEncrypt(c, `${key}:C${i}:${ac}`));
  const seed = Math.floor(Math.random() * 2147483646) + 1;
  const idx = Array.from({ length: ac }, (_, i) => i);
  let s = seed;
  for (let i = idx.length - 1; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return `ULT_C:${ac}:${seed}|${idx.map(i => encrypted[i]).join('|')}`;
}

// ==================== ROBLOX PROFILE ====================
async function fetchProfile(userId: string) {
  const r: any = { username: null, displayName: null, description: null, created: null, isBanned: null, avatarUrl: null, friendsCount: null, followersCount: null, followingCount: null, groups: null, badges: null, favorites: null };
  try {
    const [u, a, f, fl, fo, g] = await Promise.allSettled([
      fetch(`https://users.roblox.com/v1/users/${userId}`),
      fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png`),
      fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
      fetch(`https://friends.roblox.com/v1/users/${userId}/followers/count`),
      fetch(`https://friends.roblox.com/v1/users/${userId}/followings/count`),
      fetch(`https://groups.roblox.com/v1/users/${userId}/groups/roles`),
    ]);
    const j = async (x: any) => x.status === 'fulfilled' && x.value.ok ? await x.value.json().catch(() => null) : null;
    const [ud, ad, fd, fld, fod, gd] = await Promise.all([j(u), j(a), j(f), j(fl), j(fo), j(g)]);
    if (ud) { r.username = ud.name; r.displayName = ud.displayName; r.description = ud.description; r.created = ud.created; r.isBanned = ud.isBanned; }
    if (ad?.data?.[0]?.imageUrl) r.avatarUrl = ad.data[0].imageUrl;
    if (fd) r.friendsCount = fd.count;
    if (fld) r.followersCount = fld.count;
    if (fod) r.followingCount = fod.count;
    if (gd?.data) r.groups = gd.data.slice(0, 20).map((x: any) => ({ id: x.group.id, name: x.group.name, role: x.role.name }));
  } catch {}
  return r;
}

// ==================== ACCESS LOGGING ====================
async function logAccess(paste: any, ip: string, ua: string, uid: string | null, type: string, enrich = false) {
  try {
    if (paste.ip_tracking_enabled === false) return;
    let dd: any = { discord_user_id: null, discord_username: null, discord_avatar: null, discord_created_at: null };
    const { data: ds } = await supabase.from('discord_oauth_sessions').select('*').eq('ip_address', ip).gt('expires_at', new Date().toISOString()).maybeSingle();
    if (ds) {
      if (banCache.discordIds.has(ds.discord_user_id)) autoBan(ip, 'banned_discord', uid, );
      dd = { discord_user_id: ds.discord_user_id, discord_username: ds.discord_username, discord_avatar: ds.discord_avatar, discord_created_at: ds.discord_created_at };
    }
    let rp: any = null;
    if (uid && enrich) rp = await fetchProfile(uid);
    let q = supabase.from('paste_access_logs').select('id').eq('paste_id', paste.id).eq('ip_address', ip).eq('access_type', type);
    q = uid ? q.eq('roblox_user_id', uid) : q.is('roblox_user_id', null);
    const { data: ex } = await q.maybeSingle();
    const ud: any = { last_seen_at: new Date().toISOString(), is_active: true, user_agent: ua, ...dd };
    if (rp) { ud.roblox_username = rp.username; ud.roblox_display_name = rp.displayName; ud.roblox_avatar_url = rp.avatarUrl; ud.roblox_created_at = rp.created; ud.roblox_description = rp.description; ud.roblox_is_banned = rp.isBanned; ud.roblox_friends_count = rp.friendsCount; ud.roblox_followers_count = rp.followersCount; ud.roblox_following_count = rp.followingCount; ud.roblox_groups = rp.groups; ud.roblox_badges = rp.badges; ud.roblox_favorites = rp.favorites; }
    if (ex?.id) await supabase.from('paste_access_logs').update(ud).eq('id', ex.id);
    else await supabase.from('paste_access_logs').insert({ paste_id: paste.id, ip_address: ip, roblox_user_id: uid, access_type: type, ...ud });
  } catch {}
}

// ==================== PROTECTION CHECKS ====================
function getCountry(h: Headers): string | null {
  return h.get('cf-ipcountry') || h.get('x-country-code') || null;
}

async function checkExecLimit(paste: any, uid: string): Promise<boolean> {
  if (!paste.execution_limit_enabled || !paste.execution_limit_per_user) return true;
  const win = paste.execution_limit_window || 'daily';
  let since = new Date();
  if (win === 'hourly') since.setHours(since.getHours() - 1);
  else if (win === 'daily') since.setDate(since.getDate() - 1);
  else if (win === 'weekly') since.setDate(since.getDate() - 7);
  else if (win === 'monthly') since.setMonth(since.getMonth() - 1);
  const { data: ec } = await supabase.from('paste_execution_counts').select('count').eq('paste_id', paste.id).eq('roblox_user_id', uid).gte('window_start', since.toISOString()).maybeSingle();
  if (ec && ec.count >= paste.execution_limit_per_user) return false;
  // Upsert count
  if (ec) { await supabase.from('paste_execution_counts').update({ count: ec.count + 1 }).eq('paste_id', paste.id).eq('roblox_user_id', uid).gte('window_start', since.toISOString()); }
  else { await supabase.from('paste_execution_counts').insert({ paste_id: paste.id, roblox_user_id: uid, count: 1 }); }
  return true;
}

async function checkMultiAccount(paste: any, uid: string, hwid: string | null) {
  if (!hwid) return { allowed: true, flagged: false };
  try {
    const { data: ex } = await supabase.from('paste_multi_account_flags').select('id, roblox_user_ids').eq('paste_id', paste.id).eq('hwid', hwid).maybeSingle();
    if (ex) {
      const ids: string[] = ex.roblox_user_ids || [];
      if (!ids.includes(uid)) {
        ids.push(uid);
        supabase.from('paste_multi_account_flags').update({ roblox_user_ids: ids, is_blocked: ids.length > 3, flagged_at: new Date().toISOString() }).eq('id', ex.id).then(() => {}).catch(() => {});
        if (ids.length > 3) return { allowed: false, flagged: true };
      }
      return { allowed: true, flagged: ids.length > 1 };
    }
    supabase.from('paste_multi_account_flags').upsert({ paste_id: paste.id, hwid, roblox_user_ids: [uid] }, { onConflict: 'paste_id,hwid' }).then(() => {}).catch(() => {});
    return { allowed: true, flagged: false };
  } catch { return { allowed: true, flagged: false }; }
}

function wrapCrashDetect(code: string): string {
  const v = '_' + Math.random().toString(36).substring(2, 10);
  return `local ${v}=false\npcall(function() local i=debug and debug.getinfo and debug.getinfo(1) if i and i.source and i.source:find("decompile") then ${v}=true end end)\nif ${v} then while true do wait(9e9) end return end\n${code}`;
}

function obfuscateWrap(code: string): string {
  const vs = Array.from({ length: 5 }, () => '_' + Math.random().toString(36).substring(2, 10));
  const junk = vs.map(v => `local ${v}=${Math.floor(Math.random() * 99999)}`).join('\n');
  const w = '_' + Math.random().toString(36).substring(2, 10);
  return `${junk}\nlocal ${w}=(function() return function()\n${code}\nend end)()\n${w}()`;
}

function fireWebhook(paste: any, uid: string, ip: string, hwid: string | null, event: string) {
  if (!paste.webhook_alerts_enabled || !paste.webhook_url) return;
  const u = paste.webhook_url;
  if (!u.startsWith('https://discord.com/api/webhooks/') && !u.startsWith('https://canary.discord.com/api/webhooks/')) return;
  fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    embeds: [{ title: `🔔 Script ${event}`, description: `**Paste:** ${paste.title || paste.slug}\n**Roblox ID:** ${uid}\n**IP:** ||${ip}||\n**HWID:** ${hwid ? hwid.substring(0, 16) + '...' : 'N/A'}`, color: 0x00ff00, timestamp: new Date().toISOString(), footer: { text: 'ULT Citadel v15' } }],
  }) }).catch(() => {});
}

// ==================== CITADEL LOADER GENERATOR ====================
// Phase 1: Returns a signed loader. NO database writes. Server signs a nonce
// that the client must return with identity data. Can't be forged without the secret.
function generateLoader(slug: string, baseUrl: string, nonce: string, sig: string): string {
  const eu = encodeUrl(baseUrl, '_ep');
  const v: Record<string, string> = {};
  for (const k of ['sf','p','uid','hwid','pid','jid','age','name','ex','ts','url','resp','fn']) {
    v[k] = '_' + Math.random().toString(36).substring(2, 8);
  }

  return `-- ULT Citadel v15
${eu}
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
if #${v.hwid}<4 then
  pcall(function()
    if type(getgenv)=="function" then
      local g=getgenv()
      if g and type(g.gethwid)=="function" then ${v.hwid}=tostring(g.gethwid()) end
    end
  end)
end
if #${v.hwid}<4 then
  pcall(function()
    if type(identifyexecutor)=="function" then
      local en=identifyexecutor()
      local oi=""
      pcall(function()
        local si=game:GetService("UserInputService")
        oi=tostring(si.KeyboardEnabled)..tostring(si.TouchEnabled)..tostring(si.GamepadEnabled)
      end)
      if #oi>0 then
        local fp=tostring(en or "")..oi..tostring(game:GetService("Stats"):GetTotalMemoryUsageMb())
        local h=0
        for i=1,#fp do h=bit32.bxor(h*31+string.byte(fp,i),h) end
        ${v.hwid}="PFP_"..tostring(math.abs(h))
      end
    end
  end)
end
if #${v.hwid}<4 then
  game:GetService("Players").LocalPlayer:Kick("Your executor does not support HWID. Use Delta, Synapse, Fluxus, or another executor with gethwid().")
  return
end

-- Anti-spy
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

local ${v.pid}=tostring(game.PlaceId or 0)
local ${v.jid}=tostring(game.JobId or "")
local ${v.age}=tostring(${v.p}.AccountAge or 0)
local ${v.name}=${v.p}.Name or ""
local ${v.ex}=""
pcall(function() if type(identifyexecutor)=="function" then ${v.ex}=tostring(identifyexecutor()) elseif type(getexecutorname)=="function" then ${v.ex}=tostring(getexecutorname()) end end)
local ${v.ts}=tostring(os.time())

local ${v.url}=_ep.."?slug=${slug}&phase=deliver&nonce=${nonce}&sig=${sig}"
  .."&uid="..${v.uid}
  .."&hwid="..${v.hwid}
  .."&pid="..${v.pid}
  .."&jid="..${v.jid}
  .."&age="..${v.age}
  .."&name="..game:GetService("HttpService"):UrlEncode(${v.name})
  .."&ex="..game:GetService("HttpService"):UrlEncode(${v.ex})
  .."&ts="..${v.ts}
  .."&_="..tostring(tick())

local ${v.resp}=${v.sf}(${v.url})
if not ${v.resp} or #${v.resp}==0 then
  warn("[ULT] Network error")
  return
end

-- If response starts with -- or game: it's a Lua script (kick/key system)
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
    pcall(function()
      if writefile and loadfile then
        local _p2=tostring(math.random(100000000,999999999))..".lua"
        writefile(_p2,${v.resp})
        ${v.fn}=loadfile(_p2)
        pcall(function() if delfile then delfile(_p2) end end)
      end
    end)
  end
  if not ${v.fn} then
    local co=coroutine.create(function() return loadstring(${v.resp}) end)
    local ok,r=coroutine.resume(co)
    if ok then ${v.fn}=r end
  end
  if ${v.fn} then pcall(${v.fn}) end
  return
end

-- Decrypt chunked content (ULT_C: format)
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
  
  -- Build decryption key from nonce+uid
  local ks="${slug}:${nonce}:ULTv15:"..${v.uid}
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
    pcall(function()
      if writefile and loadfile then
        local _p2=tostring(math.random(100000000,999999999))..".lua"
        writefile(_p2,assembled)
        execFn=loadfile(_p2)
        pcall(function() if delfile then delfile(_p2) end end)
      end
    end)
  end
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

// ==================== KEY SYSTEM GUI (same visual as before) ====================
function generateKeyGui(slug: string, baseUrl: string, panelName: string, themeColor: string, decalId?: string): string {
  const nc = (themeColor || '').trim();
  const tc = !nc || nc === '255, 255, 255' ? '188, 134, 255' : nc;
  const cp = tc.split(',').map(s => s.trim());
  const r = cp[0] || '180', g = cp[1] || '120', b = cp[2] || '255';
  const eu = encodeUrl(baseUrl, '_ultEndpoint');

  return `-- ULT Key System v7 (Citadel)
local Players=game:GetService("Players")
local TweenService=game:GetService("TweenService")
local UserInputService=game:GetService("UserInputService")
local HttpService=game:GetService("HttpService")
local Lighting=game:GetService("Lighting")
${eu}
local function _ultFetch(u)
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
addLabel(titleBar,UDim2.new(0,200,1,0),UDim2.new(1,-214,0,0),"Ult Citadel v15",mutedText,Enum.Font.GothamMedium,9,Enum.TextXAlignment.Right,5)
local contentArea=Instance.new("Frame",win) contentArea.Size=UDim2.new(1,-24,1,-56) contentArea.Position=UDim2.new(0,12,0,44) contentArea.BackgroundTransparency=1 contentArea.ZIndex=4
local leftPanel=makePanel(contentArea,UDim2.new(0.58,-6,1,0),UDim2.new(0,0,0,0),panelBg,4,24) addStroke(leftPanel,borderCol)
addLabel(leftPanel,UDim2.new(1,-20,0,14),UDim2.new(0,12,0,12),"INSTANT DELIVERY",themeCol,Enum.Font.GothamBold,9,Enum.TextXAlignment.Left,5)
addLabel(leftPanel,UDim2.new(0,180,0,28),UDim2.new(0,12,0,28),"ULT CITADEL",fgColor,Enum.Font.GothamBlack,20,Enum.TextXAlignment.Left,5)
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
makeStatCard(leftPanel,UDim2.new(0,12,0,180),"PROTOCOL","Citadel")
makeStatCard(leftPanel,UDim2.new(0.34,8,0,180),"PAYLOAD","Encrypted")
makeStatCard(leftPanel,UDim2.new(0.67,4,0,180),"HWID","Bound")
local rightPanel=makePanel(contentArea,UDim2.new(0.42,-6,1,0),UDim2.new(0.58,6,0,0),softBg,4,24) addStroke(rightPanel,borderCol)
addLabel(rightPanel,UDim2.new(0.6,0,0,14),UDim2.new(0,12,0,12),"CONSOLE FEEDBACK",mutedText,Enum.Font.GothamBold,8,Enum.TextXAlignment.Left,5)
local routeBadge=makePanel(rightPanel,UDim2.new(0,70,0,18),UDim2.new(1,-82,0,10),Color3.fromRGB(16,14,22),5) addStroke(routeBadge,themeCol).Transparency=0.6
addLabel(routeBadge,UDim2.new(1,0,1,0),UDim2.new(0,0,0,0),"CITADEL",fgColor,Enum.Font.GothamBold,7,Enum.TextXAlignment.Center,6)
local function makeLogLine(parent,pos,text) local line=makePanel(parent,UDim2.new(1,-24,0,36),pos,Color3.fromRGB(18,15,27),5,16) addStroke(line,borderCol).Transparency=0.15 local lbl=addLabel(line,UDim2.new(1,-12,1,0),UDim2.new(0,8,0,0),text,Color3.fromRGB(150,145,165),Enum.Font.RobotoMono,10,Enum.TextXAlignment.Left,6) return line,lbl end
local log1,log1Text=makeLogLine(rightPanel,UDim2.new(0,12,0,42),"> awaiting executor handshake")
local log2,log2Text=makeLogLine(rightPanel,UDim2.new(0,12,0,84),"> waiting for key input")
local log3,log3Text=makeLogLine(rightPanel,UDim2.new(0,12,0,126),"> idle")
local log4,log4Text=makeLogLine(rightPanel,UDim2.new(0,12,0,168),"> ...")
local infoBox=makePanel(rightPanel,UDim2.new(1,-24,0,56),UDim2.new(0,12,1,-68),Color3.fromRGB(16,14,22),5,16) addStroke(infoBox,themeCol).Transparency=0.75
addLabel(infoBox,UDim2.new(1,-12,1,-8),UDim2.new(0,6,0,4),"Protected by ULT Citadel v15. HWID-bound. HMAC-signed delivery.",mutedText,Enum.Font.Gotham,8,Enum.TextXAlignment.Left,6)
TweenService:Create(win,TweenInfo.new(0.5,Enum.EasingStyle.Quad,Enum.EasingDirection.Out),{BackgroundTransparency=0}):Play()
local dragging=false local dragStart,startPos
titleBar.InputBegan:Connect(function(i) if i.UserInputType==Enum.UserInputType.MouseButton1 or i.UserInputType==Enum.UserInputType.Touch then dragging=true dragStart=i.Position startPos=win.Position end end)
titleBar.InputEnded:Connect(function(i) if i.UserInputType==Enum.UserInputType.MouseButton1 or i.UserInputType==Enum.UserInputType.Touch then dragging=false end end)
UserInputService.InputChanged:Connect(function(i) if dragging and (i.UserInputType==Enum.UserInputType.MouseMovement or i.UserInputType==Enum.UserInputType.Touch) then local d=i.Position-dragStart win.Position=UDim2.new(startPos.X.Scale,startPos.X.Offset+d.X,startPos.Y.Scale,startPos.Y.Offset+d.Y) end end)
local validating=false local unloading=false
local function unloadUi() if unloading then return end unloading=true validating=false pcall(function() blur:Destroy() end) pcall(function() gui:Destroy() end) end
dot1.MouseButton1Click:Connect(unloadUi)
local function setProgress(pct)
  TweenService:Create(progressFill,TweenInfo.new(0.15,Enum.EasingStyle.Quad),{Size=UDim2.new(pct/100,0,1,0)}):Play()
  progressPct.Text=tostring(math.floor(pct)).."%"
end
local function setStatus(t) statusBadgeText.Text=t end
local function setLog(n,t) if n==1 then log1Text.Text=t elseif n==2 then log2Text.Text=t elseif n==3 then log3Text.Text=t elseif n==4 then log4Text.Text=t end end
local function validate()
  if validating or unloading then return end
  local key=input.Text:gsub("%s","")
  if #key<3 then setLog(2,"> key too short") return end
  validating=true
  setStatus("Verifying")
  setLog(1,"> key submitted")
  setLog(2,"> contacting server...")
  setProgress(20)
  task.spawn(function()
    local uid=tostring(plr.UserId)
    local url=_ultEndpoint.."?slug=${slug}&key="..HttpService:UrlEncode(key).."&uid="..uid.."&_="..tostring(tick())
    local resp=_ultFetch(url)
    if not resp or unloading then validating=false setStatus("Ready") return end
    setProgress(50)
    if resp:find("KEY_VALID_SCRIPT:") then
      setLog(1,"> key accepted")
      setLog(2,"> loading protected script...")
      setLog(3,"> HWID binding active")
      setProgress(80)
      local script=resp:sub(resp:find(":")+2)
      setProgress(100)
      setStatus("Loaded")
      setLog(4,"> script delivered")
      task.wait(0.5)
      unloadUi()
      local fn
      pcall(function()
        if writefile and loadfile and delfile then
          local p=".cache/"..tostring(math.random(100000000,999999999))..".lua"
          pcall(function() if makefolder then makefolder(".cache") end end)
          writefile(p,script)
          fn=loadfile(p)
          pcall(function() delfile(p) end)
        end
      end)
      if not fn then
        local co=coroutine.create(function() return loadstring(script) end)
        local ok,r=coroutine.resume(co)
        if ok then fn=r end
      end
      if fn then pcall(fn) end
    elseif resp:find("KEY_EXPIRED") then
      setLog(2,"> key has expired")
      setLog(3,"> request new key")
      setStatus("Expired")
      statusBadge.BackgroundColor3=dangerCol
      validating=false
    elseif resp:find("KEY_ASSIGNED") then
      setLog(2,"> key belongs to another user")
      setStatus("Denied")
      statusBadge.BackgroundColor3=dangerCol
      validating=false
    else
      setLog(2,"> invalid key")
      setStatus("Invalid")
      statusBadge.BackgroundColor3=dangerCol
      validating=false
    end
  end)
end
input.FocusLost:Connect(function(enter) if enter then validate() end end)
setLog(1,"> executor handshake complete")
setLog(2,"> enter key and press Enter")
setStatus("Ready")
`;
}

// ==================== MAIN HANDLER ====================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  if (banCache.ts === 0) await refreshBans();
  else refreshBans().catch(() => {});

  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || 'unknown';

  if (isBanned(clientIp)) return new Response('warn("[ULT] Access denied")', { status: 200, headers: textHeaders });

  cleanup();
  if (!globalOk()) return new Response(kick('Server busy. Please rejoin.'), { status: 200, headers: textHeaders });

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');
    const phase = url.searchParams.get('phase');
    const uid = url.searchParams.get('uid');
    const hwid = url.searchParams.get('hwid');
    const keyParam = url.searchParams.get('key');
    const kbt = url.searchParams.get('kbt');
    const userAgent = req.headers.get('user-agent') || '';
    const roblox = isRoblox(userAgent);
    const browser = isBrowser(req.headers);
    const bot = !roblox && !browser && isBot(req.headers);

    // ===== BYPASS REPORT =====
    if (url.searchParams.get('_report') === 'bypass') {
      const rUid = url.searchParams.get('uid') || '';
      if (rUid && /^\d+$/.test(rUid) && parseInt(rUid) > 1000) {
        await supabase.from('global_bans').upsert({ ban_type: 'roblox_id', ban_value: rUid, reason: `Bypass: ${url.searchParams.get('reason') || 'unknown'}`, is_active: true }, { onConflict: 'ban_type,ban_value' });
        banCache.robloxIds.add(rUid);
        autoBan(clientIp, 'bypass', rUid);
      }
      return new Response('ok', { status: 200, headers: textHeaders });
    }

    // ===== BOT/SPOOF DETECTION =====
    if (bot || isSpoofed(req.headers)) return new Response(honeypot(), { status: 200, headers: textHeaders });

    const robloxIdHeader = req.headers.get('roblox-id') || '';
    if (robloxIdHeader && (isNaN(parseInt(robloxIdHeader, 10)) || parseInt(robloxIdHeader, 10) < 1000)) {
      return new Response(honeypot(), { status: 200, headers: textHeaders });
    }

    if (!rateOk(clientIp)) return new Response(kick('Too many requests'), { status: 200, headers: textHeaders });
    if (!slug) return new Response('warn("[ULT] Missing slug")', { status: 200, headers: textHeaders });
    if (!slugOk(clientIp, slug)) return new Response(kick('Too many requests for this script'), { status: 200, headers: textHeaders });

    // Cleanup tokens occasionally
    if (Math.random() < 0.005) { try { await supabase.rpc('cleanup_expired_tokens'); } catch {} }

    // ===== FETCH PASTE =====
    let paste = getPaste(slug);
    if (!paste) {
      try {
        const result = await Promise.race([
          supabase.from('pastes').select('*').eq('slug', slug).single(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), 15000)),
        ]) as any;
        paste = result.data;
        if (paste) setPaste(slug, paste);
      } catch (e: any) {
        if (e?.message === 'TIMEOUT') return new Response(kick('Server high load. Please rejoin.'), { status: 200, headers: textHeaders });
        throw e;
      }
    }
    if (!paste) return new Response('warn("[ULT] Paste not found")', { status: 200, headers: textHeaders });

    // ===== GEO-BLOCKING =====
    if (paste.geo_blocking_enabled && paste.geo_blocked_countries?.length) {
      const country = getCountry(req.headers);
      if (country && paste.geo_blocked_countries.includes(country)) {
        return new Response(kick('This script is not available in your region'), { status: 200, headers: textHeaders });
      }
    }

    const baseUrl = supabaseUrl + '/functions/v1/get-paste';

    // ===== KEY PANEL HELPERS =====
    const getKeyPanels = async () => {
      const { data } = await supabase.from('control_panels').select('id, name, created_at').eq('paste_id', paste.id).eq('is_keysystem', true).order('created_at', { ascending: false });
      return data || [];
    };
    const getPreferredPanel = async () => {
      const panels = await getKeyPanels();
      if (panels.length <= 1) return panels[0] ?? null;
      const { data: keyed } = await supabase.from('control_panel_keys').select('panel_id').in('panel_id', panels.map((p: any) => p.id)).order('created_at', { ascending: false }).limit(1);
      if (keyed?.[0]?.panel_id) { const m = panels.find((p: any) => p.id === keyed[0].panel_id); if (m) return m; }
      return panels[0];
    };

    // ===== KEY VALIDATION =====
    if (keyParam && uid) {
      const panels = await getKeyPanels();
      if (!panels.length) return new Response('KEY_INVALID:No key system', { status: 200, headers: textHeaders });
      const { data: km } = await supabase.from('control_panel_keys').select('*').in('panel_id', panels.map((p: any) => p.id)).eq('key_value', keyParam).limit(1);
      const kd = km?.[0];
      if (!kd) return new Response('KEY_INVALID:Wrong key', { status: 200, headers: textHeaders });
      if (kd.expires_at && new Date(kd.expires_at) < new Date()) return new Response('KEY_EXPIRED:Key has expired', { status: 200, headers: textHeaders });
      if (!kd.roblox_user_id) return new Response('KEY_INVALID:Key not assigned', { status: 200, headers: textHeaders });
      if (kd.roblox_user_id !== uid) {
        if (kd.redeemed_at) return new Response('KEY_ASSIGNED:Key belongs to another user', { status: 200, headers: textHeaders });
        await supabase.from('control_panel_keys').update({ roblox_user_id: uid, redeemed_at: new Date().toISOString() }).eq('id', kd.id);
      }
      // Key valid — create a signed bypass token (no DB needed!)
      const bypassTs = Date.now().toString();
      const bypassData = `kbt:${slug}:${uid}:${bypassTs}`;
      const bypassSig = await hmacSign(bypassData);
      const redirectUrl = encodeUrl(`${baseUrl}?slug=${slug}&kbt=${bypassTs}&kbs=${bypassSig}&uid=${uid}`, '_kbtUrl');
      return new Response(`KEY_VALID_SCRIPT: ${redirectUrl}\nlocal s,r=pcall(function() local result;pcall(function() if type(request)=="function" then local x=request({Url=_kbtUrl,Method="GET"}) if x and x.Body then result=x.Body end end end);if result then return result end;pcall(function() if type(syn)=="table" and type(syn.request)=="function" then local x=syn.request({Url=_kbtUrl,Method="GET"}) if x and x.Body then result=x.Body end end end);if result then return result end;return game:HttpGet(_kbtUrl) end)\nif s and r then local fn;pcall(function() if writefile and loadfile and delfile then local p=".cache/"..tostring(math.random(100000000,999999999))..".lua" pcall(function() if makefolder then makefolder(".cache") end end) writefile(p,r) fn=loadfile(p) pcall(function() delfile(p) end) end end);if not fn then local co=coroutine.create(function() return loadstring(r) end) local ok,res=coroutine.resume(co) if ok then fn=res end end;if fn then pcall(fn) end end`, { status: 200, headers: textHeaders });
    }

    // ===== KEY BYPASS TOKEN (signed, no DB lookup) =====
    if (kbt && uid && /^\d+$/.test(uid)) {
      const kbs = url.searchParams.get('kbs') || '';
      const bypassData = `kbt:${slug}:${uid}:${kbt}`;
      const valid = await hmacVerify(bypassData, kbs);
      if (!valid) return new Response(kick('Session expired, please try again'), { status: 200, headers: textHeaders });
      // Check timestamp (30s expiry)
      const bypassAge = Date.now() - parseInt(kbt);
      if (bypassAge > 30000 || bypassAge < 0) return new Response(kick('Session expired, please try again'), { status: 200, headers: textHeaders });
      // Serve loader (enters Citadel protocol)
      const nonce = generateToken(16);
      const nonceTs = Date.now().toString();
      const nonceData = `citadel:${slug}:${clientIp}:${nonceTs}:${nonce}`;
      const nonceSig = await hmacSign(nonceData);
      return new Response(generateLoader(slug, baseUrl, `${nonce}:${nonceTs}`, nonceSig), { status: 200, headers: textHeaders });
    }

    // ===== BROWSER VISITORS =====
    if (browser && !roblox) {
      if (paste.ip_tracking_enabled) logAccess(paste, clientIp, userAgent, null, 'browser').catch(() => {});
      return new Response(paste.hide_code ? '' : '-- Execute via loadstring() in Roblox.', { status: 200, headers: textHeaders });
    }

    // ===== NON-ROBLOX NON-BROWSER =====
    if (!roblox && !browser) return new Response(honeypot(), { status: 200, headers: textHeaders });

    // ============================================================
    // CITADEL v15 — 2-PHASE PROTOCOL
    // ============================================================

    // ===== PHASE 2: DELIVER (with signed nonce verification) =====
    if (phase === 'deliver') {
      const nonceParam = url.searchParams.get('nonce');
      const sigParam = url.searchParams.get('sig');
      const deliverUid = url.searchParams.get('uid');
      const deliverHwid = url.searchParams.get('hwid');

      if (!nonceParam || !sigParam || !deliverUid || !deliverHwid) {
        return new Response(kick('Invalid delivery request'), { status: 200, headers: textHeaders });
      }

      // Parse nonce (format: "randomhex:timestamp")
      const nonceParts = nonceParam.split(':');
      if (nonceParts.length !== 2) return new Response(kick('Invalid session'), { status: 200, headers: textHeaders });
      const [nonceRand, nonceTs] = nonceParts;
      const nonceAge = Date.now() - parseInt(nonceTs);

      // Verify HMAC signature — this proves the nonce was issued by this server
      const nonceData = `citadel:${slug}:${clientIp}:${nonceTs}:${nonceRand}`;
      const sigValid = await hmacVerify(nonceData, sigParam);
      if (!sigValid) {
        logThreat('invalid_sig', clientIp, deliverUid, null, { slug, nonce: nonceParam }, 'critical');
        autoBan(clientIp, 'forged_signature', deliverUid);
        return new Response(kick('Session invalid'), { status: 200, headers: textHeaders });
      }

      // Check nonce age (60 second window)
      if (nonceAge > 60000 || nonceAge < -5000) {
        return new Response(kick('Session expired. Re-execute the script.'), { status: 200, headers: textHeaders });
      }

      // Validate UserId
      if (!/^\d+$/.test(deliverUid) || parseInt(deliverUid) < 1000) {
        logThreat('invalid_uid', clientIp, deliverUid, null, { slug }, 'high');
        return new Response(kick('Invalid user identity'), { status: 200, headers: textHeaders });
      }

      // Check HWID length
      if (!deliverHwid || deliverHwid.length < 4) {
        return new Response(kick('HWID required. Use an executor with gethwid() support.'), { status: 200, headers: textHeaders });
      }

      // Check global bans
      if (banCache.robloxIds.has(deliverUid)) {
        autoBan(clientIp, 'banned_roblox_user', deliverUid);
        return new Response(kick('Access denied'), { status: 200, headers: textHeaders });
      }

      // ===== HWID VERIFICATION =====
      const { data: existingLock } = await supabase.from('paste_hwid_locks').select('*').eq('paste_id', paste.id).eq('roblox_user_id', deliverUid).maybeSingle();
      if (existingLock) {
        if (existingLock.hwid !== deliverHwid) {
          logThreat('hwid_mismatch', clientIp, deliverUid, null, { expected: existingLock.hwid.substring(0, 16), actual: deliverHwid.substring(0, 16), slug }, 'critical');
          return new Response(kick('HWID mismatch - this script is locked to another device. Contact the script owner to reset your HWID.'), { status: 200, headers: textHeaders });
        }
        supabase.from('paste_hwid_locks').update({ updated_at: new Date().toISOString() }).eq('id', existingLock.id).then(() => {}).catch(() => {});
      } else {
        await supabase.from('paste_hwid_locks').insert({ paste_id: paste.id, roblox_user_id: deliverUid, hwid: deliverHwid }).catch(() => {});
        console.log(`[CITADEL] HWID_LOCKED: uid=${deliverUid} hwid=${deliverHwid.substring(0, 8)}... slug=${slug}`);
      }

      // ===== WHITELIST / ACCESS CHECK =====
      if (paste.protection_enabled && !paste.public_protection) {
        const { data: acl } = await supabase.from('paste_access_control').select('*').eq('paste_id', paste.id).eq('roblox_user_id', deliverUid);
        const nowMs = Date.now();
        const blacklisted = acl?.some(e => e.access_type === 'blacklist' && (e.is_eternal || !e.expires_at || (Number.isFinite(Date.parse(e.expires_at)) && Date.parse(e.expires_at) > nowMs)));
        if (blacklisted) return new Response(kick('You are blacklisted'), { status: 200, headers: textHeaders });
        const whitelisted = acl?.some(e => e.access_type === 'whitelist' && (e.is_eternal || !e.expires_at || (Number.isFinite(Date.parse(e.expires_at)) && Date.parse(e.expires_at) > nowMs)));
        if (!whitelisted) return new Response(kick('Not whitelisted'), { status: 200, headers: textHeaders });
      }

      if (paste.protection_enabled && paste.public_protection) {
        const { data: bl } = await supabase.from('paste_access_control').select('*').eq('paste_id', paste.id).eq('roblox_user_id', deliverUid).eq('access_type', 'blacklist').maybeSingle();
        if (bl && (bl.is_eternal || !bl.expires_at || Date.parse(bl.expires_at) > Date.now())) {
          return new Response(kick('You are blacklisted'), { status: 200, headers: textHeaders });
        }
      }

      // Game restriction
      if (paste.game_restriction_enabled) {
        const pid = url.searchParams.get('pid');
        if (pid) {
          const { data: gb } = await supabase.from('paste_game_bindings').select('game_id').eq('paste_id', paste.id);
          if (gb && gb.length > 0 && !gb.some(b => b.game_id === pid)) {
            return new Response(kick('This script is not supported on this game'), { status: 200, headers: textHeaders });
          }
        }
      }

      // Time bomb
      if (paste.time_bomb_enabled && paste.time_bomb_expires_at && new Date(paste.time_bomb_expires_at) < new Date()) {
        fireWebhook(paste, deliverUid, clientIp, deliverHwid, 'time_bomb_expired');
        return new Response(kick('This script has expired'), { status: 200, headers: textHeaders });
      }

      // Execution limits
      if (!(await checkExecLimit(paste, deliverUid))) {
        fireWebhook(paste, deliverUid, clientIp, deliverHwid, 'exec_limit');
        return new Response(kick(`Execution limit reached (${paste.execution_limit_per_user} per ${paste.execution_limit_window})`), { status: 200, headers: textHeaders });
      }

      // Multi-account detection
      if (paste.multi_account_detection) {
        const ma = await checkMultiAccount(paste, deliverUid, deliverHwid);
        if (!ma.allowed) {
          fireWebhook(paste, deliverUid, clientIp, deliverHwid, 'multi_account');
          return new Response(kick('Multiple accounts detected - access blocked'), { status: 200, headers: textHeaders });
        }
      }

      // ===== ALL CHECKS PASSED — DELIVER CONTENT =====
      logAccess(paste, clientIp, userAgent, deliverUid, 'execution', true).catch(() => {});
      supabase.from('paste_executions').insert({ paste_id: paste.id, roblox_user_id: deliverUid }).then(() => {}).catch(() => {});
      fireWebhook(paste, deliverUid, clientIp, deliverHwid, 'Executed');

      console.log(`[CITADEL] ACCESS_GRANTED: uid=${deliverUid} hwid=${deliverHwid.substring(0, 8)}... slug=${slug}`);

      let content = paste.content;
      if (paste.crash_detection_enabled) content = wrapCrashDetect(content);
      if (paste.obfuscation_on_delivery) content = obfuscateWrap(content);

      // Encrypt with identity-derived key
      const encKey = `${slug}:${nonceParam}:ULTv15:${deliverUid}`;
      return new Response(chunkEncrypt(content, encKey), { status: 200, headers: textHeaders });
    }

    // ============================================================
    // INITIAL REQUEST — No phase parameter
    // ============================================================

    // Check for key system first
    const keyPanel = await getPreferredPanel();
    if (keyPanel && !kbt && roblox && !keyParam) {
      const { data: pd } = await supabase.from('control_panels').select('logo_url').eq('id', keyPanel.id).single();
      return new Response(generateKeyGui(slug, baseUrl, keyPanel.name, '188, 134, 255', pd?.logo_url || undefined), { status: 200, headers: textHeaders });
    }

    // Anti-fetch
    if (paste.anti_fetch_enabled && paste.hide_code && roblox && !uid) {
      const eu = encodeUrl(baseUrl, '_ep');
      return new Response(`-- Protected by ULT Citadel v15\n${eu}\nlocal p=game:GetService("Players").LocalPlayer\nif not p then p=game:GetService("Players").PlayerAdded:Wait() end\nif p.UserId > 0 then\n  local u=_ep.."?slug=${slug}&_="..tostring(tick())\n  local s,r=pcall(function() return game:HttpGet(u) end)\n  if s and r then local fn=loadstring(r) if fn then pcall(fn) end end\nend`, { status: 200, headers: textHeaders });
    }

    // ===== PHASE 1: SERVE SIGNED LOADER (no DB writes!) =====
    const nonce = generateToken(16);
    const nonceTs = Date.now().toString();
    const nonceData = `citadel:${slug}:${clientIp}:${nonceTs}:${nonce}`;
    const nonceSig = await hmacSign(nonceData);

    return new Response(generateLoader(slug, baseUrl, `${nonce}:${nonceTs}`, nonceSig), { status: 200, headers: textHeaders });

  } catch (error) {
    console.error('Error:', error);
    return new Response('warn("[ULT] Server error - please retry")', { status: 200, headers: textHeaders });
  }
});
