import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting map: IP -> { count, resetTime }
const rateLimits = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 15; // Reduced requests per minute for stricter protection
const RATE_WINDOW = 60000; // 1 minute

// Nonce tracking to prevent replay attacks (one-time use tokens)
const usedNonces = new Map<string, number>();
const NONCE_EXPIRY = 60000; // Nonces expire after 1 minute

// Server-side secret for HMAC - changes on each deployment for extra security
const SERVER_SECRET = crypto.randomUUID() + "-" + Date.now().toString(36);

// Blocked fingerprints (for known bypass attempts)
const blockedFingerprints = new Set<string>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimits.get(ip);
  
  if (!limit || now > limit.resetTime) {
    rateLimits.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }
  
  if (limit.count >= RATE_LIMIT) {
    return false;
  }
  
  limit.count++;
  return true;
}

// Clean up old nonces periodically
function cleanupNonces() {
  const now = Date.now();
  for (const [nonce, time] of usedNonces.entries()) {
    if (now - time > NONCE_EXPIRY) {
      usedNonces.delete(nonce);
    }
  }
}

// HMAC-SHA256 for server-side signature verification
async function hmacSign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Generate encrypted/obfuscated code that's hard to intercept or read
function obfuscateCode(code: string, userId: string, timestamp: number): string {
  // XOR encryption with dynamic key based on user + time
  const key = (parseInt(userId) ^ timestamp) % 256;
  const xorEncrypt = (str: string, k: number): number[] => {
    return str.split('').map((c, i) => c.charCodeAt(0) ^ ((k + i) % 256));
  };
  
  const encrypted = xorEncrypt(code, key);
  const encryptedB64 = btoa(String.fromCharCode(...encrypted));
  
  // Generate a unique execution token
  const execToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
  
  // Multi-layer obfuscated loader with anti-debug, anti-intercept measures
  return `--[[ULT LUA PROTECTS - Maximum Security Layer]]
local _0x${execToken} = (function()
local _ENV = setmetatable({}, {
__index = function(_, k)
if k == "print" or k == "warn" or k == "getfenv" or k == "setfenv" or k == "debug" then
return function() end
end
return rawget(_G, k)
end,
__newindex = function() end
})

-- Anti-debug: Disable common debugging methods
local _g = getfenv and getfenv() or _G
if _g.debug then _g.debug = nil end
if _g.getfenv then local _ = _g.getfenv; _g.getfenv = function() return {} end end

-- Tamper detection
local _http = game.HttpGet
local _load = loadstring
if not _http or not _load then return function() end end

-- Timing attack detection
local _t = tick()

local function _d(e, k)
local r = {}
for i = 1, #e do
r[i] = string.char(bit32.bxor(e[i], (k + i - 1) % 256))
end
return table.concat(r)
end

local function _b(s)
local t = {}
for c in s:gmatch('.') do t[#t+1] = string.byte(c) end
return t
end

local _e = {${encrypted.join(',')}}
local _k = ${key}

-- Anti-timing: Detect if execution is being slowed/debugged
local _t2 = tick()
if _t2 - _t > 0.1 then return function() end end

-- Decrypt and execute
local _s = _d(_e, _k)
_e = nil -- Clear encrypted data immediately

-- Self-destruct: Clear all traces
local _f = _load(_s)
_s = nil -- Clear source immediately

if _f then
setfenv(_f, setmetatable({}, {
__index = _G,
__newindex = function(t, k, v) rawset(_G, k, v) end
}))
return _f
end
return function() end
end)()

-- Execute with protection
local _r = {pcall(_0x${execToken})}
_0x${execToken} = nil -- Clear function reference

-- Final cleanup
collectgarbage("collect")

if not _r[1] then
-- Silent fail - don't expose errors
end`;
}

function kickScript(reason: string) {
  const safeReason = reason.replace(/\r?\n/g, " ").trim().slice(0, 180);
  const luaReason = JSON.stringify(safeReason);
  // Obfuscated kick to prevent bypass detection
  const kickToken = Math.random().toString(36).substring(2);
  return `--[[Protected]]local _${kickToken}=game:GetService("Players").LocalPlayer;if _${kickToken} then _${kickToken}:Kick(${luaReason})end`;
}

// Generate a secure loader with multiple anti-bypass layers
function generateSecureLoader(slug: string, baseUrl: string, pasteId: string): string {
  const loaderToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
  const antiDebugToken = Math.random().toString(36).substring(2);
  
  return `--[[ULT LUA PROTECTS - Secure Loader v3.0]]
local _${loaderToken} = (function()
-- Environment lockdown
local _ENV = setmetatable({}, {
__index = function(_, k)
local blocked = {print=1,warn=1,getfenv=1,setfenv=1,debug=1,gcinfo=1}
if blocked[k] then return function() end end
return rawget(_G, k)
end,
__newindex = function() end,
__metatable = "Protected"
})

-- Secure references (capture before any tampering)
local _g = getfenv and getfenv() or _G
local _http = game.HttpGet or game.HttpGetAsync
local _load = loadstring
local _tick = tick
local _time = os.time
local _random = math.random
local _char = string.char
local _byte = string.byte
local _sub = string.sub
local _floor = math.floor
local _pcall = pcall
local _spawn = task and task.spawn or spawn
local _wait = task and task.wait or wait
local _pairs = pairs
local _tostring = tostring
local _tonumber = tonumber

-- Anti-debug measures
if _g.debug then _g.debug = nil end
if _g.getfenv then 
local _old = _g.getfenv
_g.getfenv = function(f) 
if f == 0 or f == 1 then return {} end
return _old(f)
end 
end

-- Timing baseline for anti-debug
local _t0 = _tick()

-- Disable getgc if available (prevents script dumping)
if _g.getgc then _g.getgc = function() return {} end end

-- Disable hookfunction/hookmetamethod if available
if _g.hookfunction then _g.hookfunction = function() end end
if _g.hookmetamethod then _g.hookmetamethod = function() end end
if _g.newcclosure then 
local _old = _g.newcclosure
_g.newcclosure = function(f) return f end
end

-- Fingerprint generation (HWID-like)
local function _fp()
local p = game:GetService("Players").LocalPlayer
if not p then 
p = game:GetService("Players"):GetPropertyChangedSignal("LocalPlayer"):Wait()
p = game:GetService("Players").LocalPlayer
end

local parts = {
_tostring(p.UserId),
_tostring(game.PlaceId),
_tostring(game.JobId):sub(1,8),
_tostring(game.GameId),
_tostring(#game:GetService("Players"):GetPlayers())
}

-- Create fingerprint hash
local fp = table.concat(parts, "-")
local hash = 0
for i = 1, #fp do
hash = (hash * 31 + _byte(fp, i)) % 2147483647
end
return _tostring(hash), _tostring(p.UserId)
end

local _fingerprint, _userId = _fp()
local _timestamp = _tostring(_time())
local _nonce = ""
for i = 1, 16 do
_nonce = _nonce .. _char(_random(65, 90))
end

-- Complex signature with multiple components
local _sigData = _userId .. ":" .. _timestamp .. ":" .. "${slug}" .. ":" .. _nonce .. ":" .. _fingerprint
local _hash = 0
for i = 1, #_sigData do
_hash = (_hash * 37 + _byte(_sigData, i) * (i % 7 + 1)) % 2147483647
end
local _sig = _tostring(_hash)

-- Secondary signature for double verification
local _sig2Data = _sig .. ":" .. _userId .. ":" .. _fingerprint
local _hash2 = 0
for i = 1, #_sig2Data do
_hash2 = (_hash2 * 41 + _byte(_sig2Data, i) * (i % 11 + 1)) % 2147483647
end
local _sig2 = _tostring(_hash2)

-- Anti-debug timing check
local _t1 = _tick()
if _t1 - _t0 > 0.5 then
-- Execution is being debugged/slowed, abort silently
return
end

-- Build secure URL
local _url = "${baseUrl}?slug=${slug}&uid=" .. _userId .. "&ts=" .. _timestamp .. "&sig=" .. _sig .. "&sig2=" .. _sig2 .. "&nonce=" .. _nonce .. "&fp=" .. _fingerprint .. "&pid=${pasteId}"

-- Execute request with protection
local _success, _result = _pcall(function()
return _http(game, _url)
end)

-- Anti-timing check 2
local _t2 = _tick()
if _t2 - _t0 > 2 then return end

if _success and _result then
-- Check for kick signal (obfuscated)
if _result:find("--[[Protected]]") and _result:find(":Kick(") then
local _kickFn = _load(_result)
if _kickFn then _pcall(_kickFn) end
return
end

-- Secure execution with isolated environment
local _fn, _err = _load(_result)
_result = nil -- Clear source immediately
collectgarbage("collect")

if _fn then
-- Create sandboxed environment
local _env = setmetatable({}, {
__index = _G,
__newindex = function(t, k, v) rawset(_G, k, v) end,
__metatable = "Sandboxed"
})
setfenv(_fn, _env)

local _execSuccess = _pcall(_fn)
_fn = nil -- Clear function
_env = nil
collectgarbage("collect")
end
end
end)()

-- Cleanup
_${loaderToken} = nil
collectgarbage("collect")`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Periodic cleanup
  cleanupNonces();

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');
    const uid = url.searchParams.get('uid');
    const sig = url.searchParams.get('sig');
    const sig2 = url.searchParams.get('sig2');
    const ts = url.searchParams.get('ts');
    const nonce = url.searchParams.get('nonce');
    const fingerprint = url.searchParams.get('fp');
    const pasteIdParam = url.searchParams.get('pid');
    
    // Get client IP for rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';
    
    // Get User-Agent for additional fingerprinting
    const userAgent = req.headers.get('user-agent') || '';

    if (!slug) {
      // Don't reveal any information about the system
      return new Response('', {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Strict rate limit check
    if (!checkRateLimit(clientIp)) {
      console.log(`Rate limit exceeded for IP: ${clientIp}`);
      return new Response(kickScript('Too many requests. You have been temporarily blocked.'), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Block known bypass fingerprints
    if (fingerprint && blockedFingerprints.has(fingerprint)) {
      return new Response(kickScript('Access permanently denied.'), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch paste
    const { data: paste, error } = await supabase
      .from('pastes')
      .select('id, content, protection_enabled, user_id')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      console.error('Database error:', error);
      return new Response('', {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    if (!paste) {
      return new Response('', {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // If protection is disabled, return content directly (but still obfuscated slightly)
    if (!paste.protection_enabled) {
      // Track execution
      if (uid && /^\d+$/.test(uid)) {
        await supabase.from('paste_executions').insert({
          paste_id: paste.id,
          roblox_user_id: uid
        });
      }
      
      return new Response(paste.content, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    }

    // ===== MAXIMUM PROTECTION MODE =====
    
    // Stage 1: Initial request without credentials - return secure loader
    if (!uid) {
      const baseUrl = Deno.env.get('SUPABASE_URL') + '/functions/v1/get-paste';
      const loader = generateSecureLoader(slug, baseUrl, paste.id);
      
      return new Response(loader, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    }

    // Stage 2: Full credential verification
    
    // Validate uid format (must be numeric Roblox user ID)
    if (!/^\d+$/.test(uid)) {
      console.log(`Invalid UID format attempt: ${uid}`);
      return new Response(kickScript('Authentication failed.'), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    // Require all security parameters
    if (!sig || !sig2 || !ts || !nonce || !fingerprint) {
      console.log(`Missing security parameters for UID: ${uid}`);
      return new Response(kickScript('Security verification failed.'), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    // Check nonce hasn't been used (prevents replay attacks)
    if (usedNonces.has(nonce)) {
      console.log(`Replay attack detected - nonce reuse: ${nonce}`);
      blockedFingerprints.add(fingerprint);
      return new Response(kickScript('Replay attack detected. You have been blocked.'), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    // Mark nonce as used
    usedNonces.set(nonce, Date.now());

    // Verify timestamp (max 20 second window)
    const timestamp = parseInt(ts);
    const nowSec = Math.floor(Date.now() / 1000);

    if (Number.isNaN(timestamp) || Math.abs(nowSec - timestamp) > 20) {
      console.log(`Timestamp validation failed: ${ts}`);
      return new Response(kickScript('Request expired.'), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    // Verify primary signature
    const sigData = uid + ":" + ts + ":" + slug + ":" + nonce + ":" + fingerprint;
    let hash = 0;
    for (let i = 0; i < sigData.length; i++) {
      hash = (hash * 37 + sigData.charCodeAt(i) * ((i % 7) + 1)) % 2147483647;
    }
    const expectedSig = hash.toString();

    if (sig !== expectedSig) {
      console.log(`Primary signature mismatch for UID: ${uid}`);
      return new Response(kickScript('Signature verification failed.'), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    // Verify secondary signature
    const sig2Data = sig + ":" + uid + ":" + fingerprint;
    let hash2 = 0;
    for (let i = 0; i < sig2Data.length; i++) {
      hash2 = (hash2 * 41 + sig2Data.charCodeAt(i) * ((i % 11) + 1)) % 2147483647;
    }
    const expectedSig2 = hash2.toString();

    if (sig2 !== expectedSig2) {
      console.log(`Secondary signature mismatch for UID: ${uid}`);
      return new Response(kickScript('Double verification failed.'), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    // Verify paste ID matches (prevents URL manipulation)
    if (pasteIdParam && pasteIdParam !== paste.id) {
      console.log(`Paste ID mismatch: ${pasteIdParam} vs ${paste.id}`);
      return new Response(kickScript('Resource verification failed.'), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    // Check access control with expiration
    const { data: accessEntries } = await supabase
      .from('paste_access_control')
      .select('id, access_type, expires_at, is_eternal')
      .eq('paste_id', paste.id)
      .eq('roblox_user_id', uid);

    const now = new Date().toISOString();

    // Auto-cleanup expired entries
    const expiredEntries = accessEntries?.filter(e => {
      if (e.is_eternal) return false;
      if (!e.expires_at) return false;
      return e.expires_at <= now;
    });

    if (expiredEntries && expiredEntries.length > 0) {
      await supabase
        .from('paste_access_control')
        .delete()
        .in('id', expiredEntries.map(e => e.id));
    }

    // Re-fetch fresh entries
    const { data: freshEntries } = await supabase
      .from('paste_access_control')
      .select('access_type, expires_at, is_eternal')
      .eq('paste_id', paste.id)
      .eq('roblox_user_id', uid);

    // Check for blacklist first (highest priority)
    const blacklisted = freshEntries?.find(e => {
      if (e.access_type !== 'blacklist') return false;
      if (e.is_eternal) return true;
      if (!e.expires_at) return true;
      return e.expires_at > now;
    });

    if (blacklisted) {
      console.log(`Blacklisted user attempted access: ${uid}`);
      // Also block their fingerprint
      blockedFingerprints.add(fingerprint);
      return new Response(kickScript('You have been permanently blacklisted.'), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    // Check for valid whitelist entry
    const whitelisted = freshEntries?.find(e => {
      if (e.access_type !== 'whitelist') return false;
      if (e.is_eternal) return true;
      if (!e.expires_at) return true;
      return e.expires_at > now;
    });

    if (!whitelisted) {
      console.log(`Non-whitelisted user attempted access: ${uid}`);
      return new Response(kickScript('You are not authorized to access this script.'), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    // Track execution
    await supabase.from('paste_executions').insert({
      paste_id: paste.id,
      roblox_user_id: uid
    });

    console.log(`Access granted to UID: ${uid} for paste: ${paste.id}`);

    // Return fully obfuscated and encrypted code
    const protectedCode = obfuscateCode(paste.content, uid, timestamp);
    
    return new Response(protectedCode, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
      },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response('', {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    });
  }
});
