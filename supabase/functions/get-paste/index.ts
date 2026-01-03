import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple rate limiting
const rateLimits = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimits.get(ip);
  
  if (!limit || now > limit.resetTime) {
    rateLimits.set(ip, { count: 1, resetTime: now + 60000 });
    return true;
  }
  
  if (limit.count >= 30) {
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

// Generate loader script with embedded one-time token
function generateLoader(slug: string, baseUrl: string, token: string): string {
  return `--[[ULT LUA PROTECTION v2]]
local player = game:GetService("Players").LocalPlayer
if not player then
  player = game:GetService("Players").PlayerAdded:Wait()
end

local userId = tostring(player.UserId)
local ts = tostring(os.time())
local tk = "${token}"

local url = "${baseUrl}?slug=${slug}&uid=" .. userId .. "&ts=" .. ts .. "&tk=" .. tk

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

local ks = "${slug}:" .. tk .. ":ULTv2"
local kb = {}
for i = 1, #ks do
  kb[i] = string.byte(ks, i)
end

local s, r = pcall(function()
  return game:HttpGet(url)
end)

if s and r then
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
function generateKickEncrypted(reason: string, slug: string, token: string): string {
  const kickScript = `game:GetService("Players").LocalPlayer:Kick("${reason}")`;
  const key = `${slug}:${token}:ULTv2`;
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
    const tk = url.searchParams.get('tk'); // One-time token

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';

    // Rate limiting (before we have slug/token, return plain kick)
    if (!checkRateLimit(clientIp)) {
      return new Response(generateKickPlain('Too many requests'), { 
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

    // Cleanup old tokens periodically (1% chance per request)
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

    // If protection is disabled, return content directly
    if (!paste.protection_enabled) {
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
      // Generate a new one-time token
      const newToken = generateToken();
      
      // Store token in database
      await supabase.from('paste_execution_tokens').insert({
        paste_id: paste.id,
        roblox_user_id: '0', // Will be validated on actual request
        token: newToken,
        expires_at: new Date(Date.now() + 30000).toISOString() // 30 second expiry
      });

      // Return the loader script with embedded token
      const baseUrl = supabaseUrl + '/functions/v1/get-paste';
      const loader = generateLoader(slug, baseUrl, newToken);
      
      console.log(`Generated loader with token for paste: ${paste.id}`);
      
      return new Response(loader, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Validate user ID format
    if (!/^\d+$/.test(uid)) {
      return new Response(generateKickEncrypted('Invalid user ID', slug, tk), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Verify timestamp (5 minute window)
    const timestamp = parseInt(ts);
    const now = Math.floor(Date.now() / 1000);
    if (isNaN(timestamp) || Math.abs(now - timestamp) > 300) {
      return new Response(generateKickEncrypted('Request expired', slug, tk), {
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
      console.log(`Invalid token: ${tk}`);
      return new Response(generateKickEncrypted('Invalid token', slug, tk), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Check if token already used
    if (tokenData.used_at) {
      console.log(`Token already used: ${tk}`);
      return new Response(generateKickEncrypted('Token already used', slug, tk), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Check if token expired
    if (new Date(tokenData.expires_at) < new Date()) {
      console.log(`Token expired: ${tk}`);
      return new Response(generateKickEncrypted('Token expired', slug, tk), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Mark token as used IMMEDIATELY (before any other checks)
    const { error: updateError } = await supabase
      .from('paste_execution_tokens')
      .update({ used_at: new Date().toISOString(), roblox_user_id: uid })
      .eq('id', tokenData.id)
      .is('used_at', null); // Only update if not already used (race condition protection)

    if (updateError) {
      console.log(`Failed to mark token as used: ${updateError.message}`);
      return new Response(generateKickEncrypted('Token error', slug, tk), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Now check whitelist
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
      return new Response(generateKickEncrypted('You are blacklisted', slug, tk), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Check for whitelist
    const isWhitelisted = accessList?.some(entry => {
      if (entry.access_type !== 'whitelist') return false;
      if (entry.is_eternal) return true;
      if (!entry.expires_at) return true;
      return entry.expires_at > nowDate;
    });

    if (!isWhitelisted) {
      console.log(`Not whitelisted: ${uid}`);
      return new Response(generateKickEncrypted('Not whitelisted', slug, tk), {
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

    // Return encrypted payload using TOKEN as part of the key (unpredictable!)
    const key = `${slug}:${tk}:ULTv2`;
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
