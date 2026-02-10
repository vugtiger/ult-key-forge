import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  // Prevent Roblox/executor HTTP caching from causing stale loader/token behavior
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

// Enhanced rate limiting with IP tracking
const rateLimits = new Map<string, { count: number; resetTime: number; blocked: boolean }>();
const suspiciousIps = new Map<string, { strikes: number; lastStrike: number }>();

// ===== ANTI-FETCH PROTECTION =====
// Comprehensive list of known bot/fetch user agents to block
const BLOCKED_USER_AGENTS = [
  // Discord bots and libraries
  'discordbot', 'discord.js', 'discord-http', 'discord', 'eris', 'oceanic',
  // HTTP clients
  'axios', 'node-fetch', 'got', 'undici', 'needle', 'superagent', 'request',
  'httpie', 'curl', 'wget', 'python-requests', 'python-urllib', 'aiohttp',
  'httpx', 'libcurl', 'php', 'perl', 'ruby', 'java/', 'apache-httpclient',
  'okhttp', 'retrofit', 'unirest', 'restsharp', 'flurl',
  // Scripting/fetch tools
  'synapse', 'script-ware', 'krnl', 'fluxus', 'jjsploit', 'oxygen',
  // Scraping/automation
  'puppeteer', 'playwright', 'selenium', 'phantomjs', 'headless',
  'crawler', 'spider', 'scraper', 'bot', 'fetch',
  // API testing tools
  'postman', 'insomnia', 'thunder client', 'hoppscotch', 'paw/',
  // Miscellaneous
  'lua', 'luajit', 'resty', 'openresty',
];

// Additional suspicious patterns in user agent
const SUSPICIOUS_UA_PATTERNS = [
  /^$/,                          // Empty user agent
  /^\s*$/,                       // Whitespace only
  /^[a-z]+\/\d+\.\d+$/i,        // Simple "name/version" pattern (often bots)
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

// Known Discord bot fetcher patterns
const DISCORD_BOT_PATTERNS = [
  /discord/i,
  /deno\//i,
  /bun\//i,
  /node\//i,
  /cloudflare-workers/i,
];

function isBlockedUserAgent(ua: string): boolean {
  const lowerUa = ua.toLowerCase();
  
  // Check against blocked user agents list
  for (const blocked of BLOCKED_USER_AGENTS) {
    if (lowerUa.includes(blocked)) {
      return true;
    }
  }
  
  // Check against suspicious patterns
  for (const pattern of SUSPICIOUS_UA_PATTERNS) {
    if (pattern.test(ua)) {
      return true;
    }
  }
  
  return false;
}

function isDiscordBotRequest(headers: Headers): boolean {
  const ua = headers.get('user-agent') || '';
  
  // Check Discord bot patterns
  for (const pattern of DISCORD_BOT_PATTERNS) {
    if (pattern.test(ua)) {
      return true;
    }
  }
  
  // Check for Discord-specific headers
  const via = headers.get('via') || '';
  const xForwardedFor = headers.get('x-forwarded-for') || '';
  
  // Discord proxies requests through their infrastructure
  if (via.toLowerCase().includes('discord') || xForwardedFor.includes('discord')) {
    return true;
  }
  
  return false;
}

// Validate that request looks like it's from a real Roblox executor
function validateRobloxExecutor(headers: Headers): { valid: boolean; reason: string } {
  const ua = headers.get('user-agent') || '';
  const accept = headers.get('accept') || '';
  const acceptLanguage = headers.get('accept-language');
  const secFetchMode = headers.get('sec-fetch-mode');
  const secFetchDest = headers.get('sec-fetch-dest');
  const secFetchSite = headers.get('sec-fetch-site');
  const secChUa = headers.get('sec-ch-ua');
  const origin = headers.get('origin');
  const referer = headers.get('referer');
  
  // Browser-specific headers that Roblox executors DON'T send
  // Browsers are handled separately - mark them as browser for different flow
  if (secFetchMode || secFetchDest || secFetchSite || secChUa) {
    return { valid: false, reason: 'browser_headers' };
  }
  
  // Browsers send HTML in accept header
  if (accept.includes('text/html')) {
    return { valid: false, reason: 'html_accept' };
  }
  
  // Browsers have origin/referer
  if (origin || referer) {
    return { valid: false, reason: 'origin_referer' };
  }
  
  // Check if blocked user agent FIRST (bots, Discord, etc.)
  if (isBlockedUserAgent(ua)) {
    return { valid: false, reason: 'blocked_ua' };
  }
  
  // Check for Discord bot patterns
  if (isDiscordBotRequest(headers)) {
    return { valid: false, reason: 'discord_bot' };
  }
  
  // Check for Roblox HttpService signature (explicit Roblox clients)
  const isRobloxUA = ua.toLowerCase().includes('roblox') || 
                     ua.includes('HttpService') ||
                     ua.includes('WinInet');
  
  if (isRobloxUA) {
    // Validate further - Roblox requests don't have complex accept-language
    if (acceptLanguage && acceptLanguage.split(',').length > 5) {
      return { valid: false, reason: 'complex_accept_language' };
    }
    return { valid: true, reason: 'roblox_ua' };
  }
  
  // Empty or very minimal user agent is suspicious
  if (!ua || ua.length < 5) {
    return { valid: false, reason: 'minimal_ua' };
  }
  
  // Many executors use custom user agents that DON'T contain "Roblox"
  // They still send requests without browser headers
  // Key indicators of a valid executor request:
  // 1. No sec-fetch-* headers (already checked above)
  // 2. No origin/referer (already checked above)
  // 3. Not a blocked user agent (already checked above)
  // 4. Has some kind of user agent
  
  // If we get here, the request has passed all bot detection checks
  // It's likely a legitimate executor with a custom user agent
  return { valid: true, reason: 'executor_client' };
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimits.get(ip);
  
  // Check if IP is blocked
  const suspicious = suspiciousIps.get(ip);
  if (suspicious && suspicious.strikes >= 5) {
    // Block for 1 hour after 5 strikes
    if (now - suspicious.lastStrike < 3600000) {
      return false;
    }
    suspiciousIps.delete(ip);
  }
  
  if (!limit || now > limit.resetTime) {
    rateLimits.set(ip, { count: 1, resetTime: now + 60000, blocked: false });
    return true;
  }
  
  if (limit.count >= 20) {
    // Add strike for suspicious activity
    const currentStrikes = suspicious?.strikes || 0;
    suspiciousIps.set(ip, { strikes: currentStrikes + 1, lastStrike: now });
    return false;
  }
  
  limit.count++;
  return true;
}

// Generate cryptographically random token
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

// Generate a session-bound secret for additional validation
function generateSessionSecret(ip: string, timestamp: number): string {
  const data = `${ip}:${timestamp}:ULT_SESSION_v4`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// Generate challenge code that only real Roblox can solve
function generateChallenge(): { challenge: string; answer: string } {
  const a = Math.floor(Math.random() * 1000);
  const b = Math.floor(Math.random() * 1000);
  const operation = Math.random() > 0.5 ? 'add' : 'xor';
  
  let answer: number;
  if (operation === 'add') {
    answer = a + b;
  } else {
    answer = a ^ b;
  }
  
  return {
    challenge: `${operation}:${a}:${b}`,
    answer: answer.toString()
  };
}

// XOR-encrypt plaintext into a hex string
function xorToHex(plain: string, key: string): string {
  const enc = new TextEncoder();
  const data = enc.encode(plain);
  const k = enc.encode(key);
  for (let i = 0; i < data.length; i++) data[i] = data[i] ^ k[i % k.length];
  let hex = '';
  for (let i = 0; i < data.length; i++) hex += data[i].toString(16).padStart(2, '0');
  return hex;
}

// Fetch Roblox user profile data
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
    // Fetch basic user info
    const userResponse = await fetch(`https://users.roblox.com/v1/users/${userId}`);
    if (userResponse.ok) {
      const userData = await userResponse.json();
      result.username = userData.name;
      result.displayName = userData.displayName;
      result.description = userData.description;
      result.created = userData.created;
      result.isBanned = userData.isBanned;
    }

    // Fetch avatar (thumbnail)
    const avatarResponse = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png`
    );
    if (avatarResponse.ok) {
      const avatarData = await avatarResponse.json();
      if (avatarData.data?.[0]?.imageUrl) {
        result.avatarUrl = avatarData.data[0].imageUrl;
      }
    }

    // Fetch friends count
    const friendsResponse = await fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`);
    if (friendsResponse.ok) {
      const friendsData = await friendsResponse.json();
      result.friendsCount = friendsData.count;
    }

    // Fetch followers count
    const followersResponse = await fetch(`https://friends.roblox.com/v1/users/${userId}/followers/count`);
    if (followersResponse.ok) {
      const followersData = await followersResponse.json();
      result.followersCount = followersData.count;
    }

    // Fetch following count
    const followingResponse = await fetch(`https://friends.roblox.com/v1/users/${userId}/followings/count`);
    if (followingResponse.ok) {
      const followingData = await followingResponse.json();
      result.followingCount = followingData.count;
    }

    // Fetch groups
    const groupsResponse = await fetch(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
    if (groupsResponse.ok) {
      const groupsData = await groupsResponse.json();
      if (groupsData.data) {
        result.groups = groupsData.data.slice(0, 20).map((g: any) => ({
          id: g.group.id,
          name: g.group.name,
          role: g.role.name,
        }));
      }
    }

    // Fetch badges (limited to first 20)
    const badgesResponse = await fetch(
      `https://badges.roblox.com/v1/users/${userId}/badges?limit=20&sortOrder=Desc`
    );
    if (badgesResponse.ok) {
      const badgesData = await badgesResponse.json();
      if (badgesData.data) {
        result.badges = badgesData.data.map((b: any) => ({
          id: b.id,
          name: b.name,
        }));
      }
    }

    // Fetch favorite games
    const favoritesResponse = await fetch(
      `https://games.roblox.com/v2/users/${userId}/favorite/games?limit=20`
    );
    if (favoritesResponse.ok) {
      const favoritesData = await favoritesResponse.json();
      if (favoritesData.data) {
        result.favorites = favoritesData.data.map((f: any) => ({
          id: f.id,
          name: f.name,
        }));
      }
    }
  } catch (error) {
    console.error('Error fetching Roblox profile:', error);
  }

  return result;
}

// ===== ANTI-RUNTIME LOGGER + ANTI-STATIC LOGGER + ANTI-HOOK + ANTI-DUMP PROTECTION =====
// Enhanced loader with comprehensive bypass protection
function generateLoader(slug: string, baseUrl: string, token: string, sessionSecret: string, options?: { showLoadingBar?: boolean; showWelcomeMessage?: boolean }): string {
  // Split token into parts and embed with obfuscation
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
  
  // Generate random variable names to defeat static analysis
  const v = Object.fromEntries(
    ['player','nonce','fingerprint','tokenParts','reconstruct','isHex','session',
     'hexBytes','xorBytes','bytesToString','envCheck','cachedLS','cachedHG',
     'antiLogger','antiDump','antiDebug','antiGC','safeExec','memWipe',
     'integrityCheck','nativeCheck','shieldEnv','decPayload','execFunc',
     'junk1','junk2','junk3','junk4','junk5','junk6','junk7','junk8'
    ].map(k => [k, '_' + Math.random().toString(36).substring(2, 8)])
  );
  
  // Generate junk code (more of it, varied patterns)
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

  // Randomize the order of some protection blocks
  const protectionSeed = Math.random();
  
  return `--[[ULT Protection v6.0 - ${Math.random().toString(36).substring(2,10)}]]
${junkCode}

-- Cache critical native functions BEFORE anything can hook them
local ${v.cachedLS} = loadstring
local ${v.cachedHG} = game.HttpGet

-- Native function integrity checker
local ${v.nativeCheck} = function(fn, name)
  local s = tostring(fn)
  -- Native C functions show as "function: 0x..." not custom closures
  -- Also check it hasn't been replaced with a table with __call
  if type(fn) ~= "function" then return false end
  return true
end

-- Anti-Loadstring Logger: detect if loadstring has been hooked
local ${v.antiLogger} = function()
  -- Method 1: Check if loadstring reference changed
  if rawget(_G, "loadstring") ~= nil and rawget(_G, "loadstring") ~= ${v.cachedLS} then
    return false
  end
  -- Method 2: Check for known logger globals
  local loggerSignals = {
    "loadstring_log", "ls_hook", "string_dump_log", "script_dump",
    "hooklog", "logfile", "dumpfunc", "savetofile"
  }
  for _, sig in ipairs(loggerSignals) do
    if rawget(_G, sig) ~= nil or rawget(shared, sig) ~= nil then
      return false
    end
  end
  -- Method 3: Check if someone overwrote string.dump
  if rawget(string, "dump") ~= nil then
    local ok, r = pcall(string.dump, print)
    if ok and type(r) == "string" and #r > 1000 then
      -- string.dump working on builtins is suspicious in some contexts
    end
  end
  return true
end

-- Anti-Decompile & Anti-SaveInstance: detect dump tools
local ${v.antiDump} = function()
  local dumpSignals = {
    "decompile", "disassemble", "saveinstance", "savegame",
    "writefile", "syn_context_get", "debug_info_hook",
    "getscriptbytecode", "getscripthash", "dumpstring",
    "getscriptclosure", "getscripts", "getrunningscripts",
    "getloadedmodules", "OLSSA", "olssa", "runtime_log",
    "static_log", "loadstring_logger"
  }
  -- Only block actual LOGGER tools, not standard executor globals
  -- writefile/decompile are standard executor functions, so we only
  -- block specifically named logger tools
  local dangerousSignals = {
    "OLSSA", "olssa", "runtime_log", "static_log", 
    "loadstring_logger", "script_dump", "dumpfunc",
    "logfile", "hooklog", "ls_hook", "string_dump_log"
  }
  for _, sig in ipairs(dangerousSignals) do
    if rawget(_G, sig) ~= nil or rawget(shared, sig) ~= nil then
      return false
    end
  end
  -- Check getreg/getgc for logger closures (lightweight check)
  if type(rawget(_G, "getgc")) == "function" then
    local ok, gc = pcall(getgc)
    if ok and type(gc) == "table" then
      for _, obj in ipairs(gc) do
        if type(obj) == "function" then
          local ok2, info = pcall(debug.info, obj, "n")
          if ok2 and type(info) == "string" then
            local ln = info:lower()
            if ln:find("logger") or ln:find("dumper") or ln:find("intercept") then
              return false
            end
          end
        end
      end
    end
  end
  return true
end

-- Anti-Debug Library: protect against upvalue/constant inspection
local ${v.antiDebug} = function(targetFunc)
  -- Detect if debug library hooks are present
  if type(rawget(_G, "debug")) == "table" then
    local dbg = rawget(_G, "debug")
    -- Check for suspicious debug extensions
    if rawget(dbg, "getupvalues") or rawget(dbg, "getconstants") or rawget(dbg, "getprotos") then
      -- These are executor debug extensions - check if they're being monitored
      -- We can't block them (executors need them) but we can detect active loggers
      if rawget(dbg, "setmetatable_hook") or rawget(dbg, "hook_active") then
        return false
      end
    end
  end
  -- Check for hookfunction targeting our code
  if type(rawget(_G, "hookfunction")) == "function" then
    -- hookfunction exists (normal for executors), but check if anyone
    -- has hooked loadstring specifically
    local origLS = rawget(_G, "__original_loadstring")
    if origLS ~= nil then
      return false -- Someone saved original and hooked it
    end
  end
  return true
end

-- Anti-GC Scan: make strings harder to find in garbage collector
local ${v.antiGC} = function(str)
  -- Split string into chunks and reassemble to make GC scanning harder
  if type(str) ~= "string" or #str < 10 then return str end
  local chunks = {}
  local chunkSize = math.max(1, math.floor(#str / ${Math.floor(Math.random() * 5) + 3}))
  for i = 1, #str, chunkSize do
    chunks[#chunks + 1] = str:sub(i, math.min(i + chunkSize - 1, #str))
  end
  -- Reassemble through concatenation (creates new string, old chunks become garbage)
  local result = table.concat(chunks)
  -- Clear chunk references
  for i = 1, #chunks do chunks[i] = nil end
  return result
end

-- Memory wipe utility
local ${v.memWipe} = function(t)
  if type(t) == "table" then
    for k in pairs(t) do t[k] = nil end
  end
end

-- Shield execution environment
local ${v.shieldEnv} = function(func)
  local env = setmetatable({}, {
    __index = getfenv(0),
    __newindex = function(self, key, value)
      -- Prevent external code from injecting into our environment
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

-- Basic environment check
local ${v.envCheck} = function()
  local ok, result = pcall(function()
    local ps = game:GetService("Players")
    local rs = game:GetService("RunService")
    if not ps or not rs then return false end
    return rs:IsClient() or rs:IsStudio()
  end)
  return ok and result
end

if not ${v.envCheck}() then return end

-- Run all protection checks
${protectionSeed > 0.5 ? `if not ${v.antiLogger}() then return end
if not ${v.antiDump}() then return end
if not ${v.antiDebug}() then return end` : `if not ${v.antiDump}() then return end
if not ${v.antiDebug}() then return end
if not ${v.antiLogger}() then return end`}

-- Generate unique execution nonce
local ${v.nonce} = function()
  local hs = game:GetService("HttpService")
  local ok, guid = pcall(function()
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
  pcall(function()
    if identifyexecutor then
      exFp = tostring(identifyexecutor())
    elseif getexecutorname then
      exFp = tostring(getexecutorname())
    end
  end)
  p.ex = exFp
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
  if type(str) ~= "string" then return false end
  if (#str % 2) ~= 0 then return false end
  return str:match("^[0-9a-fA-F]+$") ~= nil
end

local ${v.session} = "${sessionSecret}"
local fp = ${v.fingerprint}()
local tk = ${v.reconstruct}()

-- Wipe token parts from memory after reconstruction
${v.memWipe}(${v.tokenParts})

-- Build request URL
local url = "${baseUrl}?slug=${slug}&uid=" .. fp.u .. "&ts=" .. fp.t .. "&tk=" .. tk .. "&ss=" .. ${v.session} .. "&gid=" .. fp.g .. "&pid=" .. fp.p .. "&r=" .. fp.r .. "&ex=" .. (fp.ex or "") .. "&_=" .. tostring(tick())

-- Decryption utilities
local ${v.hexBytes} = function(h)
  local o = table.create(math.floor(#h / 2))
  local j = 1
  for i = 1, #h, 2 do
    o[j] = tonumber(h:sub(i, i + 1), 16) or 0
    j += 1
  end
  return o
end

local ${v.xorBytes} = function(b, k)
  local o = table.create(#b)
  local kl = #k
  for i = 1, #b do
    o[i] = bit32.bxor(b[i], k[((i - 1) % kl) + 1])
  end
  return o
end

local ${v.bytesToString} = function(b)
  local c = table.create(#b)
  for i = 1, #b do
    c[i] = string.char(b[i])
  end
  return table.concat(c)
end

-- Generate decryption key
local ks = "${slug}:" .. tk .. ":ULTv3:" .. fp.u
local kb = {}
for i = 1, #ks do
  kb[i] = string.byte(ks, i)
end

-- Re-verify protection before network request
${protectionSeed > 0.5 ? `if not ${v.antiLogger}() then return end` : `if not ${v.antiDump}() then return end`}

${options?.showLoadingBar ? `
-- Console Loading Bar
local ${v.junk5} = {
  {msg = "Initializing ULT Protection...", pct = 10},
  {msg = "Connecting to server...", pct = 25},
  {msg = "Checking whitelist status...", pct = 40},
  {msg = "Verifying identity...", pct = 60},
  {msg = "Validating session token...", pct = 75},
  {msg = "Decrypting payload...", pct = 90},
  {msg = "Loading script...", pct = 100},
}
local function ${v.junk6}(pct)
  local barLen = 30
  local filled = math.floor(barLen * pct / 100)
  local empty = barLen - filled
  return "[" .. string.rep("█", filled) .. string.rep("░", empty) .. "] " .. pct .. "%"
end
for _, step in ipairs(${v.junk5}) do
  print("⚡ " .. step.msg .. " " .. ${v.junk6}(step.pct))
  if step.pct < 100 then
    task.wait(0.15)
  end
end
` : ''}

-- Execute request using CACHED HttpGet (anti-hook)
local s, r = pcall(function()
  return ${v.cachedHG}(game, url)
end)

-- Fallback to standard HttpGet if cached version fails
if not s then
  s, r = pcall(function()
    return game:HttpGet(url)
  end)
end

if s and r then
  if r == "" then
    warn("Empty response")
    return
  end

  -- Handle refresh loader response
  if r:sub(1,2) == "--" then
    local rf, re = ${v.cachedLS}(r)
    if rf then
      return rf()
    end
    warn("Protection error")
    return
  end

  -- Handle encrypted response
  if ${v.isHex}(r) then
    -- Decrypt using anti-GC protection
    local ${v.decPayload} = ${v.antiGC}(${v.bytesToString}(${v.xorBytes}(${v.hexBytes}(r), kb)))
    
    -- Final security check before execution
    if not ${v.antiLogger}() or not ${v.antiDump}() then
      ${v.decPayload} = nil
      return
    end
    
${options?.showWelcomeMessage ? `    -- Welcome message
    pcall(function()
      local pName = ${v.player}.DisplayName or ${v.player}.Name
      print("✅ Welcome, " .. tostring(pName) .. "!")
      print("🔒 Script loaded successfully via ULT Protection v6.0")
    end)
` : ''}
    -- Use CACHED loadstring (anti-hook)
    local ${v.execFunc}, e = ${v.cachedLS}(${v.decPayload})
    
    -- Wipe decrypted payload from memory immediately
    ${v.decPayload} = nil
    r = nil
    
    if ${v.execFunc} then
      -- Shield execution environment
      ${v.shieldEnv}(${v.execFunc})
      ${v.execFunc}()
      ${v.execFunc} = nil
    else
      warn("E:" .. tostring(e))
    end
    return
  end

  -- Plain Lua response (kick script, etc.)
  local pf, pe = ${v.cachedLS}(r)
  if pf then
    return pf()
  end
  warn("E:" .. tostring(pe))
else
  warn("Network error")
end
`;
}

// Generate kick script (plain - for initial loader response)
function generateKickPlain(reason: string): string {
  return `game:GetService("Players").LocalPlayer:Kick("${reason}")`;
}

// Generate encrypted kick script (for token-validated requests)
function generateKickEncrypted(reason: string, slug: string, token: string, uid: string): string {
  const kickScript = `game:GetService("Players").LocalPlayer:Kick("${reason}")`;
  const key = `${slug}:${token}:ULTv3:${uid}`;
  return xorToHex(kickScript, key);
}

// Generate honeypot/fake code to return to bots
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

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');
    const uid = url.searchParams.get('uid');
    const ts = url.searchParams.get('ts');
    const tk = url.searchParams.get('tk');
    const ss = url.searchParams.get('ss'); // Session secret
    const gid = url.searchParams.get('gid'); // Game ID
    const pid = url.searchParams.get('pid'); // Place ID
    const ex = url.searchParams.get('ex'); // Executor identifier
    const oauthTs = url.searchParams.get('oauth_ts'); // set after OAuth callback to prevent redirect loop

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';
    
    const userAgent = req.headers.get('user-agent') || '';
    const accept = req.headers.get('accept') || '';
    const secFetchMode = req.headers.get('sec-fetch-mode') || '';
    const secFetchDest = req.headers.get('sec-fetch-dest') || '';
    const origin = req.headers.get('origin') || '';
    const referer = req.headers.get('referer') || '';
    
    // ===== ANTI-FETCH PROTECTION: Validate request source =====
    const validationResult = validateRobloxExecutor(req.headers);
    
    // Log all requests with validation result for debugging
    console.log(
      `[get-paste] VALIDATION slug=${slug ?? 'none'} ip=${clientIp} ` +
      `valid=${validationResult.valid} reason=${validationResult.reason} ` +
      `ua="${userAgent.substring(0, 50)}"`
    );
    
    // Block requests that fail validation (unless they're browsers which we handle separately)
    if (!validationResult.valid && validationResult.reason !== 'browser_headers' && 
        validationResult.reason !== 'html_accept' && validationResult.reason !== 'origin_referer') {
      console.log(`[get-paste] BLOCKED: ${validationResult.reason} from ${clientIp}`);
      
      // Add strike for bypass attempts
      const strikes = (suspiciousIps.get(clientIp)?.strikes || 0) + 2;
      suspiciousIps.set(clientIp, { strikes, lastStrike: Date.now() });
      
      // Return honeypot/fake code to bots
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
    
    // Rate limiting
    if (!checkRateLimit(clientIp)) {
      console.log(`Rate limited: ${clientIp}`);
      return new Response(generateKickPlain('Too many requests - You have been temporarily blocked'), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    if (!slug) {
      return new Response('Missing slug', { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Cleanup old tokens periodically
    if (Math.random() < 0.01) {
      try {
        await supabase.rpc('cleanup_expired_tokens');
      } catch {
        // Ignore cleanup errors
      }
    }

    // Fetch the paste
    const { data: paste, error } = await supabase
      .from('pastes')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error || !paste) {
      return new Response('Paste not found', { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    console.log(
      `[get-paste] slug=${slug} uid=${uid ?? ''} hasTk=${Boolean(tk)} ip=${clientIp} ` +
      `robloxUA=${isRobloxRequest} browser=${isLikelyBrowser} hide=${Boolean(paste.hide_code)} ` +
      `prot=${Boolean(paste.protection_enabled)} pub=${Boolean(paste.public_protection)}`
    );

    const slugStr = slug;
    const baseUrl = supabaseUrl + '/functions/v1/get-paste';
    const textHeaders = { ...corsHeaders, 'Content-Type': 'text/plain' };

    const respondWithFreshLoader = async () => {
      const newToken = generateToken();
      const sessionSecret = generateSessionSecret(clientIp, Date.now());

      // Store token in database
      await supabase.from('paste_execution_tokens').insert({
        paste_id: paste.id,
        roblox_user_id: '0',
        token: newToken,
        expires_at: new Date(Date.now() + 30000).toISOString()
      });

      const loader = generateLoader(slugStr, baseUrl, newToken, sessionSecret, {
        showLoadingBar: paste.show_loading_bar !== false,
        showWelcomeMessage: paste.show_welcome_message !== false,
      });
      console.log(`Refreshed loader for paste: ${paste.id} from IP: ${clientIp}`);
      return new Response(loader, { status: 200, headers: textHeaders });
    };

    // Log access for monitoring (both browser and executor)
    const logAccess = async (robloxUserId: string | null, accessType: string, enrichWithProfile = false): Promise<string | null> => {
      try {
        if (paste.ip_tracking_enabled === false) return null;

        // Look up Discord session for this IP
        let discordData: { 
          discord_user_id: string | null; 
          discord_username: string | null; 
          discord_avatar: string | null; 
          discord_created_at: string | null;
        } = {
          discord_user_id: null,
          discord_username: null,
          discord_avatar: null,
          discord_created_at: null,
        };

        const { data: discordSession } = await supabase
          .from('discord_oauth_sessions')
          .select('*')
          .eq('ip_address', clientIp)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        if (discordSession) {
          discordData = {
            discord_user_id: discordSession.discord_user_id,
            discord_username: discordSession.discord_username,
            discord_avatar: discordSession.discord_avatar,
            discord_created_at: discordSession.discord_created_at,
          };
        }

        // Fetch Roblox profile if we have a user ID and enrichment is enabled
        let robloxProfile: Awaited<ReturnType<typeof fetchRobloxProfile>> | null = null;
        if (robloxUserId && enrichWithProfile) {
          robloxProfile = await fetchRobloxProfile(robloxUserId);
        }

        // Find existing log for this exact "identity" so we don't create duplicates.
        let q = supabase
          .from('paste_access_logs')
          .select('id')
          .eq('paste_id', paste.id)
          .eq('ip_address', clientIp)
          .eq('access_type', accessType);

        q = robloxUserId ? q.eq('roblox_user_id', robloxUserId) : q.is('roblox_user_id', null);

        const { data: existingLog } = await q.maybeSingle();

        const nowIso = new Date().toISOString();
        
        const updateData: Record<string, unknown> = {
          last_seen_at: nowIso,
          is_active: true,
          user_agent: userAgent,
          ...discordData,
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
          await supabase
            .from('paste_access_logs')
            .update(updateData)
            .eq('id', existingLog.id);
          return existingLog.id;
        } else {
          const { data: newLog } = await supabase
            .from('paste_access_logs')
            .insert({
              paste_id: paste.id,
              ip_address: clientIp,
              roblox_user_id: robloxUserId,
              access_type: accessType,
              ...updateData,
            })
            .select('id')
            .single();
          return newLog?.id || null;
        }
      } catch (logError) {
        console.error('Failed to log access:', logError);
        return null;
      }
    };

    // Check if browser visitor needs Discord identification
    const shouldRedirectToDiscord = (): boolean => {
      if (!paste.ip_tracking_enabled) return false;
      if (!isLikelyBrowser || isRobloxRequest) return false;
      if (uid || tk) return false; // executor params

      const tsNum = oauthTs ? Number(oauthTs) : NaN;
      if (Number.isFinite(tsNum) && Date.now() - tsNum < 60_000) return false;

      return true;
    };

    // Redirect browser to Discord OAuth for identification
    if (shouldRedirectToDiscord()) {
      const discordClientId = Deno.env.get('DISCORD_APPLICATION_ID');
      if (discordClientId) {
        console.log(`[get-paste] Redirecting browser to Discord OAuth slug=${slug} ip=${clientIp}`);
        return new Response(null, {
          status: 302,
          headers: {
            ...corsHeaders,
            'Location': `${supabaseUrl}/functions/v1/discord-identify?action=start&slug=${slug}`
          }
        });
      }
    }

    // Handle browser visitors (non-executor requests without auth params)
    if (isLikelyBrowser && !isRobloxRequest && !uid && !tk) {
      // Log browser visit if IP tracking is enabled
      if (paste.ip_tracking_enabled) {
        console.log(`[get-paste] browser visitor logged slug=${slug} ip=${clientIp}`);
        await logAccess(null, 'browser');
      }
      
      // Only return blank page if hide_code is explicitly enabled
      if (paste.hide_code) {
        console.log(`[get-paste] hide_code: blanking browser request slug=${slug} ip=${clientIp}`);
        return new Response('', {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }
      
      // If no protection and no hide_code, show actual content to browsers
      if (!paste.protection_enabled && !paste.public_protection) {
        return new Response(paste.content, {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }
      
      // For protected pastes without hide_code, show a user-friendly message
      return new Response('-- This script is protected. Execute via loadstring() in Roblox.', {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // ===== ANTI-FETCH: Block requests that failed validation for protected pastes =====
    // Only block if validation explicitly failed (not browser, those are handled above)
    if ((paste.protection_enabled || paste.public_protection || paste.hide_code) && !isLikelyBrowser) {
      // If validation failed for a reason other than being a browser, block it
      if (!validationResult.valid) {
        console.log(`[get-paste] BLOCKED ${validationResult.reason} for protected paste: ${slug} from ${clientIp}`);
        return new Response(generateHoneypot(), { 
          status: 200, 
          headers: textHeaders 
        });
      }
    }


    // If protection is disabled, return content directly
    if (!paste.protection_enabled && !paste.public_protection) {
      // Check game restriction if enabled
      if (paste.game_restriction_enabled && gid && pid) {
        const { data: gameBindings } = await supabase
          .from('paste_game_bindings')
          .select('game_id')
          .eq('paste_id', paste.id);

        if (gameBindings && gameBindings.length > 0) {
          // Check if current game/place is in the allowed list
          const allowedGameIds = gameBindings.map(b => b.game_id);
          const isAllowed = allowedGameIds.includes(gid) || allowedGameIds.includes(pid);

          if (!isAllowed) {
            console.log(`Game restriction blocked: gid=${gid}, pid=${pid}, allowed=${allowedGameIds.join(',')}`);
            return new Response(generateKickPlain('This script is not supported on this game'), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
            });
          }
        }
      }

      if (uid && /^\d+$/.test(uid)) {
        await logAccess(uid, 'execution', true); // Enrich with Roblox profile
        await supabase.from('paste_executions').insert({
          paste_id: paste.id,
          roblox_user_id: uid
        });
      }
      
      return new Response(paste.content, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Protection is enabled - check for auth params
    if (!uid || !ts || !tk) {
      // Log browser hits
      if (isLikelyBrowser && !isRobloxRequest) {
        await logAccess(null, 'browser');
        // Return empty response for browser
        return new Response('', {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }
      
      // Generate a new one-time token with session binding
      const newToken = generateToken();
      const sessionSecret = generateSessionSecret(clientIp, Date.now());
      
      // Store token in database with IP binding
      await supabase.from('paste_execution_tokens').insert({
        paste_id: paste.id,
        roblox_user_id: '0',
        token: newToken,
        expires_at: new Date(Date.now() + 30000).toISOString()
      });

      // Return the loader script with obfuscated token
      const loader = generateLoader(slugStr, baseUrl, newToken, sessionSecret);
      
      console.log(`Generated secure loader for paste: ${paste.id} from IP: ${clientIp}`);
      
      return new Response(loader, {
        status: 200,
        headers: textHeaders
      });
    }

    // Validate user ID format
    if (!/^\d+$/.test(uid)) {
      console.log(`Invalid UID format: ${uid} from IP: ${clientIp}`);
      return new Response(generateKickEncrypted('Invalid user ID', slug, tk, uid), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Verify timestamp (3 minute window - tighter security)
    const timestamp = parseInt(ts);
    const now = Math.floor(Date.now() / 1000);
    if (isNaN(timestamp) || Math.abs(now - timestamp) > 180) {
      console.log(`Expired request: ts=${ts}, now=${now}, diff=${Math.abs(now - timestamp)}`);
      return await respondWithFreshLoader();
    }

    // Detect bypass attempts - check for suspicious patterns
    if (!isRobloxRequest && userAgent.includes('axios')) {
      console.log(`BYPASS ATTEMPT DETECTED: axios from ${clientIp}`);
      // Add strike
      const strikes = (suspiciousIps.get(clientIp)?.strikes || 0) + 2;
      suspiciousIps.set(clientIp, { strikes, lastStrike: Date.now() });
      return new Response(generateKickEncrypted('Access denied - Invalid client', slug, tk, uid), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Validate one-time token
    const { data: tokenData, error: tokenError } = await supabase
      .from('paste_execution_tokens')
      .select('*')
      .eq('token', tk)
      .eq('paste_id', paste.id)
      .maybeSingle();

    if (tokenError || !tokenData) {
      console.log(`Invalid token: ${tk} from IP: ${clientIp}`);
      return await respondWithFreshLoader();
    }

    // Check if token already used
    if (tokenData.used_at) {
      console.log(`Token reuse attempt: ${tk} from IP: ${clientIp}`);
      // Add strike for token reuse attempt
      const strikes = (suspiciousIps.get(clientIp)?.strikes || 0) + 1;
      suspiciousIps.set(clientIp, { strikes, lastStrike: Date.now() });
      return await respondWithFreshLoader();
    }

    // Check if token expired
    if (new Date(tokenData.expires_at) < new Date()) {
      console.log(`Token expired: ${tk}`);
      return await respondWithFreshLoader();
    }

    // Mark token as used IMMEDIATELY (before any other checks)
    const { error: updateError } = await supabase
      .from('paste_execution_tokens')
      .update({ used_at: new Date().toISOString(), roblox_user_id: uid })
      .eq('id', tokenData.id)
      .is('used_at', null);

    if (updateError) {
      console.log(`Failed to mark token as used: ${updateError.message}`);
      return await respondWithFreshLoader();
    }

    // Check game restriction for protected pastes
    if (paste.game_restriction_enabled && gid && pid) {
      const { data: gameBindings } = await supabase
        .from('paste_game_bindings')
        .select('game_id')
        .eq('paste_id', paste.id);

      if (gameBindings && gameBindings.length > 0) {
        const allowedGameIds = gameBindings.map(b => b.game_id);
        const isAllowed = allowedGameIds.includes(gid) || allowedGameIds.includes(pid);

        if (!isAllowed) {
          console.log(`Game restriction blocked: gid=${gid}, pid=${pid}, allowed=${allowedGameIds.join(',')}`);
          return new Response(generateKickEncrypted('This script is not supported on this game', slug, tk, uid), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
          });
        }
      }
    }

    // For public protection - skip whitelist check but still check blacklist
    if (paste.public_protection) {
      // Check blacklist only
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
        blacklistEntry.is_eternal ||
        !blacklistEntry.expires_at ||
        (expiresValid && (expiresAtMs as number) > nowMs)
      );

      if (isBlacklisted) {
        console.log(`Blacklisted user (public protection): ${uid}`);
        return new Response(generateKickEncrypted('You are blacklisted', slug, tk, uid), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }

      // Log execution and access with profile enrichment
      await logAccess(uid, 'execution', true);
      await supabase.from('paste_executions').insert({
        paste_id: paste.id,
        roblox_user_id: uid
      });

      console.log(`Public protection access granted: ${uid} for paste: ${paste.id}`);

      // Return encrypted payload using enhanced key
      const key = `${slug}:${tk}:ULTv3:${uid}`;
      const encrypted = xorToHex(paste.content, key);

      return new Response(encrypted, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Standard protection - check whitelist
    const { data: accessList } = await supabase
      .from('paste_access_control')
      .select('*')
      .eq('paste_id', paste.id)
      .eq('roblox_user_id', uid);

    const nowMs = Date.now();

    // Check for blacklist first
    const isBlacklisted = accessList?.some((entry) => {
      if (entry.access_type !== 'blacklist') return false;
      if (entry.is_eternal) return true;
      if (!entry.expires_at) return true;

      const expiresAtMs = Date.parse(entry.expires_at);
      return Number.isFinite(expiresAtMs) && expiresAtMs > nowMs;
    });

    if (isBlacklisted) {
      console.log(`[get-paste] slug=${slug} paste=${paste.id} uid=${uid} decision=blacklisted`);
      return new Response(generateKickEncrypted('You are blacklisted', slug, tk, uid), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Whitelist: allow if ANY whitelist entry is valid
    const hasWhitelist = (accessList ?? []).some((e) => e.access_type === 'whitelist');
    const hasValidWhitelist = (accessList ?? []).some((entry) => {
      if (entry.access_type !== 'whitelist') return false;
      if (entry.is_eternal) return true;
      if (!entry.expires_at) return true;
      const expiresAtMs = Date.parse(entry.expires_at);
      return Number.isFinite(expiresAtMs) && expiresAtMs > nowMs;
    });

    if (!hasWhitelist) {
      console.log(`[get-paste] slug=${slug} paste=${paste.id} uid=${uid} decision=not_whitelisted`);
      return new Response(generateKickEncrypted('Not whitelisted', slug, tk, uid), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    if (!hasValidWhitelist) {
      console.log(`[get-paste] slug=${slug} paste=${paste.id} uid=${uid} decision=whitelist_expired`);
      return new Response(generateKickEncrypted('Your whitelist time has expired', slug, tk, uid), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Log execution and access with profile enrichment
    await logAccess(uid, 'execution', true);
    await supabase.from('paste_executions').insert({
      paste_id: paste.id,
      roblox_user_id: uid
    });

    console.log(`Access granted: ${uid} for paste: ${paste.id}`);

    // Return encrypted payload using enhanced key with UID binding
    const key = `${slug}:${tk}:ULTv3:${uid}`;
    const encrypted = xorToHex(paste.content, key);

    return new Response(encrypted, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response('Internal error', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});
