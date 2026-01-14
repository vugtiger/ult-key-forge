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

// Generate protected HTML viewer for background protection
function generateProtectedViewer(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>ULT LUA PROTECTS - Protected Content</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; user-select: none; -webkit-user-select: none; }
    html, body { 
      min-height: 100vh; 
      width: 100%;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%);
      overflow: hidden;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Courier New', monospace;
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 40px;
      background: rgba(0,0,0,0.85);
      border: 2px solid rgba(255,255,255,0.15);
      border-radius: 20px;
      backdrop-filter: blur(15px);
      max-width: 600px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .logo {
      position: fixed;
      top: 20px;
      left: 20px;
      font-size: 24px;
      font-weight: bold;
      background: linear-gradient(45deg, #fff, #888);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-shadow: 0 0 30px rgba(255,255,255,0.3);
      z-index: 1000;
    }
    .center-logo {
      font-size: 48px;
      font-weight: bold;
      margin-bottom: 20px;
      background: linear-gradient(45deg, #fff, #888);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-shadow: 0 0 30px rgba(255,255,255,0.3);
    }
    .message {
      font-size: 24px;
      color: #ff4444;
      margin-bottom: 15px;
      font-weight: bold;
    }
    .sub {
      color: #888;
      font-size: 14px;
      margin-top: 10px;
    }
    .shield {
      font-size: 80px;
      margin-bottom: 20px;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.05); opacity: 0.8; }
    }
  </style>
  <script>
    // Complete dev tools blockage
    (function() {
      // Disable right click
      document.addEventListener('contextmenu', function(e) { e.preventDefault(); return false; });
      
      // Disable keyboard shortcuts
      document.addEventListener('keydown', function(e) {
        // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U
        if (e.key === 'F12' || 
            (e.ctrlKey && e.shiftKey && ['I','J','C','K'].includes(e.key.toUpperCase())) ||
            (e.ctrlKey && e.key.toUpperCase() === 'U') ||
            (e.metaKey && e.altKey && e.key.toUpperCase() === 'I')) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      });
      
      // Disable drag
      document.addEventListener('dragstart', function(e) { e.preventDefault(); return false; });
      
      // Detect devtools via debugger statement
      setInterval(function() {
        debugger;
      }, 100);
      
      // Detect devtools via console
      var devtools = function(){};
      devtools.toString = function() {
        window.location.reload();
        return '';
      };
      console.log('%c', devtools);
      
      // Continuously clear console
      setInterval(function() {
        console.clear();
      }, 50);
      
      // Block view source
      document.onkeypress = function(e) {
        if (e.ctrlKey && e.key === 'u') {
          return false;
        }
      };
    })();
  </script>
</head>
<body>
  <div class="logo">ULT LUA</div>
  <div class="container">
    <div class="shield">🛡️</div>
    <div class="center-logo">ULT LUA PROTECTS</div>
    <div class="message">⚠️ You are not authorized to see this code</div>
    <div class="sub">This content is protected by ULT LUA PROTECTS<br>Execution via loadstring is still allowed.</div>
  </div>
</body>
</html>`;
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

    // Check for background protection - show protected viewer for ALL non-Roblox requests
    // This prevents anyone from viewing the source code in a browser
    if (paste.background_protection && !isRobloxRequest) {
      // For any browser/non-Roblox request, show the protected viewer
      return new Response(generateProtectedViewer(), {
        status: 200,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/html; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        }
      });
    }

    // If protection is disabled, return content directly
    if (!paste.protection_enabled && !paste.public_protection) {
      if (uid && /^\d+$/.test(uid)) {
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

      const nowDate = new Date().toISOString();
      const isBlacklisted = blacklistEntry && (
        blacklistEntry.is_eternal || 
        !blacklistEntry.expires_at || 
        blacklistEntry.expires_at > nowDate
      );

      if (isBlacklisted) {
        console.log(`Blacklisted user (public protection): ${uid}`);
        return new Response(generateKickEncrypted('You are blacklisted', slug, tk, uid), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }

      // Log execution
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

    const nowDate = new Date().toISOString();

    // Check for blacklist first
    const isBlacklisted = accessList?.some(entry => {
      if (entry.access_type !== 'blacklist') return false;
      if (entry.is_eternal) return true;
      if (!entry.expires_at) return true;
      return entry.expires_at > nowDate;
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

    // Check if whitelist entry is valid
    const isValidWhitelist = whitelistEntry.is_eternal || 
      !whitelistEntry.expires_at || 
      whitelistEntry.expires_at > nowDate;

    if (!isValidWhitelist) {
      console.log(`Whitelist time expired: ${uid}`);
      return new Response(generateKickEncrypted('Your whitelist time has expired', slug, tk, uid), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Log execution
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

  } catch (err) {
    console.error('Error:', err);
    return new Response('Server error', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});
