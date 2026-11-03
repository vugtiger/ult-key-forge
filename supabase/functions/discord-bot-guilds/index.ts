
import { browserRedirectIfHtml } from "../_shared/browserBlock.ts";
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { getDiscordGuilds, DiscordError, type DiscordGuild } from './invites.ts';

let cache: { guilds: DiscordGuild[]; updated: number } | null = null;
let pending: Promise<DiscordGuild[]> | null = null;
const CACHE_TTL = 5 * 60 * 1000;
const invites = new Map<string, DiscordGuild>();
const inviteRequests = new Map<string, Promise<DiscordGuild | undefined>>();

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

    const guildId = new URL(req.url).searchParams.get('guild_id');
    if (guildId && !/^\d{1,20}$/.test(guildId)) return new Response(JSON.stringify({ error: 'Invalid server ID' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    if (!cache || Date.now() - cache.updated >= CACHE_TTL) {
      pending ??= getDiscordGuilds(DISCORD_BOT_TOKEN, false).then(guilds => {
        cache = { guilds, updated: Date.now() };
        return guilds;
      }).finally(() => { pending = null; });
      await pending;
    }
    if (guildId) {
      if (!cache?.guilds.some(g => g.id === guildId)) return new Response(JSON.stringify({ error: 'The bot is not in this server.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (!invites.has(guildId)) {
        let task = inviteRequests.get(guildId);
        if (!task) {
          task = getDiscordGuilds(DISCORD_BOT_TOKEN, true, guildId).then(guilds => {
            const guild = guilds.find(g => g.id === guildId);
            if (guild?.invite_url) invites.set(guildId, guild);
            return guild;
          }).finally(() => { inviteRequests.delete(guildId); });
          inviteRequests.set(guildId, task);
        }
        const guild = await task;
        return new Response(JSON.stringify(guild), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify(invites.get(guildId)), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify((cache?.guilds ?? []).map(g => invites.get(g.id) || g)), {
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
