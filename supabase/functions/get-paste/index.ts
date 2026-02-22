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

// ===== ANTI-FETCH PROTECTION =====
const BLOCKED_USER_AGENTS = [
  'discordbot', 'discord.js', 'discord-http', 'discord', 'eris', 'oceanic',
  'axios', 'node-fetch', 'got', 'undici', 'needle', 'superagent',
  'httpie', 'curl', 'wget', 'python-requests', 'python-urllib', 'aiohttp',
  'httpx', 'libcurl', 'php', 'perl', 'ruby', 'java/', 'apache-httpclient',
  'okhttp', 'retrofit', 'unirest', 'restsharp', 'flurl',
  // NOTE: executor names (synapse, krnl, etc.) intentionally NOT blocked —
  // they are legitimate Roblox executors. Only block automation/scraping tools.
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
  const acceptLanguage = headers.get('accept-language');
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

function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

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

function generateChallenge(): { challenge: string; answer: string } {
  const a = Math.floor(Math.random() * 1000);
  const b = Math.floor(Math.random() * 1000);
  const operation = Math.random() > 0.5 ? 'add' : 'xor';
  let answer: number;
  if (operation === 'add') answer = a + b;
  else answer = a ^ b;
  return { challenge: `${operation}:${a}:${b}`, answer: answer.toString() };
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

// ===== PROTECTION v8.0 =====
// Anti-hookfunction, anti-environment logger, anti-decompiler, anti-replay
// v8.0: Defends against hookfunction(loadstring) bypass by using clonefunction,
// canary traps, writefile detection, and chunked execution
function generateLoader(slug: string, baseUrl: string, token: string, sessionSecret: string, options?: { showConsoleFeedback?: boolean }): string {
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
  
  // Generate random variable names
  const v = Object.fromEntries(
    ['player','nonce','fingerprint','tokenParts','reconstruct','isHex','session',
     'hexBytes','xorBytes','bytesToString','envCheck','cachedLS','cachedHG',
     'antiLogger','antiDump','antiDebug','antiGC','safeExec','memWipe',
     'integrityCheck','nativeCheck','shieldEnv','decPayload','execFunc',
     'antiHook','antiEnvLog','hookGuard','lsIntegrity','writeSink','execSandbox',
     'junk1','junk2','junk3','junk4','junk5','junk6','junk7','junk8',
     'cleanLS','canaryFile','canaryTest','writeDetect','clonedLS',
     'splitExec','chunkCompile','antiWritefile','dumpTrap'
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
  
  // Generate a unique integrity signature for this loader instance
  const integrityKey = Math.random().toString(36).substring(2, 18);
  
  // Generate unique canary strings per-request
  const canaryId = Math.random().toString(36).substring(2, 12);
  const canaryFileName = `_ult_canary_${Math.random().toString(36).substring(2, 8)}.lua`;
  
  return `--[[ULT Protection v8.0 - ${Math.random().toString(36).substring(2,10)}]]
${junkCode}

-- ====== PHASE 0: OBTAIN CLEAN LOADSTRING ======
-- hookfunction(loadstring, ...) replaces loadstring BEFORE this runs.
-- So "local cached = loadstring" captures the HOOKED version.
-- Defense: use clonefunction() to get the ORIGINAL native implementation.
-- clonefunction returns the original C closure, bypassing any Lua hook.

local ${v.cleanLS}
local ${v.clonedLS} = false

-- Method 1: clonefunction (available in most modern executors)
-- This is THE primary defense - it returns the original native function
-- even after hookfunction has replaced the global reference
do
  local ok, cf = pcall(function()
    if clonefunction then
      return clonefunction(loadstring)
    end
    return nil
  end)
  if ok and cf then
    ${v.cleanLS} = cf
    ${v.clonedLS} = true
  end
end

-- Method 2: getoriginalfunction (Synapse-style executors)
if not ${v.cleanLS} then
  local ok, gof = pcall(function()
    if getoriginalfunction then
      return getoriginalfunction(loadstring)
    end
    return nil
  end)
  if ok and gof then
    ${v.cleanLS} = gof
    ${v.clonedLS} = true
  end
end

-- Method 3: cloneref (some executors)  
if not ${v.cleanLS} then
  local ok, cr = pcall(function()
    if cloneref then
      return cloneref(loadstring)
    end
    return nil
  end)
  if ok and cr then
    ${v.cleanLS} = cr
    ${v.clonedLS} = true
  end
end

-- Method 4: Check getrenv for original loadstring
if not ${v.cleanLS} then
  local ok, rls = pcall(function()
    if getrenv then
      local renv = getrenv()
      if renv and renv.loadstring then
        return renv.loadstring
      end
    end
    return nil
  end)
  if ok and rls then
    ${v.cleanLS} = rls
    ${v.clonedLS} = true
  end
end

-- Fallback: use current loadstring (may be hooked - canary will catch it)
if not ${v.cleanLS} then
  ${v.cleanLS} = loadstring
end

local ${v.cachedLS} = ${v.cleanLS}
local ${v.cachedHG} = game.HttpGet
local ${v.writeSink} = false

-- Snapshot references
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

-- ====== PHASE 0.5: CANARY TRAP ======
-- The bypass hook calls writefile() whenever loadstring is called.
-- We call loadstring with a unique canary and then check if a file was created.
-- If the file exists, loadstring is hooked with a writefile dumper.
local ${v.canaryTest} = function()
  -- Generate a unique canary string that only this loader instance knows
  local canaryCode = "local ${canaryId} = " .. tostring(math.random(100000,999999))
  
  -- Call the GLOBAL loadstring (not our clean one) to trigger any hook
  local ok = pcall(function()
    local fn = loadstring(canaryCode)
    if fn then pcall(fn) end
  end)
  
  -- Now check if writefile was triggered by the hook
  -- The bypass script uses: writefile("script.lua", src)
  -- Check common dump filenames
  local dumpFiles = {"script.lua", "dump.lua", "dumped.lua", "output.lua", "saved.lua", "source.lua"}
  
  for _, fname in ipairs(dumpFiles) do
    local hasFile = false
    pcall(function()
      if isfile and isfile(fname) then
        -- Read it to check if it contains our canary
        local content = ""
        pcall(function()
          if readfile then content = readfile(fname) end
        end)
        if content:find("${canaryId}") then
          hasFile = true
          -- Clean up the canary file
          pcall(function() if delfile then delfile(fname) end end)
        end
      end
    end)
    if hasFile then return false end
  end
  
  -- Also check workspace folder files
  pcall(function()
    if listfiles then
      local files = listfiles("") or {}
      for _, f in ipairs(files) do
        if f:find("%.lua$") then
          local content = ""
          pcall(function() if readfile then content = readfile(f) end end)
          if content:find("${canaryId}") then
            -- Canary was dumped - hook detected!
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
-- Detect if writefile/appendfile are being used for script dumping
local ${v.antiWritefile} = function()
  -- Check if hookfunction itself exists and has been used on loadstring
  local hookExists = false
  pcall(function()
    if hookfunction or detour_function or replace_closure then
      hookExists = true
    end
  end)
  
  if hookExists then
    -- If hookfunction exists, verify loadstring hasn't been hooked by comparing
    -- the clean clone (if we got one) against the global
    if ${v.clonedLS} then
      -- We have a clean clone - compare behavior
      local testStr = "return " .. tostring(math.random(1000000, 9999999))
      local globalResult, cloneResult
      
      -- Execute via global loadstring
      pcall(function()
        local fn = loadstring(testStr)
        if fn then globalResult = fn() end
      end)
      
      -- Execute via clean clone
      pcall(function()
        local fn = ${v.cleanLS}(testStr)
        if fn then cloneResult = fn() end
      end)
      
      -- Both should produce identical results
      if globalResult ~= cloneResult then
        return false
      end
    end
  end
  
  -- (GC scan removed - it corrupts Roblox PlayerModule by touching internal functions)
  
  if ${v.writeSink} then return false end
  return true
end

-- ====== PHASE 1: ANTI-HOOKFUNCTION DEFENSE (Enhanced v8.0) ======
local ${v.antiHook} = function()
  -- Check 1: Run canary trap to detect writefile-based hooks
  if not ${v.canaryTest}() then
    return false
  end
  
  -- Check 2: Run writefile monitor
  if not ${v.antiWritefile}() then
    return false
  end
  
  -- Check 3: If we got a clean clone, the global loadstring being different is OK
  -- But if we DIDN'T get a clean clone, check for obvious signs
  if not ${v.clonedLS} then
    -- No clone available - extra paranoid checks
    -- Check if __original_loadstring exists (common hookfunction pattern)
    if ${v.hookGuard}.rawget_ref(_G, "__original_loadstring") ~= nil then
      return false
    end
    if ${v.hookGuard}.rawget_ref(_G, "__old_loadstring") ~= nil then
      return false
    end
    if ${v.hookGuard}.rawget_ref(_G, "old") ~= nil then
      -- The bypass literally uses: old = hookfunction(loadstring, ...)
      -- Check if _G.old is a function that looks like loadstring
      local oldVal = ${v.hookGuard}.rawget_ref(_G, "old")
      if ${v.hookGuard}.type_ref(oldVal) == "function" then
        -- Test if it behaves like loadstring
        local testOk, testFn = pcall(oldVal, "return 42")
        if testOk and ${v.hookGuard}.type_ref(testFn) == "function" then
          local testOk2, testResult = pcall(testFn)
          if testOk2 and testResult == 42 then
            -- _G.old is the original loadstring - hook detected!
            return false
          end
        end
      end
    end
  end
  
  -- Check 4: Detect if writefile is being called suspiciously
  if ${v.hookGuard}.rawget_ref(_G, "script_dump_active") then return false end
  if ${v.hookGuard}.rawget_ref(_G, "ls_interceptor") then return false end
  if ${v.hookGuard}.rawget_ref(shared, "script_dump_active") then return false end
  if ${v.hookGuard}.rawget_ref(shared, "ls_interceptor") then return false end
  
  -- Check 5: Check for the bypass's specific variables in _G
  -- The bypass sets: local file = "script.lua" (as local, not global, so this is supplementary)
  -- But also: printDetected, lastHookTime, hasShownMessage may leak
  if ${v.hookGuard}.rawget_ref(_G, "printDetected") ~= nil then return false end
  if ${v.hookGuard}.rawget_ref(_G, "lastHookTime") ~= nil then return false end
  if ${v.hookGuard}.rawget_ref(_G, "hasShownMessage") ~= nil then return false end
  
  -- Check 6: Detect hooked print function (bypass-specific pattern only)
  -- The bypass stores both a boolean AND the original print as upvalues
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
        -- Only flag if BOTH a boolean tracker AND original function are present
        -- (the specific bypass pattern: printDetected + oldPrint)
        if hasBool and hasFunc then
          ${v.writeSink} = true
        end
      end
    end
  end)
  if ${v.writeSink} then return false end
  
  -- Check 7: (Safe) Check for known hook patterns in globals only
  -- DO NOT scan GC and execute random functions - it corrupts Roblox PlayerModule
  if ${v.hookGuard}.rawget_ref(_G, "old_loadstring") ~= nil then return false end
  if ${v.hookGuard}.rawget_ref(_G, "orig_loadstring") ~= nil then return false end
  if ${v.hookGuard}.rawget_ref(_G, "real_loadstring") ~= nil then return false end
  if ${v.hookGuard}.rawget_ref(_G, "backup_loadstring") ~= nil then return false end
  
  return true
end

-- ====== PHASE 2: ANTI-ENVIRONMENT LOGGER DEFENSE ======
-- Detects environment loggers that record/intercept execution data
-- These tools: hook globals, monitor getfenv/setfenv, track all function calls
local ${v.antiEnvLog} = function()
  -- Check 1: Detect known environment logger globals
  local envLoggerSignals = {
    -- Known logger tool globals
    "OLSSA", "olssa", "runtime_log", "static_log", 
    "loadstring_logger", "script_dump", "dumpfunc",
    "logfile", "hooklog", "ls_hook", "string_dump_log",
    "env_logger", "environment_logger", "exec_logger",
    "threaded", "unveilr", "UnveilR",
    -- Hook tracking globals
    "hook_registry", "hooked_functions", "intercept_log",
    "function_hooks", "call_log", "exec_trace",
    -- Dump tool globals  
    "dump_output", "script_output", "captured_scripts",
    "logged_calls", "traced_funcs", "monitored_env",
    -- Deobfuscation tool signals
    "deobf_active", "deobfuscator", "beautifier",
    "ast_dump", "bytecode_dump", "opcode_log",
  }
  
  for _, sig in ipairs(envLoggerSignals) do
    if ${v.hookGuard}.rawget_ref(_G, sig) ~= nil then return false end
    if ${v.hookGuard}.rawget_ref(shared, sig) ~= nil then return false end
  end
  
  -- Check 2: Detect if getfenv/setfenv have been hooked
  -- Environment loggers often hook these to monitor environment access
  if ${v.hookGuard}.type_ref(getfenv) ~= "function" then return false end
  if ${v.hookGuard}.type_ref(setfenv) ~= "function" then return false end
  
  -- Check 3: Detect metatables on _G that intercept reads/writes
  -- Env loggers add __index/__newindex to _G to track all global access
  local gMt = getmetatable(_G)
  if gMt then
    -- _G should NOT have a metatable in normal Roblox execution
    -- If it does, something is intercepting global access
    if ${v.hookGuard}.rawget_ref(gMt, "__index") or ${v.hookGuard}.rawget_ref(gMt, "__newindex") then
      return false
    end
    if ${v.hookGuard}.rawget_ref(gMt, "__call") then return false end
  end
  
  -- Check 4: Detect metatables on shared
  local sMt = getmetatable(shared)
  if sMt then
    if ${v.hookGuard}.rawget_ref(sMt, "__index") or ${v.hookGuard}.rawget_ref(sMt, "__newindex") then
      return false
    end
  end
  
  -- Check 5: Check debug library for monitoring hooks
  if ${v.hookGuard}.type_ref(${v.hookGuard}.rawget_ref(_G, "debug")) == "table" then
    local dbg = ${v.hookGuard}.rawget_ref(_G, "debug")
    -- Check for active hook
    if ${v.hookGuard}.rawget_ref(dbg, "sethook") then
      local ok, hookFn, mask, count = ${v.hookGuard}.pcall_ref(debug.gethook)
      if ok and hookFn then
        -- An active debug hook is running - likely a logger
        return false
      end
    end
    -- Check for suspicious debug extensions
    if ${v.hookGuard}.rawget_ref(dbg, "setmetatable_hook") then return false end
    if ${v.hookGuard}.rawget_ref(dbg, "hook_active") then return false end
    if ${v.hookGuard}.rawget_ref(dbg, "trace_calls") then return false end
  end
  
  -- Check 6: Detect if require has been hooked (Lune-based loggers use this)
  -- The uploaded bypass uses require"@lune/net" etc.
  if ${v.hookGuard}.rawget_ref(_G, "require") ~= nil then
    local req = ${v.hookGuard}.rawget_ref(_G, "require")
    -- In normal Roblox, require exists but shouldn't have been replaced
    -- Check if it's wrapped
    if ${v.hookGuard}.type_ref(req) == "table" then return false end
  end
  
  -- (GC scan removed - iterating GC and calling debug.info corrupts Roblox internals)
  
  -- Check 8: Verify our execution environment is clean
  -- Check if someone injected monitoring into our closure
  local envKeys = {}
  local env = getfenv(1)
  if env ~= _G and env ~= nil then
    for k, _ in pairs(env) do
      envKeys[#envKeys+1] = k
    end
    -- Our env should be minimal, not polluted with logger vars
    if #envKeys > 50 then return false end
  end
  
  return true
end

-- ====== PHASE 3: ANTI-LOADSTRING INTERCEPT (Original + Enhanced) ======
local ${v.antiLogger} = function()
  -- Only compare global loadstring if we did NOT get a clean clone
  -- When clonefunction works, the clone is intentionally different from the global
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
  if ${v.hookGuard}.rawget_ref(string, "dump") ~= nil then
    local ok, r = ${v.hookGuard}.pcall_ref(string.dump, print)
    if ok and ${v.hookGuard}.type_ref(r) == "string" and #r > 1000 then
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
  -- (GC scan removed - corrupts Roblox PlayerModule)
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

-- Anti-GC Scan
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

-- ====== PHASE 4: SANDBOXED EXECUTION (v8.0 Enhanced) ======
-- Execute the final payload using CLEAN loadstring in a locked, monitored sandbox
-- Key change: Uses clonefunction'd loadstring, not the potentially-hooked global
local ${v.execSandbox} = function(code)
  -- Pre-execution: Final integrity verification
  if not ${v.antiHook}() then return nil, "hook_detected" end
  if not ${v.antiEnvLog}() then return nil, "env_logger_detected" end
  if not ${v.antiLogger}() then return nil, "logger_detected" end
  
  -- Use the CLEAN loadstring (clonefunction'd), never the global
  local fn, err = ${v.cleanLS}(code)
  if not fn then return nil, err end
  
  -- DO NOT use setfenv - it corrupts Roblox's core PlayerModule
  -- (CameraModule, ControlModule) causing black sky and input errors.
  -- Security is enforced by the checks above, not by environment sandboxing.
  
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

-- ====== RUN ALL PROTECTION CHECKS ======
-- Phase order is randomized per-request to defeat pattern matching
${protectionSeed > 0.66 ? `
if not ${v.antiHook}() then warn("[ULT] Security check failed") return end
if not ${v.antiEnvLog}() then warn("[ULT] Environment check failed") return end
if not ${v.antiLogger}() then warn("[ULT] Integrity check failed") return end
if not ${v.antiDump}() then warn("[ULT] Protection check failed") return end
if not ${v.antiDebug}() then warn("[ULT] Debug check failed") return end
` : protectionSeed > 0.33 ? `
if not ${v.antiEnvLog}() then warn("[ULT] Environment check failed") return end
if not ${v.antiDump}() then warn("[ULT] Protection check failed") return end
if not ${v.antiHook}() then warn("[ULT] Security check failed") return end
if not ${v.antiDebug}() then warn("[ULT] Debug check failed") return end
if not ${v.antiLogger}() then warn("[ULT] Integrity check failed") return end
` : `
if not ${v.antiDump}() then warn("[ULT] Protection check failed") return end
if not ${v.antiDebug}() then warn("[ULT] Debug check failed") return end
if not ${v.antiLogger}() then warn("[ULT] Integrity check failed") return end
if not ${v.antiHook}() then warn("[ULT] Security check failed") return end
if not ${v.antiEnvLog}() then warn("[ULT] Environment check failed") return end
`}

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

-- Re-verify protections before network request
if not ${v.antiHook}() then warn("[ULT] Pre-fetch security failed") return end
if not ${v.antiEnvLog}() then warn("[ULT] Pre-fetch environment failed") return end

${options?.showConsoleFeedback ? `
-- Console Feedback: milestone-only loading bar (no spam)
local function ${v.junk5}(msg, pct)
  local barLen = 20
  local filled = math.floor(barLen * pct / 100)
  local empty = barLen - filled
  print("[ULT PROTECTION] [" .. string.rep("#", filled) .. string.rep("-", empty) .. "] " .. pct .. "% - " .. msg)
end

${v.junk5}("Scanning environment...", 0)
task.wait(0.1)

local ${v.junk7} = ${v.antiLogger}() and ${v.antiHook}() and ${v.antiEnvLog}()
if not ${v.junk7} then
  print("[ULT PROTECTION] Threat detected - aborting.")
  return
end
${v.junk5}("Security scan clean.", 25)
task.wait(0.1)

local ${v.junk8} = ${v.antiDump}()
if not ${v.junk8} then
  print("[ULT PROTECTION] Integrity check failed - aborting.")
  return
end
${v.junk5}("Integrity verified.", 50)
task.wait(0.1)

${v.junk5}("Connecting to server...", 75)
` : ''}

-- Execute request using CACHED HttpGet (anti-hook)
local s, r = ${v.hookGuard}.pcall_ref(function()
  return ${v.cachedHG}(game, url)
end)

-- Fallback
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
  -- Verify loadstring STILL hasn't been hooked between fetch and execution
  -- The bypass hooks loadstring BEFORE fetching, so this catches it
  if not ${v.antiHook}() then
    warn("[ULT] Post-fetch security check failed")
    r = nil
    return
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
    
    -- ====== FINAL COMPREHENSIVE SECURITY CHECK ======
    if not ${v.antiHook}() or not ${v.antiEnvLog}() or not ${v.antiLogger}() or not ${v.antiDump}() then
      ${v.decPayload} = nil
      r = nil
      return
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
      print("[ULT PROTECTION] Protected by ULT Protection v8.0")
    end)
` : ''}
    -- Use sandboxed execution (anti-hook + anti-env-logger)
    local ${v.execFunc}, execErr = ${v.execSandbox}(${v.decPayload})
    
    -- Wipe decrypted payload from memory immediately
    ${v.decPayload} = nil
    r = nil
    
    if ${v.execFunc} then
      ${v.execFunc}()
      ${v.execFunc} = nil
    else
      if execErr == "hook_detected" or execErr == "env_logger_detected" or execErr == "logger_detected" then
        -- Silently abort - don't reveal detection to attacker
        return
      end
      warn("E:" .. tostring(execErr))
    end
    return
  end

  -- Plain Lua response
  local pf, pe = ${v.cachedLS}(r)
  if pf then return pf() end
  warn("E:" .. tostring(pe))
else
  warn("Network error")
end
`;
}

function generateKickPlain(reason: string): string {
  return `game:GetService("Players").LocalPlayer:Kick("${reason}")`;
}

function generateKickEncrypted(reason: string, slug: string, token: string, uid: string): string {
  const kickScript = `game:GetService("Players").LocalPlayer:Kick("${reason}")`;
  const key = `${slug}:${token}:ULTv3:${uid}`;
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
    
  // === BYPASS PATCH: Block spoofed Roblox-Id (e.g. curl -H "Roblox-Id: 1") ===
  const robloxIdHeader = req.headers.get('roblox-id') || req.headers.get('Roblox-Id') || '';
  if (robloxIdHeader) {
    const robloxIdNum = parseInt(robloxIdHeader, 10);
    // Real Roblox user IDs are all > 1000. Block fake/spoofed IDs.
    if (isNaN(robloxIdNum) || robloxIdNum < 1000) {
      console.log(`[get-paste] BLOCKED: spoofed Roblox-Id="${robloxIdHeader}" from ${clientIp}`);
      return new Response(generateHoneypot(), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }
  }

  // Also block raw curl even when combined with a Roblox UA header
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
      await supabase.from('paste_execution_tokens').insert({
        paste_id: paste.id,
        roblox_user_id: '0',
        token: newToken,
        expires_at: new Date(Date.now() + 30000).toISOString()
      });
      const loader = generateLoader(slugStr, baseUrl, newToken, sessionSecret, {
        showConsoleFeedback: paste.show_loading_bar !== false,
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

    if ((paste.protection_enabled || paste.public_protection || paste.hide_code) && !isLikelyBrowser) {
      if (!validationResult.valid) {
        console.log(`[get-paste] BLOCKED ${validationResult.reason} for protected paste: ${slug} from ${clientIp}`);
        return new Response(generateHoneypot(), { status: 200, headers: textHeaders });
      }
    }

    if (!paste.protection_enabled && !paste.public_protection) {
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

    if (!uid || !ts || !tk) {
      if (isLikelyBrowser && !isRobloxRequest) {
        await logAccess(null, 'browser');
        return new Response('', { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
      }

      // NOTE: The initial loadstring(game:HttpGet(url))() request naturally lacks gid/pid.
      // Those params are added by the LOADER in the second request. So we cannot block
      // the initial request for missing game context — that would break ALL protected pastes.
      // The setclipboard bypass is already mitigated because:
      // 1. The loader has token-based auth (30s expiry)
      // 2. The actual content is XOR-encrypted with the token
      // 3. Anti-hook protections prevent dumping

      // Also block if uid is provided but extremely low (spoofed like Roblox-Id: 1)
      if (uid && /^\d+$/.test(uid) && parseInt(uid) < 1000 && parseInt(uid) !== 0) {
        console.log(`[get-paste] BLOCKED: spoofed uid=${uid} slug=${slug} ip=${clientIp}`);
        return new Response(generateHoneypot(), { status: 200, headers: textHeaders });
      }

      const newToken = generateToken();
      const sessionSecret = generateSessionSecret(clientIp, Date.now());
      await supabase.from('paste_execution_tokens').insert({
        paste_id: paste.id, roblox_user_id: '0', token: newToken,
        expires_at: new Date(Date.now() + 30000).toISOString()
      });
      const loader = generateLoader(slugStr, baseUrl, newToken, sessionSecret, {
        showConsoleFeedback: paste.show_loading_bar !== false,
      });
      console.log(`Generated secure loader for paste: ${paste.id} from IP: ${clientIp}`);
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
      const key = `${slug}:${tk}:ULTv3:${uid}`;
      return new Response(xorToHex(paste.content, key), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
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

    const key = `${slug}:${tk}:ULTv3:${uid}`;
    return new Response(xorToHex(paste.content, key), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response('Internal error', { status: 500, headers: corsHeaders });
  }
});
