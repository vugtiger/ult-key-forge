import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

// Enhanced rate limiting with IP tracking
const rateLimits = new Map<string, { count: number; resetTime: number; blocked: boolean }>();
const suspiciousIps = new Map<string, { strikes: number; lastStrike: number }>();
// v9: Session trust scores - tracks behavioral scoring per IP
const trustScores = new Map<string, { score: number; lastUpdate: number; requestTimes: number[] }>();

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
  if (suspicious && suspicious.strikes >= 5) {
    if (now - suspicious.lastStrike < 3600000) return false;
    suspiciousIps.delete(ip);
  }
  if (!limit || now > limit.resetTime) {
    rateLimits.set(ip, { count: 1, resetTime: now + 60000, blocked: false });
    return true;
  }
  if (limit.count >= 20) {
    const currentStrikes = suspicious?.strikes || 0;
    suspiciousIps.set(ip, { strikes: currentStrikes + 1, lastStrike: now });
    return false;
  }
  limit.count++;
  return true;
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

// ===== ULT PROTECTION v9.0 =====
// Runtime-bound encryption, dump poisoning, fetch intent detection,
// behavioral scoring, enhanced anti-env logger, anti-hookfunction
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
     'fragA','fragB','fragC','reassemble','decayTimer'
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
  
  return `--[[ULT Protection v9.0 - ${Math.random().toString(36).substring(2,10)}]]
${junkCode}

-- ====== PHASE 0: OBTAIN CLEAN LOADSTRING ======
local ${v.cleanLS}
local ${v.clonedLS} = false

do
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

local ${v.cachedLS} = ${v.cleanLS}
local ${v.cachedHG} = game.HttpGet
local ${v.writeSink} = false

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

-- v9: Generate decryption key with runtime entropy binding
local ks = "${slug}:" .. tk .. ":ULTv9:" .. fp.u .. ":" .. (fp.entropy or "0")
local kb = {}
for i = 1, #ks do
  kb[i] = string.byte(ks, i)
end

-- Re-verify protections before network request
if not ${v.antiHook}() then ${v.silentDegrade}() end
if not ${v.antiEnvLog}() then ${v.silentDegrade}() end

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

  -- Handle refresh loader response
  if r:sub(1,2) == "--" then
    local rf, re = ${v.cachedLS}(r)
    if rf then return rf() end
    warn("Protection error")
    return
  end

  -- Handle encrypted response
  if ${v.isHex}(r) then
    local ${v.decPayload} = ${v.antiGC}(${v.bytesToString}(${v.xorBytes}(${v.hexBytes}(r), kb)))
    
    -- v9: Final security sweep - dump poison instead of block
    if not ${v.antiHook}() or not ${v.antiEnvLog}() or not ${v.antiLogger}() or not ${v.antiDump}() then
      ${v.silentDegrade}()
    end
    
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
      print("[ULT PROTECTION] Protected by ULT Protection v9.0")
    end)
` : ''}
    -- Use sandboxed execution (v9: dump poisoning enabled)
    local ${v.execFunc}, execErr = ${v.execSandbox}(${v.decPayload})
    
    -- Wipe decrypted payload from memory immediately
    ${v.decPayload} = nil
    r = nil
    
    if ${v.execFunc} then
      ${v.execFunc}()
      ${v.execFunc} = nil
    else
      if execErr == "hook_detected" or execErr == "env_logger_detected" or execErr == "logger_detected" then
        return
      end
      warn("E:" .. tostring(execErr))
    end
    return
  end

  -- Plain Lua response (key system GUI, kick messages, etc.)
  local pf, pe = ${v.cachedLS}(r)
  if pf then return pf() end
  warn("E:" .. tostring(pe))
else
  warn("Network error")
end
`;
}

// ===== KEY SYSTEM GUI GENERATOR =====
// Generated server-side so keys are never exposed to the client
function generateKeySystemGui(slug: string, baseUrl: string, panelName: string, themeColor: string): string {
  // Convert panel name to ASCII art
  const asciiChars: Record<string, string[]> = {
    'A': ['█████╗ ', '██╔══██╗', '███████║', '██╔══██║', '██║  ██║', '╚═╝  ╚═╝'],
    'B': ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔══██╗', '██████╔╝', '╚═════╝ '],
    'C': ['██████╗', '██╔════╝', '██║     ', '██║     ', '╚██████╗', ' ╚═════╝'],
    'D': ['██████╗ ', '██╔══██╗', '██║  ██║', '██║  ██║', '██████╔╝', '╚═════╝ '],
    'E': ['███████╗', '██╔════╝', '█████╗  ', '██╔══╝  ', '███████╗', '╚══════╝'],
    'F': ['███████╗', '██╔════╝', '█████╗  ', '██╔══╝  ', '██║     ', '╚═╝     '],
    'G': ['██████╗ ', '██╔════╝ ', '██║  ███╗', '██║   ██║', '╚██████╔╝', ' ╚═════╝ '],
    'H': ['██╗  ██╗', '██║  ██║', '███████║', '██╔══██║', '██║  ██║', '╚═╝  ╚═╝'],
    'I': ['██╗', '██║', '██║', '██║', '██║', '╚═╝'],
    'J': ['     ██╗', '     ██║', '     ██║', '██   ██║', '╚█████╔╝', ' ╚════╝ '],
    'K': ['██╗  ██╗', '██║ ██╔╝', '█████╔╝ ', '██╔═██╗ ', '██║  ██╗', '╚═╝  ╚═╝'],
    'L': ['██╗     ', '██║     ', '██║     ', '██║     ', '███████╗', '╚══════╝'],
    'M': ['███╗   ███╗', '████╗ ████║', '██╔████╔██║', '██║╚██╔╝██║', '██║ ╚═╝ ██║', '╚═╝     ╚═╝'],
    'N': ['███╗   ██╗', '████╗  ██║', '██╔██╗ ██║', '██║╚██╗██║', '██║ ╚████║', '╚═╝  ╚═══╝'],
    'O': ['██████╗ ', '██╔═══██╗', '██║   ██║', '██║   ██║', '╚██████╔╝', ' ╚═════╝ '],
    'P': ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔═══╝ ', '██║     ', '╚═╝     '],
    'Q': ['██████╗ ', '██╔═══██╗', '██║   ██║', '██║▄▄ ██║', '╚██████╔╝', ' ╚══▀▀═╝ '],
    'R': ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔══██╗', '██║  ██║', '╚═╝  ╚═╝'],
    'S': ['███████╗', '██╔════╝', '███████╗', '╚════██║', '███████║', '╚══════╝'],
    'T': ['████████╗', '╚══██╔══╝', '   ██║   ', '   ██║   ', '   ██║   ', '   ╚═╝   '],
    'U': ['██╗   ██╗', '██║   ██║', '██║   ██║', '██║   ██║', '╚██████╔╝', ' ╚═════╝ '],
    'V': ['██╗   ██╗', '██║   ██║', '██║   ██║', '╚██╗ ██╔╝', ' ╚████╔╝ ', '  ╚═══╝  '],
    'W': ['██╗    ██╗', '██║    ██║', '██║ █╗ ██║', '██║███╗██║', '╚███╔███╔╝', ' ╚══╝╚══╝ '],
    'X': ['██╗  ██╗', '╚██╗██╔╝', ' ╚███╔╝ ', ' ██╔██╗ ', '██╔╝ ██╗', '╚═╝  ╚═╝'],
    'Y': ['██╗   ██╗', '╚██╗ ██╔╝', ' ╚████╔╝ ', '  ╚██╔╝  ', '   ██║   ', '   ╚═╝   '],
    'Z': ['███████╗', '╚══███╔╝', '  ███╔╝ ', ' ███╔╝  ', '███████╗', '╚══════╝'],
    ' ': ['   ', '   ', '   ', '   ', '   ', '   '],
  };

  const upperName = panelName.toUpperCase();
  const lines: string[] = ['', '', '', '', '', ''];
  for (const char of upperName) {
    const asciiChar = asciiChars[char] || asciiChars[' '];
    for (let i = 0; i < 6; i++) lines[i] += asciiChar[i] || '   ';
  }
  const asciiArt = lines.join('\n');

  return `-- ULT Key System GUI (Server-Generated)
-- Keys are validated server-side - no keys exposed in client code

local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local TextService = game:GetService("TextService")

local plr = Players.LocalPlayer
local gui = Instance.new("ScreenGui", plr:WaitForChild("PlayerGui"))
gui.ResetOnSpawn = false
gui.DisplayOrder = 999999999

local win = Instance.new("Frame", gui)
win.Size = UDim2.new(0, 680, 0, 290)
win.Position = UDim2.new(0.5, -340, 0.5, -145)
win.BackgroundColor3 = Color3.fromRGB(20,20,20)
win.BackgroundTransparency = 0.25
win.BorderSizePixel = 0
win.ClipsDescendants = true

local outline = Instance.new("UIStroke", win)
outline.Thickness = 2
outline.Color = Color3.fromRGB(${themeColor || '255, 255, 255'})
local glow = Instance.new("UIStroke", win)
glow.Thickness = 6
glow.Transparency = 0.65
glow.Color = Color3.fromRGB(${themeColor || '255, 255, 255'})

local logo = Instance.new("TextLabel", win)
logo.Size = UDim2.new(1,0,0,125)
logo.Position = UDim2.new(0,0,0,10)
logo.BackgroundTransparency = 1
logo.TextColor3 = Color3.fromRGB(${themeColor || '255, 255, 255'})
logo.TextTransparency = 1
logo.Font = Enum.Font.Code
logo.TextSize = 18
logo.Text = [[
${asciiArt}
]]

task.spawn(function()
    task.wait(0.3)
    for i = 1, 30 do
        logo.TextTransparency = math.random(20,80)/100
        task.wait(0.04)
    end
    TweenService:Create(logo, TweenInfo.new(0.3), {TextTransparency = 0}):Play()
end)

local prefix = Instance.new("TextLabel", win)
prefix.Size = UDim2.new(1,-60,0,50)
prefix.Position = UDim2.new(0,30,0,200)
prefix.BackgroundTransparency = 1
prefix.Text = "Enter your key > "
prefix.TextColor3 = Color3.fromRGB(${themeColor || '255, 255, 255'})
prefix.Font = Enum.Font.Code
prefix.TextSize = 28
prefix.TextXAlignment = Enum.TextXAlignment.Left
prefix.TextTransparency = 1

local input = Instance.new("TextBox", win)
input.Size = UDim2.new(1,-60,0,50)
input.Position = UDim2.new(0,30,0,200)
input.BackgroundTransparency = 1
input.Text = ""
input.TextColor3 = Color3.fromRGB(${themeColor || '255, 255, 255'})
input.Font = Enum.Font.Code
input.TextSize = 28
input.TextXAlignment = Enum.TextXAlignment.Left
input.ClearTextOnFocus = false

local prefixWidth = 0
task.spawn(function()
    task.wait()
    prefixWidth = TextService:GetTextSize(prefix.Text, 28, Enum.Font.Code, Vector2.new(10000,10000)).X
    input.Position = UDim2.new(0, 30 + prefixWidth, 0, 200)
    input.Size = UDim2.new(1, -90 - prefixWidth, 0, 50)
end)

local function fadeAndDestroy(msg, color, loadUrl)
    input.TextEditable = false
    input.Text = msg
    input.TextColor3 = color
    TweenService:Create(win, TweenInfo.new(0.9), {BackgroundTransparency = 1}):Play()
    TweenService:Create(prefix, TweenInfo.new(0.9), {TextTransparency = 1}):Play()
    TweenService:Create(input, TweenInfo.new(0.9), {TextTransparency = 1}):Play()
    TweenService:Create(logo, TweenInfo.new(0.9), {TextTransparency = 1}):Play()
    TweenService:Create(outline, TweenInfo.new(0.9), {Transparency = 1}):Play()
    TweenService:Create(glow, TweenInfo.new(0.9), {Transparency = 1}):Play()
    task.wait(1)
    if loadUrl then
        local resp = game:HttpGet(loadUrl)
        if resp and #resp > 0 then
            local fn, err = loadstring(resp)
            if fn then fn() end
        end
    end
    gui:Destroy()
end

input.FocusLost:Connect(function(enter)
    if not enter then return end
    local userId = tostring(plr.UserId)
    local enteredKey = input.Text
    if #enteredKey < 3 then
        fadeAndDestroy("Invalid Key!", Color3.fromRGB(255,0,0), nil)
        return
    end
    
    -- Server-side key validation
    local validateUrl = "${baseUrl}?slug=${slug}&key=" .. game:GetService("HttpService"):UrlEncode(enteredKey) .. "&uid=" .. userId .. "&_=" .. tostring(tick())
    
    local success, response = pcall(function()
        return game:HttpGet(validateUrl)
    end)
    
    if not success then
        fadeAndDestroy("Network Error!", Color3.fromRGB(255,0,0), nil)
        return
    end
    
    -- Check response
    if response:find("KEY_VALID") then
        -- Key accepted - the response after KEY_VALID marker contains the paste URL to load
        local pasteLoadUrl = response:match("KEY_VALID:(.*)")
        fadeAndDestroy("Key Accepted! Loading...", Color3.fromRGB(0,255,0), pasteLoadUrl)
    elseif response:find("KEY_ASSIGNED") then
        fadeAndDestroy("Key Already Owned By Someone Else!", Color3.fromRGB(255,0,0), nil)
    elseif response:find("KEY_EXPIRED") then
        fadeAndDestroy("Key Expired!", Color3.fromRGB(255,0,0), nil)
    elseif response:find("KEY_INVALID") then
        fadeAndDestroy("Wrong Key! Access Denied", Color3.fromRGB(255,0,0), nil)
    else
        fadeAndDestroy("Access Denied!", Color3.fromRGB(255,0,0), nil)
    end
end)

local dragging = false
local dragStart, startPos
local lastClickTime = 0
win.InputBegan:Connect(function(inputObj)
    if inputObj.UserInputType == Enum.UserInputType.MouseButton1 then
        local now = tick()
        if now - lastClickTime < 0.35 then
            fadeAndDestroy("Closed.", Color3.fromRGB(200,200,200), nil)
            return
        end
        lastClickTime = now
        dragging = true
        dragStart = inputObj.Position
        startPos = win.Position
    end
end)
win.InputEnded:Connect(function(i)
    if i.UserInputType == Enum.UserInputType.MouseButton1 then dragging = false end
end)
UserInputService.InputChanged:Connect(function(i)
    if dragging and i.UserInputType == Enum.UserInputType.MouseMovement then
        local d = i.Position - dragStart
        win.Position = UDim2.new(startPos.X.Scale, startPos.X.Offset + d.X, startPos.Y.Scale, startPos.Y.Offset + d.Y)
    end
end)

TweenService:Create(win, TweenInfo.new(0.7), {BackgroundTransparency = 0.25}):Play()
TweenService:Create(prefix, TweenInfo.new(0.7), {TextTransparency = 0}):Play()
TweenService:Create(input, TweenInfo.new(0.7), {TextTransparency = 0}):Play()
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
    const entropy = url.searchParams.get('entropy');
    const snonce = url.searchParams.get('snonce');
    const oauthTs = url.searchParams.get('oauth_ts');

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (Math.random() < 0.01) {
      try { await supabase.rpc('cleanup_expired_tokens'); } catch {}
    }

    const { data: paste, error } = await supabase
      .from('pastes')
      .select('*')
      .eq('slug', slug)
      .single();

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

    // ===== KEY SYSTEM VALIDATION =====
    // When ?key=xxx&uid=xxx is provided, validate the key server-side
    if (keyParam && uid) {
      console.log(`[get-paste] KEY VALIDATION slug=${slug} key=${keyParam.substring(0, 8)}... uid=${uid} ip=${clientIp}`);
      
      // Find control panel for this paste
      const { data: panel } = await supabase
        .from('control_panels')
        .select('id, name')
        .eq('paste_id', paste.id)
        .maybeSingle();
      
      if (!panel) {
        return new Response('KEY_INVALID:No key system on this paste', { status: 200, headers: textHeaders });
      }
      
      // Find the key
      const { data: keyData } = await supabase
        .from('control_panel_keys')
        .select('*')
        .eq('panel_id', panel.id)
        .eq('key_value', keyParam)
        .maybeSingle();
      
      if (!keyData) {
        console.log(`[get-paste] KEY_INVALID: key not found for panel ${panel.id}`);
        return new Response('KEY_INVALID:Wrong key', { status: 200, headers: textHeaders });
      }
      
      // Check expiry
      if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
        console.log(`[get-paste] KEY_EXPIRED: key expired for uid=${uid}`);
        return new Response('KEY_EXPIRED:Key has expired', { status: 200, headers: textHeaders });
      }
      
      // Check user ID assignment
      if (keyData.roblox_user_id) {
        if (keyData.roblox_user_id !== uid) {
          // Key is assigned to a different user
          console.log(`[get-paste] KEY_ASSIGNED: key belongs to ${keyData.roblox_user_id}, not ${uid}`);
          return new Response('KEY_ASSIGNED:Key belongs to another user', { status: 200, headers: textHeaders });
        }
        // Key is assigned to THIS user - allow
      } else {
        // Key is unassigned - assign it to this user
        console.log(`[get-paste] Assigning key to uid=${uid}`);
        await supabase
          .from('control_panel_keys')
          .update({ roblox_user_id: uid, redeemed_at: new Date().toISOString() })
          .eq('id', keyData.id);
        
        // Also add to paste access control whitelist
        await supabase.from('paste_access_control').upsert({
          paste_id: paste.id,
          roblox_user_id: uid,
          access_type: 'whitelist',
          is_eternal: true,
          expires_at: null,
        }, { onConflict: 'paste_id,roblox_user_id' });
      }
      
      // Key is valid! Log execution
      await logAccess(uid, 'key_execution', true);
      await supabase.from('paste_executions').insert({ paste_id: paste.id, roblox_user_id: uid });
      
      // Return KEY_VALID with the paste URL for loading
      // The key GUI will call HttpGet on this URL to load the actual script
      const loadUrl = `${baseUrl}?slug=${slug}&uid=${uid}&_=${Date.now()}`;
      console.log(`[get-paste] KEY_VALID: access granted uid=${uid} for paste ${paste.id}`);
      return new Response(`KEY_VALID:${loadUrl}`, { status: 200, headers: textHeaders });
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

    // Validate non-browser requests for protected pastes
    if ((paste.protection_enabled || paste.public_protection || paste.hide_code) && !isLikelyBrowser) {
      if (!validationResult.valid) {
        console.log(`[get-paste] BLOCKED ${validationResult.reason} for protected paste: ${slug} from ${clientIp}`);
        return new Response(generateHoneypot(), { status: 200, headers: textHeaders });
      }
    }

    // ===== NON-PROTECTED PASTE (no protection, no public_protection) =====
    if (!paste.protection_enabled && !paste.public_protection) {
      // Check if paste has a key system linked
      const { data: keyPanel } = await supabase
        .from('control_panels')
        .select('id, name')
        .eq('paste_id', paste.id)
        .maybeSingle();
      
      if (keyPanel && !uid && !tk && !isLikelyBrowser) {
        // Paste has a key system - return key system GUI
        console.log(`[get-paste] Returning key system GUI for paste: ${paste.id} panel: ${keyPanel.name}`);
        const gui = generateKeySystemGui(slugStr, baseUrl, keyPanel.name, '255, 255, 255');
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
      if (isLikelyBrowser && !isRobloxRequest) {
        await logAccess(null, 'browser');
        return new Response('', { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
      }

      // Check if paste has a key system - show key GUI instead of loader
      const { data: keyPanel } = await supabase
        .from('control_panels')
        .select('id, name')
        .eq('paste_id', paste.id)
        .maybeSingle();
      
      if (keyPanel) {
        console.log(`[get-paste] Returning key system GUI for protected paste: ${paste.id} panel: ${keyPanel.name}`);
        const gui = generateKeySystemGui(slugStr, baseUrl, keyPanel.name, '255, 255, 255');
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
      console.log(`Generated secure loader v9 for paste: ${paste.id} from IP: ${clientIp}`);
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
      
      // v9: Use runtime-bound key with entropy
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

    // v9: Runtime-bound encryption key
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
