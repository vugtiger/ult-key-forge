import { createClient } from "npm:@supabase/supabase-js@2";
import { browserRedirectIfHtml } from "../_shared/browserBlock.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  const _blocked = browserRedirectIfHtml(req);
  if (_blocked) return _blocked;
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's paste IDs
    const { data: userPastes } = await serviceClient
      .from('pastes')
      .select('id')
      .eq('user_id', user.id);

    const pasteIds = (userPastes || []).map(p => p.id);
    if (pasteIds.length === 0) {
      return new Response(JSON.stringify({ banned_users: [], banned_ips: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get access logs for user's pastes that are bypass/bot attempts
    const { data: logs } = await serviceClient
      .from('paste_access_logs')
      .select('*')
      .in('paste_id', pasteIds)
      .order('last_seen_at', { ascending: false });

    // Collect unique identifiers from user's access logs to scope ban queries
    const userPasteIps = new Set((logs || []).map(l => l.ip_address).filter(Boolean));
    const userRobloxIds = new Set((logs || []).map(l => l.roblox_user_id).filter(Boolean));
    const userDiscordIds = new Set((logs || []).map(l => l.discord_user_id).filter(Boolean));

    // Get only global bans relevant to this user's paste access logs
    const allBanValues = [...userPasteIps, ...userRobloxIds, ...userDiscordIds];
    let bans: any[] = [];
    if (allBanValues.length > 0) {
      const { data: bansData } = await serviceClient
        .from('global_bans')
        .select('*')
        .eq('is_active', true)
        .in('ban_value', allBanValues);
      bans = bansData || [];
    }

    const bannedIpSet = new Set(bans.filter(b => b.ban_type === 'ip').map(b => b.ban_value));
    const bannedRobloxSet = new Set(bans.filter(b => b.ban_type === 'roblox_id').map(b => b.ban_value));
    const bannedDiscordSet = new Set(bans.filter(b => b.ban_type === 'discord_id').map(b => b.ban_value));

    // Build banned Roblox users list (from access logs + global bans)

    // Build banned Roblox users list (from access logs + global bans)
    const bannedUsersMap = new Map<string, any>();

    for (const log of (logs || [])) {
      if (log.roblox_user_id && bannedRobloxSet.has(log.roblox_user_id)) {
        if (!bannedUsersMap.has(log.roblox_user_id)) {
          const ban = (bans || []).find(b => b.ban_type === 'roblox_id' && b.ban_value === log.roblox_user_id);
          bannedUsersMap.set(log.roblox_user_id, {
            roblox_user_id: log.roblox_user_id,
            roblox_username: log.roblox_username,
            roblox_display_name: log.roblox_display_name,
            roblox_avatar_url: log.roblox_avatar_url,
            roblox_created_at: log.roblox_created_at,
            roblox_is_banned: log.roblox_is_banned,
            discord_user_id: log.discord_user_id,
            discord_username: log.discord_username,
            discord_avatar: log.discord_avatar,
            discord_created_at: log.discord_created_at,
            ip_address: log.ip_address,
            last_seen_at: log.last_seen_at,
            ban_reason: ban?.reason || 'Bypass attempt',
            banned_at: ban?.banned_at,
          });
        }
      }
      // Also check discord bans
      if (log.discord_user_id && bannedDiscordSet.has(log.discord_user_id)) {
        const key = `discord_${log.discord_user_id}`;
        if (!bannedUsersMap.has(key) && !log.roblox_user_id) {
          const ban = (bans || []).find(b => b.ban_type === 'discord_id' && b.ban_value === log.discord_user_id);
          bannedUsersMap.set(key, {
            roblox_user_id: log.roblox_user_id,
            roblox_username: log.roblox_username,
            roblox_display_name: log.roblox_display_name,
            roblox_avatar_url: log.roblox_avatar_url,
            roblox_created_at: log.roblox_created_at,
            roblox_is_banned: log.roblox_is_banned,
            discord_user_id: log.discord_user_id,
            discord_username: log.discord_username,
            discord_avatar: log.discord_avatar,
            discord_created_at: log.discord_created_at,
            ip_address: log.ip_address,
            last_seen_at: log.last_seen_at,
            ban_reason: ban?.reason || 'Bypass attempt',
            banned_at: ban?.banned_at,
          });
        }
      }
    }

    // Also add global bans for roblox/discord IDs that have NO matching access logs
    for (const ban of bans) {
      if (ban.ban_type === 'roblox_id' && !bannedUsersMap.has(ban.ban_value)) {
        bannedUsersMap.set(ban.ban_value, {
          roblox_user_id: ban.ban_value,
          roblox_username: null,
          roblox_display_name: null,
          roblox_avatar_url: null,
          roblox_created_at: null,
          roblox_is_banned: null,
          discord_user_id: null,
          discord_username: null,
          discord_avatar: null,
          discord_created_at: null,
          ip_address: null,
          last_seen_at: null,
          ban_reason: ban.reason || 'Global ban',
          banned_at: ban.banned_at,
        });
      }
      if (ban.ban_type === 'discord_id') {
        const key = `discord_${ban.ban_value}`;
        if (!bannedUsersMap.has(key)) {
          bannedUsersMap.set(key, {
            roblox_user_id: null,
            roblox_username: null,
            roblox_display_name: null,
            roblox_avatar_url: null,
            roblox_created_at: null,
            roblox_is_banned: null,
            discord_user_id: ban.ban_value,
            discord_username: null,
            discord_avatar: null,
            discord_created_at: null,
            ip_address: null,
            last_seen_at: null,
            ban_reason: ban.reason || 'Global ban',
            banned_at: ban.banned_at,
          });
        }
      }
    }

    // Build banned IPs list (real IPs, not VPN-rotated duplicates)
    // Group by IP, only include IPs that are actually in global_bans
    const bannedIpsMap = new Map<string, any>();

    for (const log of (logs || [])) {
      if (bannedIpSet.has(log.ip_address) && !bannedIpsMap.has(log.ip_address)) {
        const ban = bans.find(b => b.ban_type === 'ip' && b.ban_value === log.ip_address);
        bannedIpsMap.set(log.ip_address, {
          ip_address: log.ip_address,
          roblox_user_id: log.roblox_user_id,
          roblox_username: log.roblox_username,
          roblox_avatar_url: log.roblox_avatar_url,
          discord_user_id: log.discord_user_id,
          discord_username: log.discord_username,
          discord_avatar: log.discord_avatar,
          discord_created_at: log.discord_created_at,
          last_seen_at: log.last_seen_at,
          ban_reason: ban?.reason || 'Bypass attempt',
          banned_at: ban?.banned_at,
          access_type: log.access_type,
        });
      }
    }

    // Also add banned IPs with no matching access logs
    for (const ban of bans) {
      if (ban.ban_type === 'ip' && !bannedIpsMap.has(ban.ban_value)) {
        bannedIpsMap.set(ban.ban_value, {
          ip_address: ban.ban_value,
          roblox_user_id: null,
          roblox_username: null,
          roblox_avatar_url: null,
          discord_user_id: null,
          discord_username: null,
          discord_avatar: null,
          discord_created_at: null,
          last_seen_at: null,
          ban_reason: ban.reason || 'Global ban',
          banned_at: ban.banned_at,
          access_type: null,
        });
      }
    }

    return new Response(JSON.stringify({
      banned_users: Array.from(bannedUsersMap.values()),
      banned_ips: Array.from(bannedIpsMap.values()),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Owner bans error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
