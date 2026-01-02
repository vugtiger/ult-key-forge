import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting map: IP -> { count, resetTime }
const rateLimits = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 30; // requests per minute
const RATE_WINDOW = 60000; // 1 minute

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
    
    // Get client IP for rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';

    if (!slug) {
      return new Response('-- Missing slug parameter', {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Rate limit check
    if (!checkRateLimit(clientIp)) {
      return new Response('-- Rate limit exceeded. Please wait before trying again.', {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
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
      return new Response('-- Database error', {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    if (!paste) {
      return new Response('-- Paste not found', {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // If protection is disabled, return content directly
    if (!paste.protection_enabled) {
      // Track execution
      if (uid) {
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

    // Protection is enabled - require uid with signature verification
    if (!uid) {
      // Return a loader script that captures the real user ID from Roblox
      const loaderScript = `-- Script Protection Loader
local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")

local function checkAccess()
    local player = Players.LocalPlayer
    if not player then
        player = Players:GetPropertyChangedSignal("LocalPlayer"):Wait()
        player = Players.LocalPlayer
    end
    
    local userId = tostring(player.UserId)
    local timestamp = tostring(os.time())
    local baseUrl = "${Deno.env.get('SUPABASE_URL')}/functions/v1/get-paste"
    
    -- Generate a simple hash for verification (client-side component)
    local verifyData = userId .. ":" .. timestamp .. ":${slug}"
    local hash = 0
    for i = 1, #verifyData do
        hash = (hash * 31 + string.byte(verifyData, i)) % 2147483647
    end
    local clientSig = tostring(hash)
    
    local url = baseUrl .. "?slug=${slug}&uid=" .. userId .. "&ts=" .. timestamp .. "&sig=" .. clientSig
    
    local success, result = pcall(function()
        return game:HttpGet(url)
    end)
    
    if success then
        if result:find("--KICKED:") then
            local reason = result:match("--KICKED:(.+)")
            player:Kick(reason or "Access Denied")
        else
            local fn, err = loadstring(result)
            if fn then
                fn()
            else
                warn("Script Error: " .. tostring(err))
            end
        end
    else
        warn("Failed to load script: " .. tostring(result))
    end
end

checkAccess()`;
      
      return new Response(loaderScript, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    // Validate uid format
    if (!/^\d+$/.test(uid)) {
      return new Response('--KICKED:Invalid User ID format', {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Verify signature and timestamp to prevent replay attacks
    if (sig && ts) {
      const timestamp = parseInt(ts);
      const now = Math.floor(Date.now() / 1000);
      
      // Signature expires after 30 seconds
      if (Math.abs(now - timestamp) > 30) {
        return new Response('--KICKED:Request expired. Please try again.', {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }
      
      // Verify the client-side signature matches
      const verifyData = uid + ":" + ts + ":" + slug;
      let hash = 0;
      for (let i = 0; i < verifyData.length; i++) {
        hash = (hash * 31 + verifyData.charCodeAt(i)) % 2147483647;
      }
      const expectedSig = hash.toString();
      
      if (sig !== expectedSig) {
        return new Response('--KICKED:Invalid signature. Access denied.', {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }
    } else {
      // No signature provided - this is a direct URL access attempt (bypass attempt)
      return new Response('--KICKED:Direct access not allowed. Use the loader script.', {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
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
      // Delete expired entries
      await supabase
        .from('paste_access_control')
        .delete()
        .in('id', expiredEntries.map(e => e.id));
      
      // Re-fetch entries after cleanup
      const { data: freshEntries } = await supabase
        .from('paste_access_control')
        .select('access_type, expires_at, is_eternal')
        .eq('paste_id', paste.id)
        .eq('roblox_user_id', uid);
      
      // Continue with fresh entries
      const blacklisted = freshEntries?.find(e => {
        if (e.access_type !== 'blacklist') return false;
        if (e.is_eternal) return true;
        if (!e.expires_at) return true;
        return e.expires_at > now;
      });

      if (blacklisted) {
        return new Response('--KICKED:You are blacklisted from this script.', {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }

      const whitelisted = freshEntries?.find(e => {
        if (e.access_type !== 'whitelist') return false;
        if (e.is_eternal) return true;
        if (!e.expires_at) return true;
        return e.expires_at > now;
      });

      if (!whitelisted) {
        return new Response('--KICKED:Your whitelist access has expired.', {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }

      // Track execution
      await supabase.from('paste_executions').insert({
        paste_id: paste.id,
        roblox_user_id: uid
      });

      return new Response(paste.content, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    // Check for blacklist first (highest priority)
    const blacklisted = accessEntries?.find(e => {
      if (e.access_type !== 'blacklist') return false;
      // Check if not expired
      if (e.is_eternal) return true;
      if (!e.expires_at) return true;
      return e.expires_at > now;
    });

    if (blacklisted) {
      return new Response('--KICKED:You are blacklisted from this script.', {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Check for valid whitelist entry
    const whitelisted = accessEntries?.find(e => {
      if (e.access_type !== 'whitelist') return false;
      // Check if not expired
      if (e.is_eternal) return true;
      if (!e.expires_at) return true;
      return e.expires_at > now;
    });

    if (!whitelisted) {
      return new Response('--KICKED:You are not whitelisted for this script.', {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Track execution
    await supabase.from('paste_executions').insert({
      paste_id: paste.id,
      roblox_user_id: uid
    });

    // Access granted - return content
    return new Response(paste.content, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response('-- Internal server error', {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    });
  }
});
