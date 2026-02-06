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

  // Use per-execution unique nonce to defeat all caching
  const executionNonce = generateToken().slice(0, 16);
  
  return `--[[ULT LUA PROTECTION v4 - Anti-Cache]]
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

-- Generate unique nonce for THIS execution
local function _n()
  local hs = game:GetService("HttpService")
  local ok, guid = pcall(function()
    return hs:GenerateGUID(false)
  end)
  if ok and guid then return guid end
  return tostring(math.floor((os.clock() * 1000000) % 1000000000)) .. tostring(math.random(1, 1000000000))
end

local function _gF()
  local p = {}
  p.u = tostring(player.UserId)
  p.n = player.Name
  p.t = tostring(os.time())
  -- Double nonce: server-generated + client-generated to defeat all caching
  p.r = "${executionNonce}" .. _n()
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

local function _isHex(str)
  if type(str) ~= "string" then return false end
  if (#str % 2) ~= 0 then return false end
  return str:match("^[0-9a-fA-F]+$") ~= nil
end

local _ss = "${sessionSecret}"
local fp = _gF()
local tk = _rT()

local url = "${baseUrl}?slug=${slug}&uid=" .. fp.u .. "&ts=" .. fp.t .. "&tk=" .. tk .. "&ss=" .. _ss .. "&gid=" .. fp.g .. "&pid=" .. fp.p .. "&r=" .. fp.r .. "&_=" .. tostring(tick())

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
  if r == "" then
    warn("Empty response")
    return
  end

  if r:sub(1,2) == "--" then
    -- Executor cached an old loader. Run the new one to refresh.
    local rf, re = loadstring(r)
    if rf then
      return rf()
    end
    warn("Protection error")
    return
  end

  if _isHex(r) then
    local d = bs(xb(hb(r), kb))
    local f, e = loadstring(d)
    if f then
      f()
    else
      warn("E:" .. tostring(e))
    end
    return
  end

  -- Plain Lua response (kick script, rate limit, etc.)
  local pf, pe = loadstring(r)
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

// Build redirect URL to the backend heartbeat edge function (not frontend route)
function buildHeartbeatRedirectUrl(supabaseUrl: string, slug: string, logId: string): string {
  return `${supabaseUrl}/functions/v1/hb?slug=${encodeURIComponent(slug)}&id=${encodeURIComponent(logId)}&t=${Date.now()}`;
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
    
    // Detect non-Roblox requests with auth params (bypass attempt)
    // NOTE: Some executors spoof a browser UA, so we also use browser-only headers to detect real browsers.
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

      const loader = generateLoader(slugStr, baseUrl, newToken, sessionSecret);
      console.log(`Refreshed loader for paste: ${paste.id} from IP: ${clientIp}`);
      return new Response(loader, { status: 200, headers: textHeaders });
    };

    // Log access for monitoring (both browser and executor)
    // NOTE: guarded by per-paste toggle + de-duped to avoid flooding.
    // Enhanced to include Discord and Roblox profile data
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
    // Redirect to Discord OAuth EVERY time if IP tracking is enabled (always re-authorize)
    // BUT: after OAuth callback we allow a short window to load the page (prevents infinite loop)
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

    // Hide Code: only blank real browsers.
    // Some executors spoof a browser UA; we should NOT blank them or the loader won't run.
    if (paste.hide_code && !uid && !tk) {
      if (isLikelyBrowser && !isRobloxRequest) {
        console.log(`[get-paste] hide_code: blanking browser request slug=${slug} ip=${clientIp}`);
        const logId = await logAccess(null, 'browser');

        // Redirect to backend heartbeat page (proper HTML)
        if (logId) {
          return new Response(null, {
            status: 302,
            headers: { ...corsHeaders, Location: buildHeartbeatRedirectUrl(supabaseUrl, slugStr, logId) },
          });
        }

        return new Response('', {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
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
        const logId = await logAccess(null, 'browser');

        // Redirect to backend heartbeat page (proper HTML)
        if (logId) {
          return new Response(null, {
            status: 302,
            headers: { ...corsHeaders, Location: buildHeartbeatRedirectUrl(supabaseUrl, slugStr, logId) },
          });
        }

        // Fallback: Return empty HTML for browser
        return new Response('', {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
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

    // Whitelist: allow if ANY whitelist entry is valid (prevents inconsistent behavior if duplicates ever exist).
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