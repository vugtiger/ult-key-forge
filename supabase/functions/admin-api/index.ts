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

    // Verify the caller is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userId = claims.claims.sub;

    // Check admin role using service client
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden - admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { action, ...params } = body;

    if (action === 'list_users') {
      const { data: authUsers, error } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
      if (error) throw error;

      const { data: profiles } = await serviceClient.from('profiles').select('*');
      const { data: ips } = await serviceClient.from('user_ips').select('*');

      const users = (authUsers?.users || []).map(u => {
        const profile = profiles?.find(p => p.id === u.id);
        const userIps = ips?.filter(ip => ip.user_id === u.id) || [];
        return {
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          discord_username: profile?.discord_username,
          is_banned: profile?.is_banned || false,
          ban_reason: profile?.ban_reason,
          ip_addresses: userIps.map(ip => ({ 
            address: ip.ip_address, 
            is_primary: ip.is_primary,
            last_used: ip.last_used_at 
          })),
        };
      });

      return new Response(JSON.stringify({ users }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'list_pastes') {
      const { data: pastes, error } = await serviceClient
        .from('pastes')
        .select('id, title, slug, content, user_id, created_at, updated_at, protection_enabled')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get user emails directly from auth.users via admin API
      const userIds = [...new Set(pastes?.map(p => p.user_id) || [])];
      const { data: authUsers } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
      const userEmailMap: Record<string, string> = {};
      (authUsers?.users || []).forEach(u => { userEmailMap[u.id] = u.email || 'Unknown'; });

      const enriched = (pastes || []).map(p => ({
        ...p,
        owner_email: userEmailMap[p.user_id] || 'Unknown',
      }));

      return new Response(JSON.stringify({ pastes: enriched }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'list_access_logs') {
      const { data: logs, error } = await serviceClient
        .from('paste_access_logs')
        .select('id, paste_id, ip_address, roblox_user_id, roblox_username, roblox_avatar_url, discord_username, discord_user_id, access_type, is_active, last_seen_at, created_at, user_agent')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;

      // Get paste slugs
      const pasteIds = [...new Set(logs?.map(l => l.paste_id) || [])];
      const { data: pasteData } = await serviceClient.from('pastes').select('id, slug, title, user_id').in('id', pasteIds);
      const { data: authUsers } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
      const userEmailMap: Record<string, string> = {};
      (authUsers?.users || []).forEach(u => { userEmailMap[u.id] = u.email || 'Unknown'; });

      const enriched = (logs || []).map(l => {
        const paste = pasteData?.find(p => p.id === l.paste_id);
        return { ...l, paste_slug: paste?.slug, paste_title: paste?.title, paste_owner_email: paste ? (userEmailMap[paste.user_id] || 'Unknown') : 'Unknown' };
      });

      return new Response(JSON.stringify({ logs: enriched }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'list_sessions') {
      const { data: sessions, error } = await serviceClient
        .from('user_sessions')
        .select('*')
        .order('last_active', { ascending: false })
        .limit(500);
      if (error) throw error;

      const { data: authUsers } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
      const userEmailMap: Record<string, string> = {};
      (authUsers?.users || []).forEach(u => { userEmailMap[u.id] = u.email || 'Unknown'; });

      const enriched = (sessions || []).map(s => ({ ...s, user_email: userEmailMap[s.user_id] || 'Unknown' }));

      return new Response(JSON.stringify({ sessions: enriched }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'list_activity') {
      const { data: activity, error } = await serviceClient
        .from('user_activity')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;

      const { data: authUsers } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
      const userEmailMap: Record<string, string> = {};
      (authUsers?.users || []).forEach(u => { userEmailMap[u.id] = u.email || 'Unknown'; });

      const enriched = (activity || []).map(a => ({ ...a, user_email: userEmailMap[a.user_id] || 'Unknown' }));

      return new Response(JSON.stringify({ activity: enriched }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'list_reviews') {
      const { data: reviews, error } = await serviceClient
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ reviews }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'delete_review') {
      const { review_id } = params;
      if (!review_id) throw new Error('Missing review_id');
      const { error } = await serviceClient.from('reviews').delete().eq('id', review_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'list_rate_limits') {
      const { data, error } = await serviceClient
        .from('rate_limits')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return new Response(JSON.stringify({ rate_limits: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'clear_rate_limits') {
      const { identifier } = params;
      if (identifier) {
        await serviceClient.from('rate_limits').delete().eq('identifier', identifier);
      } else {
        await serviceClient.from('rate_limits').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'delete_user') {
      const { target_user_id } = params;
      if (!target_user_id) throw new Error('Missing target_user_id');
      if (target_user_id === userId) throw new Error('Cannot delete your own account');
      const { error } = await serviceClient.auth.admin.deleteUser(target_user_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'delete_paste') {
      const { paste_id } = params;
      if (!paste_id) throw new Error('Missing paste_id');
      const { error } = await serviceClient.from('pastes').delete().eq('id', paste_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'ban_user') {
      const { target_user_id, reason } = params;
      if (!target_user_id) throw new Error('Missing target_user_id');
      const { error } = await serviceClient.from('profiles').update({
        is_banned: true,
        banned_at: new Date().toISOString(),
        ban_reason: reason || 'Banned by admin',
      }).eq('id', target_user_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'unban_user') {
      const { target_user_id } = params;
      if (!target_user_id) throw new Error('Missing target_user_id');
      const { error } = await serviceClient.from('profiles').update({
        is_banned: false,
        banned_at: null,
        ban_reason: null,
      }).eq('id', target_user_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'generate_keys') {
      const { paste_id, key_count, duration_hours, roblox_user_ids } = params;
      if (!paste_id) throw new Error('Missing paste_id');
      
      const count = Math.min(parseInt(key_count) || 10, 500);
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      const generateKey = () => Array.from({ length: 20 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

      const expiresAt = duration_hours ? new Date(Date.now() + duration_hours * 3600000).toISOString() : null;

      // Find/create control panel for this paste
      const { data: existingPanel } = await serviceClient
        .from('control_panels')
        .select('id')
        .eq('paste_id', paste_id)
        .eq('user_id', userId)
        .maybeSingle();

      let panelId = existingPanel?.id;
      if (!panelId) {
        const { data: newPanel, error: panelErr } = await serviceClient
          .from('control_panels')
          .insert({ user_id: userId, paste_id, name: 'Auto-generated Panel' })
          .select('id')
          .single();
        if (panelErr) throw panelErr;
        panelId = newPanel.id;
      }

      // Generate keys
      const keys = Array.from({ length: count }, () => ({
        panel_id: panelId,
        key_value: generateKey(),
        expires_at: expiresAt,
      }));

      const { data: insertedKeys, error: keysErr } = await serviceClient
        .from('control_panel_keys')
        .insert(keys)
        .select('key_value, expires_at');
      if (keysErr) throw keysErr;

      // Add roblox user IDs to paste_access_control if provided
      if (roblox_user_ids && Array.isArray(roblox_user_ids) && roblox_user_ids.length > 0) {
        const accessEntries = roblox_user_ids.map((rbxId: string) => ({
          paste_id,
          roblox_user_id: rbxId.toString(),
          access_type: 'whitelist',
          expires_at: expiresAt,
          is_eternal: !expiresAt,
        }));
        await serviceClient.from('paste_access_control').insert(accessEntries);
      }

      return new Response(JSON.stringify({ success: true, keys: insertedKeys, panel_id: panelId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Admin API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
