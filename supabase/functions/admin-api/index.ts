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

    const { data: claims, error: claimsError } = await userClient.auth.getClaims(
      authHeader.replace('Bearer ', '')
    );
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

    // IP verification for admin - only allow the first admin IP
    const callerIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('cf-connecting-ip') || 
                     req.headers.get('x-real-ip') || 'unknown';

    const { data: adminIps } = await serviceClient
      .from('user_ips')
      .select('ip_address, is_primary')
      .eq('user_id', userId)
      .eq('is_primary', true);

    if (adminIps && adminIps.length > 0) {
      const primaryIp = adminIps[0].ip_address;
      if (callerIp !== primaryIp) {
        console.log(`Admin IP mismatch: expected ${primaryIp}, got ${callerIp}`);
        return new Response(JSON.stringify({ error: 'IP verification failed' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const { action, ...params } = await req.json();

    if (action === 'list_users') {
      // Get all users from auth.users
      const { data: authUsers, error } = await serviceClient.auth.admin.listUsers({
        perPage: 1000,
      });
      if (error) throw error;

      // Get all profiles
      const { data: profiles } = await serviceClient.from('profiles').select('*');
      // Get all IPs
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

      // Get user emails for each paste
      const userIds = [...new Set(pastes?.map(p => p.user_id) || [])];
      const { data: profiles } = await serviceClient
        .from('profiles')
        .select('id, username')
        .in('id', userIds);

      const enriched = (pastes || []).map(p => ({
        ...p,
        owner_email: profiles?.find(pr => pr.id === p.user_id)?.username || 'Unknown',
      }));

      return new Response(JSON.stringify({ pastes: enriched }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'delete_user') {
      const { target_user_id } = params;
      if (!target_user_id) throw new Error('Missing target_user_id');
      
      // Don't allow deleting yourself
      if (target_user_id === userId) {
        throw new Error('Cannot delete your own account');
      }

      // Delete from auth (cascades to profiles via trigger)
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
