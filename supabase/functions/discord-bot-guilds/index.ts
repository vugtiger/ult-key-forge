
import { browserRedirectIfHtml } from "../_shared/browserBlock.ts";
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { getDiscordGuilds, DiscordError, type DiscordGuild } from './invites.ts';

let cache: { guilds: DiscordGuild[]; updated: number } | null = null;
let pending: Promise<DiscordGuild[]> | null = null;
const CACHE_TTL = 5 * 60 * 1000;

Deno.serve(async (req) => {
  const _blocked = browserRedirectIfHtml(req);
  if (_blocked) return _blocked;
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN");
    if (!DISCORD_BOT_TOKEN) {
      throw new Error("Missing DISCORD_BOT_TOKEN");
    }

    if (!cache || Date.now() - cache.updated >= CACHE_TTL) {
      pending ??= getDiscordGuilds(DISCORD_BOT_TOKEN).then(guilds => {
        cache = { guilds, updated: Date.now() };
        return guilds;
      }).finally(() => { pending = null; });
      await pending;
    }
    return new Response(JSON.stringify(cache?.guilds ?? []), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error fetching guilds:', error);
    return new Response(JSON.stringify({ guilds: cache?.guilds ?? [], stale: !!cache, error: error instanceof DiscordError ? error.message : 'Unable to load Discord servers.' }), {
      status: cache ? 200 : error instanceof DiscordError ? error.status : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
