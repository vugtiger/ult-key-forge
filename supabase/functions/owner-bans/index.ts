import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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

    // Get threat logs related to user's paste IPs/roblox IDs
    const { data: threats } = await serviceClient
      .from('threat_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    // Get global bans
    const { data: bans } = await serviceClient
      .from('global_bans')
      .select('*')
      .eq('is_active', true);

    const bannedIpSet = new Set((bans || []).filter(b => b.ban_type === 'ip').map(b => b.ban_value));
    const bannedRobloxSet = new Set((bans || []).filter(b => b.ban_type === 'roblox_id').map(b => b.ban_value));
    const bannedDiscordSet = new Set((bans || []).filter(b => b.ban_type === 'discord_id').map(b => b.ban_value));

    // Collect unique IPs from user's access logs
    const userPasteIps = new Set((logs || []).map(l => l.ip_address));

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

    // Also add from threat_log entries with roblox/discord IDs that relate to user's paste IPs
    for (const threat of (threats || [])) {
      if (threat.roblox_user_id && bannedRobloxSet.has(threat.roblox_user_id) && !bannedUsersMap.has(threat.roblox_user_id)) {
        if (threat.source_ip && userPasteIps.has(threat.source_ip)) {
          const ban = (bans || []).find(b => b.ban_type === 'roblox_id' && b.ban_value === threat.roblox_user_id);
          bannedUsersMap.set(threat.roblox_user_id, {
            roblox_user_id: threat.roblox_user_id,
            roblox_username: null,
            roblox_display_name: null,
            roblox_avatar_url: null,
            roblox_created_at: null,
            roblox_is_banned: null,
            discord_user_id: threat.discord_user_id,
            discord_username: null,
            discord_avatar: null,
            discord_created_at: null,
            ip_address: threat.source_ip,
            last_seen_at: threat.created_at,
            ban_reason: ban?.reason || threat.threat_type,
            banned_at: ban?.banned_at || threat.created_at,
          });
        }
      }
    }

    // Build banned IPs list (real IPs, not VPN-rotated duplicates)
    // Group by IP, only include IPs that are actually in global_bans
    const bannedIpsMap = new Map<string, any>();

    for (const log of (logs || [])) {
      if (bannedIpSet.has(log.ip_address) && !bannedIpsMap.has(log.ip_address)) {
        const ban = (bans || []).find(b => b.ban_type === 'ip' && b.ban_value === log.ip_address);
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
