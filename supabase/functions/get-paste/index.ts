import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');
    const robloxUserId = url.searchParams.get('uid');

    if (!slug) {
      return new Response('Missing slug parameter', { 
        status: 400, 
        headers: { 'Content-Type': 'text/plain' } 
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch paste with protection settings
    const { data: paste, error } = await supabase
      .from('pastes')
      .select('id, content, protection_enabled')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      console.error('Error fetching paste:', error);
      return new Response('Error fetching paste', { 
        status: 500, 
        headers: { 'Content-Type': 'text/plain' } 
      });
    }

    if (!paste) {
      return new Response('Paste not found', { 
        status: 404, 
        headers: { 'Content-Type': 'text/plain' } 
      });
    }

    // If protection is disabled, return content directly
    if (!paste.protection_enabled) {
      return new Response(paste.content, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    // Protection is enabled - check access control
    if (!robloxUserId) {
      // Return a loader script that gets the user ID and checks access
      const loaderScript = `
-- Script Protection Loader
local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")

local function checkAccess()
    local player = Players.LocalPlayer
    if not player then
        player = Players:GetPropertyChangedSignal("LocalPlayer"):Wait()
        player = Players.LocalPlayer
    end
    
    local userId = tostring(player.UserId)
    local baseUrl = "${Deno.env.get('SUPABASE_URL')}/functions/v1/get-paste"
    local url = baseUrl .. "?slug=${slug}&uid=" .. userId
    
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

checkAccess()
`;
      return new Response(loaderScript, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    // Check if user is blacklisted
    const { data: blacklistEntry } = await supabase
      .from('paste_access_control')
      .select('id')
      .eq('paste_id', paste.id)
      .eq('roblox_user_id', robloxUserId)
      .eq('access_type', 'blacklist')
      .maybeSingle();

    if (blacklistEntry) {
      return new Response('--KICKED:You are blacklisted from this script.', {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Check if user is whitelisted
    const { data: whitelistEntry } = await supabase
      .from('paste_access_control')
      .select('id')
      .eq('paste_id', paste.id)
      .eq('roblox_user_id', robloxUserId)
      .eq('access_type', 'whitelist')
      .maybeSingle();

    if (whitelistEntry) {
      // User is whitelisted - return the actual script
      return new Response(paste.content, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    // User is not whitelisted or blacklisted - kick them
    return new Response('--KICKED:You are not whitelisted to use this script.', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Error in get-paste function:', error);
    return new Response('Internal server error', { 
      status: 500, 
      headers: { 'Content-Type': 'text/plain' } 
    });
  }
});