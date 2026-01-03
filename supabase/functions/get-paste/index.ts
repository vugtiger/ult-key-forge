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

function kickScript(reason: string) {
  const safeReason = reason.replace(/\r?\n/g, " ").trim().slice(0, 180);
  const luaReason = JSON.stringify(safeReason);
  return `--KICKED:${safeReason}
local Players = game:GetService("Players")
local player = Players.LocalPlayer
if player then
  player:Kick(${luaReason})
end`;
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
      // This loader prevents the script from being printed or intercepted
      const loaderScript = `-- ULT LUA PROTECTS Secure Loader
local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")

local function secureExecute()
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
            -- Secure execution: load and execute immediately
            local fn, err = loadstring(result)
            result = nil -- Clear the source immediately
            if fn then
                local execSuccess, execErr = pcall(fn)
                fn = nil -- Clear the function reference
                if not execSuccess then
                    warn("Execution Error: " .. tostring(execErr))
                end
            else
                warn("Script Error: " .. tostring(err))
            end
        end
    else
        warn("Failed to load script: " .. tostring(result))
    end
end

-- Run immediately
task.spawn(secureExecute)`;
      
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
      return new Response(kickScript('Invalid User ID format'), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    // Verify signature and timestamp to prevent replay attacks
    if (!sig || !ts) {
      // Direct URL access attempt (bypass attempt)
      return new Response(kickScript('Direct access not allowed. Use the loader script.'), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    const timestamp = parseInt(ts);
    const nowSec = Math.floor(Date.now() / 1000);

    // Signature expires after 30 seconds
    if (Number.isNaN(timestamp) || Math.abs(nowSec - timestamp) > 30) {
      return new Response(kickScript('Request expired. Please try again.'), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
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
      return new Response(kickScript('Invalid signature. Access denied.'), {
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
         return new Response(kickScript('You are blacklisted from this script.'), {
           status: 200,
           headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
         });
       }
 
       const whitelisted = freshEntries?.find(e => {
         if (e.access_type !== 'whitelist') return false;
         if (e.is_eternal) return true;
         if (!e.expires_at) return true;
         return e.expires_at > now;
       });
 
       if (!whitelisted) {
         return new Response(kickScript('Your whitelist access has expired.'), {
           status: 200,
           headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
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
       return new Response(kickScript('You are blacklisted from this script.'), {
         status: 200,
         headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
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
       return new Response(kickScript('You are not whitelisted for this script.'), {
         status: 200,
         headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
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
