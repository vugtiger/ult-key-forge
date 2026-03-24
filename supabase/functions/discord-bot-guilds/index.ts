import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory cache: survives across requests within the same isolate
let cachedData: string | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const now = Date.now();

    // Return cached response if still fresh
    if (cachedData && now < cacheExpiry) {
      return new Response(cachedData, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
      });
    }

    const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN");
    if (!DISCORD_BOT_TOKEN) {
      throw new Error("Missing DISCORD_BOT_TOKEN");
    }

    const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: {
        'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Discord API error:', errorText);

      // If rate limited and we have stale cache, return stale data
      if (response.status === 429 && cachedData) {
        return new Response(cachedData, {
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

    // Update cache
    cachedData = JSON.stringify(simplified);
    cacheExpiry = now + CACHE_TTL_MS;

    return new Response(cachedData, {
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
