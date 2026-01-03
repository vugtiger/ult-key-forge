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

// Generate loader script for protected pastes
function generateLoader(slug: string, baseUrl: string): string {
  return `--[[ULT LUA PROTECTION]]
local player = game:GetService("Players").LocalPlayer
if not player then
  player = game:GetService("Players").PlayerAdded:Wait()
end

local userId = tostring(player.UserId)
local ts = tostring(os.time())

local url = "${baseUrl}?slug=${slug}&uid=" .. userId .. "&ts=" .. ts

local success, result = pcall(function()
  return game:HttpGet(url)
end)

if success and result then
  local fn, err = loadstring(result)
  if fn then
    fn()
  else
    warn("Load error: " .. tostring(err))
  end
else
  warn("Failed to fetch script")
end
`;
}

// Generate kick script
function generateKick(reason: string): string {
  return `game:GetService("Players").LocalPlayer:Kick("${reason}")`;
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

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';

    // Rate limiting
    if (!checkRateLimit(clientIp)) {
      return new Response(generateKick('Too many requests'), { 
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
      // Log execution if uid provided
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
    if (!uid || !ts) {
      // Return the loader script
      const baseUrl = supabaseUrl + '/functions/v1/get-paste';
      const loader = generateLoader(slug, baseUrl);
      
      return new Response(loader, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Validate user ID format
    if (!/^\d+$/.test(uid)) {
      return new Response(generateKick('Invalid user ID'), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Verify timestamp (5 minute window)
    const timestamp = parseInt(ts);
    const now = Math.floor(Date.now() / 1000);
    if (isNaN(timestamp) || Math.abs(now - timestamp) > 300) {
      return new Response(generateKick('Request expired'), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    // Check whitelist
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
      return new Response(generateKick('You are blacklisted'), {
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
      return new Response(generateKick('Not whitelisted'), {
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

    // Return the actual code
    return new Response(paste.content, {
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
