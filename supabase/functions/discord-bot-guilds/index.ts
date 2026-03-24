import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CACHE_KEY = 'discord_guilds_cache';
const CACHE_TTL_SECONDS = 300; // 5 minutes

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check DB cache first
    const { data: cacheRow } = await supabase
      .from('site_info')
      .select('last_updated, version')
      .eq('id', CACHE_KEY)
      .single();

    if (cacheRow?.version) {
      const cacheAge = (Date.now() - new Date(cacheRow.last_updated).getTime()) / 1000;
      if (cacheAge < CACHE_TTL_SECONDS) {
        return new Response(cacheRow.version, {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
        });
      }
    }

    // Fetch from Discord
    const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN");
    if (!DISCORD_BOT_TOKEN) throw new Error("Missing DISCORD_BOT_TOKEN");

    const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: { 'Authorization': `Bot ${DISCORD_BOT_TOKEN}` },
    });

    // If rate limited, return stale cache or empty
    if (response.status === 429) {
      await response.text();
      if (cacheRow?.version) {
        return new Response(cacheRow.version, {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'STALE' },
        });
      }
      return new Response('[]', {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Discord API error:', errorText);
      // Return stale cache on any error
      if (cacheRow?.version) {
        return new Response(cacheRow.version, {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'STALE' },
        });
      }
      throw new Error(`Discord API error: ${response.status}`);
    }

    const guilds = await response.json();
    const simplified = guilds.map((g: any) => ({
      id: g.id,
      name: g.name,
      icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.${g.icon.startsWith('a_') ? 'gif' : 'png'}?size=128` : null,
      member_count: g.approximate_member_count || null,
    }));

    const jsonStr = JSON.stringify(simplified);

    // Store in DB cache (upsert into site_info using the cache key)
    await supabase.from('site_info').upsert({
      id: CACHE_KEY,
      last_updated: new Date().toISOString(),
      version: jsonStr,
    });

    return new Response(jsonStr, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
    });
  } catch (error: any) {
    console.error('Error fetching guilds:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
