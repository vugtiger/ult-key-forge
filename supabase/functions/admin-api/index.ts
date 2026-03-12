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

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userId = user.id;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: roleData } = await serviceClient
      .from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden - admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { action, ...params } = body;
    const json = (data: any) => new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // ===== USER MANAGEMENT =====
    if (action === 'list_users') {
      const { data: authUsers, error } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
      if (error) throw error;
      const { data: profiles } = await serviceClient.from('profiles').select('*');
      const { data: ips } = await serviceClient.from('user_ips').select('*');
      const users = (authUsers?.users || []).map(u => {
        const profile = profiles?.find(p => p.id === u.id);
        const userIps = ips?.filter(ip => ip.user_id === u.id) || [];
        return {
          id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at,
          discord_username: profile?.discord_username, is_banned: profile?.is_banned || false, ban_reason: profile?.ban_reason,
          ip_addresses: userIps.map(ip => ({ address: ip.ip_address, is_primary: ip.is_primary, last_used: ip.last_used_at })),
        };
      });
      return json({ users });
    }

    if (action === 'list_pastes') {
      const { data: pastes, error } = await serviceClient.from('pastes')
        .select('id, title, slug, content, user_id, created_at, updated_at, protection_enabled')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const { data: authUsers } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
      const emailMap: Record<string, string> = {};
      (authUsers?.users || []).forEach(u => { emailMap[u.id] = u.email || 'Unknown'; });
      const enriched = (pastes || []).map(p => ({ ...p, owner_email: emailMap[p.user_id] || 'Unknown' }));
      return json({ pastes: enriched });
    }

    if (action === 'list_access_logs') {
      const { data: logs, error } = await serviceClient.from('paste_access_logs')
        .select('id, paste_id, ip_address, roblox_user_id, roblox_username, roblox_avatar_url, discord_username, discord_user_id, access_type, is_active, last_seen_at, created_at, user_agent')
        .order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      const pasteIds = [...new Set(logs?.map(l => l.paste_id) || [])];
      const { data: pasteData } = await serviceClient.from('pastes').select('id, slug, title, user_id').in('id', pasteIds);
      const { data: authUsers } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
      const emailMap: Record<string, string> = {};
      (authUsers?.users || []).forEach(u => { emailMap[u.id] = u.email || 'Unknown'; });
      const enriched = (logs || []).map(l => {
        const paste = pasteData?.find(p => p.id === l.paste_id);
        return { ...l, paste_slug: paste?.slug, paste_title: paste?.title, paste_owner_email: paste ? (emailMap[paste.user_id] || 'Unknown') : 'Unknown' };
      });
      return json({ logs: enriched });
    }

    if (action === 'list_sessions') {
      const { data: sessions, error } = await serviceClient.from('user_sessions').select('*').order('last_active', { ascending: false }).limit(500);
      if (error) throw error;
      const { data: authUsers } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
      const emailMap: Record<string, string> = {};
      (authUsers?.users || []).forEach(u => { emailMap[u.id] = u.email || 'Unknown'; });
      return json({ sessions: (sessions || []).map(s => ({ ...s, user_email: emailMap[s.user_id] || 'Unknown' })) });
    }

    if (action === 'list_activity') {
      const { data: activity, error } = await serviceClient.from('user_activity').select('*').order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      const { data: authUsers } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
      const emailMap: Record<string, string> = {};
      (authUsers?.users || []).forEach(u => { emailMap[u.id] = u.email || 'Unknown'; });
      return json({ activity: (activity || []).map(a => ({ ...a, user_email: emailMap[a.user_id] || 'Unknown' })) });
    }

    if (action === 'list_reviews') {
      const { data, error } = await serviceClient.from('reviews').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return json({ reviews: data });
    }

    if (action === 'delete_review') {
      const { review_id } = params;
      if (!review_id) throw new Error('Missing review_id');
      await serviceClient.from('reviews').delete().eq('id', review_id);
      return json({ success: true });
    }

    if (action === 'delete_user') {
      const { target_user_id } = params;
      if (!target_user_id) throw new Error('Missing target_user_id');
      if (target_user_id === userId) throw new Error('Cannot delete your own account');
      const { error } = await serviceClient.auth.admin.deleteUser(target_user_id);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === 'delete_paste') {
      const { paste_id } = params;
      if (!paste_id) throw new Error('Missing paste_id');
      await serviceClient.from('pastes').delete().eq('id', paste_id);
      return json({ success: true });
    }

    if (action === 'ban_user') {
      const { target_user_id, reason } = params;
      if (!target_user_id) throw new Error('Missing target_user_id');
      await serviceClient.from('profiles').update({
        is_banned: true, banned_at: new Date().toISOString(), ban_reason: reason || 'Banned by admin',
      }).eq('id', target_user_id);
      return json({ success: true });
    }

    if (action === 'unban_user') {
      const { target_user_id } = params;
      if (!target_user_id) throw new Error('Missing target_user_id');
      await serviceClient.from('profiles').update({ is_banned: false, banned_at: null, ban_reason: null }).eq('id', target_user_id);
      return json({ success: true });
    }

    // ===== GLOBAL BAN MANAGEMENT =====
    if (action === 'list_global_bans') {
      const { data, error } = await serviceClient.from('global_bans').select('*').order('banned_at', { ascending: false });
      if (error) throw error;
      return json({ bans: data });
    }

    if (action === 'add_global_ban') {
      const { ban_type, ban_value, reason } = params;
      if (!ban_type || !ban_value) throw new Error('Missing ban_type or ban_value');
      const trimmedValue = ban_value.trim();
      
      // Upsert the primary ban (re-activate if previously deactivated)
      const { error } = await serviceClient.from('global_bans').upsert({
        ban_type, ban_value: trimmedValue, reason: reason || null,
        banned_by: userId, is_active: true, banned_at: new Date().toISOString(),
      }, { onConflict: 'ban_type,ban_value' });
      if (error) throw error;

      // Cross-ban: when banning a Roblox/Discord ID, also ban all their known IPs
      const crossBanned: string[] = [];
      if (ban_type === 'roblox_id' || ban_type === 'discord_id') {
        const column = ban_type === 'roblox_id' ? 'roblox_user_id' : 'discord_user_id';
        const { data: logs } = await serviceClient.from('paste_access_logs')
          .select('ip_address')
          .eq(column, trimmedValue);
        
        const uniqueIps = [...new Set((logs || []).map(l => l.ip_address).filter(Boolean))];
        for (const ip of uniqueIps) {
          const { error: ipErr } = await serviceClient.from('global_bans').upsert({
            ban_type: 'ip', ban_value: ip,
            reason: `Cross-ban: associated with ${ban_type} ${trimmedValue}${reason ? ' — ' + reason : ''}`,
            banned_by: userId, is_active: true, banned_at: new Date().toISOString(),
          }, { onConflict: 'ban_type,ban_value' });
          if (!ipErr) crossBanned.push(ip);
        }
      }

      return json({ success: true, cross_banned_ips: crossBanned });
    }

    if (action === 'remove_global_ban') {
      const { ban_id } = params;
      if (!ban_id) throw new Error('Missing ban_id');
      await serviceClient.from('global_bans').update({ is_active: false }).eq('id', ban_id);
      return json({ success: true });
    }

    // ===== THREAT MANAGEMENT =====
    if (action === 'list_threats') {
      const { data, error } = await serviceClient.from('threat_log').select('*').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return json({ threats: data });
    }

    if (action === 'resolve_threat') {
      const { threat_id, auto_banned } = params;
      if (!threat_id) throw new Error('Missing threat_id');
      await serviceClient.from('threat_log').update({ resolved: true, auto_banned: auto_banned || false }).eq('id', threat_id);
      return json({ success: true });
    }

    if (action === 'generate_keys') {
      const { paste_id, key_count, duration_hours, roblox_user_ids } = params;
      if (!paste_id) throw new Error('Missing paste_id');
      const count = Math.min(parseInt(key_count) || 10, 500);
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      const generateKey = () => { const arr = new Uint8Array(20); crypto.getRandomValues(arr); return Array.from(arr, b => chars[b % chars.length]).join(''); };
      const expiresAt = duration_hours ? new Date(Date.now() + duration_hours * 3600000).toISOString() : null;
      const { data: existingPanel } = await serviceClient.from('control_panels').select('id').eq('paste_id', paste_id).eq('user_id', userId).maybeSingle();
      let panelId = existingPanel?.id;
      if (!panelId) {
        const { data: newPanel, error: panelErr } = await serviceClient.from('control_panels').insert({ user_id: userId, paste_id, name: 'Auto-generated Panel' }).select('id').single();
        if (panelErr) throw panelErr;
        panelId = newPanel.id;
      }
      const keys = Array.from({ length: count }, () => ({ panel_id: panelId, key_value: generateKey(), expires_at: expiresAt }));
      const { data: insertedKeys, error: keysErr } = await serviceClient.from('control_panel_keys').insert(keys).select('key_value, expires_at');
      if (keysErr) throw keysErr;
      if (roblox_user_ids && Array.isArray(roblox_user_ids) && roblox_user_ids.length > 0) {
        const accessEntries = roblox_user_ids.map((rbxId: string) => ({
          paste_id, roblox_user_id: rbxId.toString(), access_type: 'whitelist', expires_at: expiresAt, is_eternal: !expiresAt,
        }));
        await serviceClient.from('paste_access_control').insert(accessEntries);
      }
      return json({ success: true, keys: insertedKeys, panel_id: panelId });
    }

    if (action === 'clear_threats') {
      await serviceClient.from('threat_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      return json({ success: true });
    }

    if (action === 'clear_access_logs') {
      await serviceClient.from('paste_access_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      return json({ success: true });
    }

    if (action === 'clear_sessions') {
      await serviceClient.from('user_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      return json({ success: true });
    }

    if (action === 'clear_activity') {
      await serviceClient.from('user_activity').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      return json({ success: true });
    }

    if (action === 'list_banned_accounts') {
      const { data: profiles, error } = await serviceClient.from('profiles')
        .select('id, username, is_banned, ban_reason, banned_at, discord_username, discord_user_id')
        .eq('is_banned', true)
        .order('banned_at', { ascending: false });
      if (error) throw error;
      const { data: authUsers } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
      const emailMap: Record<string, string> = {};
      (authUsers?.users || []).forEach(u => { emailMap[u.id] = u.email || 'Unknown'; });
      const accounts = (profiles || []).map(p => ({
        ...p,
        email: emailMap[p.id] || 'Unknown',
      }));
      return json({ accounts });
    }

    if (action === 'mass_unban_by_reason') {
      const { reason_pattern } = params;
      if (!reason_pattern) throw new Error('Missing reason_pattern');
      const { data, error } = await serviceClient.from('global_bans')
        .update({ is_active: false })
        .like('reason', `%${reason_pattern}%`)
        .eq('is_active', true)
        .select('id');
      if (error) throw error;
      return json({ success: true, unbanned_count: data?.length || 0 });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Admin API error:', error);
    // Sanitize error messages - never expose internal DB details
    let safeMessage = 'An error occurred';
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('duplicate key')) safeMessage = 'Duplicate entry detected';
      else if (msg.includes('foreign key')) safeMessage = 'Invalid reference';
      else if (msg.includes('not-null')) safeMessage = 'Required field missing';
      else if (msg.includes('permission denied')) safeMessage = 'Access denied';
      else safeMessage = 'Operation failed';
    }
    return new Response(JSON.stringify({ error: safeMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
