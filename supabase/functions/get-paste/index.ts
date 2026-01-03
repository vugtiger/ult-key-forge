import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting map: IP -> { count, resetTime }
const rateLimits = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW = 60000;

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

function kickScript(reason: string) {
  const safeReason = reason.replace(/\r?\n/g, " ").trim().slice(0, 180);
  const luaReason = JSON.stringify(safeReason);
  return `game:GetService("Players").LocalPlayer:Kick(${luaReason})`;
}

// Simple XOR obfuscation that works reliably
function obfuscateCode(code: string, userId: string, timestamp: number): string {
  const key = (parseInt(userId) ^ timestamp) % 256;
  const bytes: number[] = [];
  
  for (let i = 0; i < code.length; i++) {
    bytes.push(code.charCodeAt(i) ^ ((key + i) % 256));
  }
  
  const execToken = Math.random().toString(36).substring(2, 10);
  
  return `--[[Protected by ULT LUA]]
local _${execToken} = function()
  local _e = {${bytes.join(',')}}
  local _k = ${key}
  local _r = ""
  for i = 1, #_e do
    _r = _r .. string.char(bit32.bxor(_e[i], (_k + i - 1) % 256))
  end
  local _f = loadstring(_r)
  _e = nil
  _r = nil
  if _f then
    return _f()
  end
end
_${execToken}()`;
}

// Generate secure loader for protected pastes
function generateSecureLoader(slug: string, baseUrl: string): string {
  const token = Math.random().toString(36).substring(2, 10);
  
  return `--[[ULT LUA PROTECTS]]
local _${token} = function()
  local Players = game:GetService("Players")
  local player = Players.LocalPlayer
  if not player then
    player = Players:GetPropertyChangedSignal("LocalPlayer"):Wait()
    player = Players.LocalPlayer
  end
  
  local userId = tostring(player.UserId)
  local timestamp = tostring(os.time())
  
  -- Generate simple signature: userId:timestamp:slug
  local sigData = userId .. ":" .. timestamp .. ":" .. "${slug}"
  local hash = 0
  for i = 1, #sigData do
    hash = (hash * 31 + string.byte(sigData, i)) % 2147483647
  end
  local sig = tostring(hash)
  
  -- Build URL with auth params
  local url = "${baseUrl}?slug=${slug}&uid=" .. userId .. "&ts=" .. timestamp .. "&sig=" .. sig
  
  -- Fetch protected code
  local success, result = pcall(function()
    return game:HttpGet(url)
  end)
  
  if success and result then
    local fn = loadstring(result)
    if fn then
      pcall(fn)
    end
  end
end
_${token}()`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');
    const uid = url.searchParams.get('uid');
    const sig = url.searchParams.get('sig');
    const ts = url.searchParams.get('ts');
    
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';

    if (!slug) {
      return new Response('Missing slug', {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    if (!checkRateLimit(clientIp)) {
      console.log(`Rate limit exceeded for IP: ${clientIp}`);
      return new Response(kickScript('Too many requests. Please slow down.'), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: paste, error } = await supabase
      .from('pastes')
      .select('id, content, protection_enabled, user_id')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      console.error('Database error:', error);
      return new Response('Server error', {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    if (!paste) {
      return new Response('Script not found', {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // No protection - return content directly
    if (!paste.protection_enabled) {
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
        },
      });
    }

    // === PROTECTION ENABLED ===
    
    // Stage 1: No UID - return loader script
    if (!uid) {
      const baseUrl = Deno.env.get('SUPABASE_URL') + '/functions/v1/get-paste';
      const loader = generateSecureLoader(slug, baseUrl);
      
      return new Response(loader, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    // Stage 2: Verify credentials
    if (!/^\d+$/.test(uid)) {
      return new Response(kickScript('Invalid user ID.'), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    if (!sig || !ts) {
      return new Response(kickScript('Missing authentication.'), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Verify timestamp (60 second window)
    const timestamp = parseInt(ts);
    const nowSec = Math.floor(Date.now() / 1000);
    if (Number.isNaN(timestamp) || Math.abs(nowSec - timestamp) > 60) {
      return new Response(kickScript('Request expired.'), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Verify signature - must match: userId:timestamp:slug
    const sigData = uid + ":" + ts + ":" + slug;
    let hash = 0;
    for (let i = 0; i < sigData.length; i++) {
      hash = (hash * 31 + sigData.charCodeAt(i)) % 2147483647;
    }
    const expectedSig = hash.toString();

    if (sig !== expectedSig) {
      console.log(`Signature mismatch for UID: ${uid}, expected: ${expectedSig}, got: ${sig}`);
      return new Response(kickScript('Authentication failed.'), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Check access control
    const now = new Date().toISOString();
    
    // Clean up expired entries
    await supabase
      .from('paste_access_control')
      .delete()
      .eq('paste_id', paste.id)
      .eq('roblox_user_id', uid)
      .eq('is_eternal', false)
      .not('expires_at', 'is', null)
      .lt('expires_at', now);

    // Get current entries
    const { data: entries } = await supabase
      .from('paste_access_control')
      .select('access_type, expires_at, is_eternal')
      .eq('paste_id', paste.id)
      .eq('roblox_user_id', uid);

    // Check blacklist
    const blacklisted = entries?.find(e => {
      if (e.access_type !== 'blacklist') return false;
      if (e.is_eternal) return true;
      if (!e.expires_at) return true;
      return e.expires_at > now;
    });

    if (blacklisted) {
      console.log(`Blacklisted user: ${uid}`);
      return new Response(kickScript('You are blacklisted from this script.'), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Check whitelist
    const whitelisted = entries?.find(e => {
      if (e.access_type !== 'whitelist') return false;
      if (e.is_eternal) return true;
      if (!e.expires_at) return true;
      return e.expires_at > now;
    });

    if (!whitelisted) {
      console.log(`Not whitelisted: ${uid}`);
      return new Response(kickScript('You are not whitelisted for this script.'), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Track execution
    await supabase.from('paste_executions').insert({
      paste_id: paste.id,
      roblox_user_id: uid
    });

    console.log(`Access granted: ${uid} for paste: ${paste.id}`);

    // Return obfuscated code
    const protectedCode = obfuscateCode(paste.content, uid, timestamp);
    
    return new Response(protectedCode, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response('Server error', {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    });
  }
});
