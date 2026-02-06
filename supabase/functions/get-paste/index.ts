import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced rate limiting with IP tracking
const rateLimits = new Map<string, { count: number; resetTime: number; blocked: boolean }>();
const suspiciousIps = new Map<string, { strikes: number; lastStrike: number }>();

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
  const data = `${ip}:${timestamp}:ULT_SESSION_v3`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
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

// Enhanced loader with obfuscated token and fingerprinting
function generateLoader(slug: string, baseUrl: string, token: string, sessionSecret: string): string {
  // Split token into parts and embed with obfuscation
  const tokenParts = [];
  for (let i = 0; i < token.length; i += 8) {
    tokenParts.push(token.slice(i, i + 8));
  }
  
  const obfuscatedParts = tokenParts.map((part, i) => {
    // XOR each char with position for obfuscation
    return Array.from(part).map((c, j) => {
      const code = c.charCodeAt(0) ^ ((i + j) % 16);
      return code.toString(16).padStart(2, '0');
    }).join('');
  });

  return `--[[ULT LUA PROTECTION v3 - Enhanced Security]]
local player = game:GetService("Players").LocalPlayer
if not player then
  player = game:GetService("Players").PlayerAdded:Wait()
end

-- Anti-extraction: Detect if running outside Roblox
local function _vE()
  local s,r = pcall(function()
    return game:GetService("HttpService") and game:GetService("Players")
  end)
  return s and r
end

if not _vE() then return end

-- Fingerprint collection for validation
local function _gF()
  local p = {}
  p.u = tostring(player.UserId)
  p.n = player.Name
  p.t = tostring(os.time())
  p.g = tostring(game.GameId or 0)
  p.p = tostring(game.PlaceId or 0)
  return p
end

-- Obfuscated token reconstruction
local _tp = {${obfuscatedParts.map(p => `"${p}"`).join(',')}}
local function _rT()
  local r = ""
  for i,p in ipairs(_tp) do
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

local _ss = "${sessionSecret}"
local fp = _gF()
local tk = _rT()

local url = "${baseUrl}?slug=${slug}&uid=" .. fp.u .. "&ts=" .. fp.t .. "&tk=" .. tk .. "&ss=" .. _ss .. "&gid=" .. fp.g .. "&pid=" .. fp.p

local function hb(h)
  local o = table.create(math.floor(#h / 2))
  local j = 1
  for i = 1, #h, 2 do
    o[j] = tonumber(h:sub(i, i + 1), 16) or 0
    j += 1
  end
  return o
end

local function xb(b, k)
  local o = table.create(#b)
  local kl = #k
  for i = 1, #b do
    o[i] = bit32.bxor(b[i], k[((i - 1) % kl) + 1])
  end
  return o
end

local function bs(b)
  local c = table.create(#b)
  for i = 1, #b do
    c[i] = string.char(b[i])
  end
  return table.concat(c)
end

local ks = "${slug}:" .. tk .. ":ULTv3:" .. fp.u
local kb = {}
for i = 1, #ks do
  kb[i] = string.byte(ks, i)
end

local s, r = pcall(function()
  return game:HttpGet(url)
end)

if s and r then
  if r:sub(1,2) == "--" then
    warn("Protection error")
    return
  end
  local d = bs(xb(hb(r), kb))
  local f, e = loadstring(d)
  if f then
    f()
  else
    warn("E:" .. tostring(e))
  end
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

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';
    
    const userAgent = req.headers.get('user-agent') || '';
    
    // Detect non-Roblox requests with auth params (bypass attempt)
    const isRobloxRequest = userAgent.toLowerCase().includes('roblox') || 
                            userAgent.includes('HttpService');
    
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

    // Log access for monitoring (both browser and executor)
    // NOTE: guarded by per-paste toggle + de-duped to avoid flooding.
    // Also fetches linked Discord info from key redemptions.
    const logAccess = async (robloxUserId: string | null, accessType: string) => {
      try {
        if (paste.ip_tracking_enabled === false) return;

        // Try to find Discord info from existing key redemptions if we have a Roblox user ID
        let discordInfo: { 
          discord_user_id: string | null; 
          discord_username: string | null; 
          discord_avatar: string | null; 
          discord_created_at: string | null;
        } = { 
          discord_user_id: null, 
          discord_username: null, 
          discord_avatar: null, 
          discord_created_at: null 
        };

        if (robloxUserId) {
          // Look up Discord info from control_panel_keys where this Roblox user redeemed a key
          const { data: keyData } = await supabase
            .from('control_panel_keys')
            .select('redeemed_by_discord_id')
            .eq('roblox_user_id', robloxUserId)
            .not('redeemed_by_discord_id', 'is', null)
            .limit(1)
            .maybeSingle();

          if (keyData?.redeemed_by_discord_id) {
            discordInfo.discord_user_id = keyData.redeemed_by_discord_id;

            // Fetch Discord user info from Discord API
            const discordBotToken = Deno.env.get('DISCORD_BOT_TOKEN');
            if (discordBotToken) {
              try {
                const discordRes = await fetch(
                  `https://discord.com/api/v10/users/${keyData.redeemed_by_discord_id}`,
                  { headers: { Authorization: `Bot ${discordBotToken}` } }
                );
                if (discordRes.ok) {
                  const discordUser = await discordRes.json();
                  discordInfo.discord_username = discordUser.username;
                  discordInfo.discord_avatar = discordUser.avatar;
                  // Calculate account creation date from Discord snowflake ID
                  const snowflake = BigInt(keyData.redeemed_by_discord_id);
                  const timestamp = Number((snowflake >> 22n) + 1420070400000n);
                  discordInfo.discord_created_at = new Date(timestamp).toISOString();
                }
              } catch (discordErr) {
                console.error('Failed to fetch Discord user:', discordErr);
              }
            }
          }
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
        if (existingLog?.id) {
          await supabase
            .from('paste_access_logs')
            .update({
              last_seen_at: nowIso,
              is_active: true,
              user_agent: userAgent,
              ...discordInfo,
            })
            .eq('id', existingLog.id);
        } else {
          await supabase
            .from('paste_access_logs')
            .insert({
              paste_id: paste.id,
              ip_address: clientIp,
              roblox_user_id: robloxUserId,
              user_agent: userAgent,
              access_type: accessType,
              is_active: true,
              last_seen_at: nowIso,
              ...discordInfo,
            });
        }
      } catch (logError) {
        console.error('Failed to log access:', logError);
      }
    };

    // If hide_code is enabled and this is a browser request without auth params, return empty
    if (paste.hide_code && !uid && !tk) {
      // Check if this looks like a browser request (not Roblox)
      if (!isRobloxRequest) {
        // Log browser access attempt
        await logAccess(null, 'browser');
        // Return empty response - code is hidden from browsers
        return new Response('', {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
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
        await logAccess(uid, 'execution');
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
      // Only log browser hits here. Executor requests should log once we have a real Roblox user id.
      if (!isRobloxRequest) {
        await logAccess(null, 'browser');
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
      const baseUrl = supabaseUrl + '/functions/v1/get-paste';
      const loader = generateLoader(slug, baseUrl, newToken, sessionSecret);
      
      console.log(`Generated secure loader for paste: ${paste.id} from IP: ${clientIp}`);
      
      return new Response(loader, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
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
      return new Response(generateKickEncrypted('Request expired', slug, tk, uid), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
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
      return new Response(generateKickEncrypted('Invalid token', slug, tk, uid), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Check if token already used
    if (tokenData.used_at) {
      console.log(`Token reuse attempt: ${tk} from IP: ${clientIp}`);
      // Add strike for token reuse attempt
      const strikes = (suspiciousIps.get(clientIp)?.strikes || 0) + 1;
      suspiciousIps.set(clientIp, { strikes, lastStrike: Date.now() });
      return new Response(generateKickEncrypted('Token already used', slug, tk, uid), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Check if token expired
    if (new Date(tokenData.expires_at) < new Date()) {
      console.log(`Token expired: ${tk}`);
      return new Response(generateKickEncrypted('Token expired', slug, tk, uid), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Mark token as used IMMEDIATELY (before any other checks)
    const { error: updateError } = await supabase
      .from('paste_execution_tokens')
      .update({ used_at: new Date().toISOString(), roblox_user_id: uid })
      .eq('id', tokenData.id)
      .is('used_at', null);

    if (updateError) {
      console.log(`Failed to mark token as used: ${updateError.message}`);
      return new Response(generateKickEncrypted('Token error', slug, tk, uid), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
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

      const nowTime = Date.now();
      const isBlacklisted = blacklistEntry && (
        blacklistEntry.is_eternal || 
        !blacklistEntry.expires_at || 
        new Date(blacklistEntry.expires_at).getTime() > nowTime
      );

      if (isBlacklisted) {
        console.log(`Blacklisted user (public protection): ${uid}`);
        return new Response(generateKickEncrypted('You are blacklisted', slug, tk, uid), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }

      // Log execution and access
      await logAccess(uid, 'execution');
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

    const nowTime = Date.now();

    // Check for blacklist first - using proper Date comparisons
    const isBlacklisted = accessList?.some(entry => {
      if (entry.access_type !== 'blacklist') return false;
      if (entry.is_eternal) return true;
      if (!entry.expires_at) return true;
      // Proper date comparison using timestamps
      return new Date(entry.expires_at).getTime() > nowTime;
    });

    if (isBlacklisted) {
      console.log(`Blacklisted user: ${uid}`);
      return new Response(generateKickEncrypted('You are blacklisted', slug, tk, uid), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Check for whitelist
    const whitelistEntry = accessList?.find(entry => entry.access_type === 'whitelist');
    
    if (!whitelistEntry) {
      console.log(`Not whitelisted: ${uid}`);
      return new Response(generateKickEncrypted('Not whitelisted', slug, tk, uid), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Check if whitelist entry is valid - using proper Date comparisons
    const isValidWhitelist = whitelistEntry.is_eternal || 
      !whitelistEntry.expires_at || 
      new Date(whitelistEntry.expires_at).getTime() > nowTime;

    if (!isValidWhitelist) {
      console.log(`Whitelist time expired: ${uid}, expires_at: ${whitelistEntry.expires_at}`);
      return new Response(generateKickEncrypted('Your whitelist time has expired', slug, tk, uid), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Log execution and access
    await logAccess(uid, 'execution');
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