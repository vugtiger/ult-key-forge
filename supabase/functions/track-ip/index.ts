import { createClient } from "npm:@supabase/supabase-js@2";

// Module-level client — reused across requests
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseModule = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const getIpv4Subnet = (ip: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(ip)
  ? `${ip.split('.').slice(0, 3).join('.')}.0/24`
  : null;

const subnetMatches = (ip: string, subnet: string) => subnet.endsWith('/24')
  ? ip.split('.').slice(0, 3).join('.') === subnet.replace(/\.0\/24$/, '')
  : ip.startsWith(subnet);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { user_id, action, limit_action, device_id } = body;
    const cleanDeviceId = typeof device_id === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(device_id)
      ? device_id
      : null;
    
    // Get IP from request headers
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               req.headers.get('cf-connecting-ip') || 
               req.headers.get('x-real-ip') || 
               'unknown';

    const supabase = supabaseModule;

    console.log(`IP tracking for user ${user_id ?? 'anon'}, action: ${action}, IP: ${ip}`);

    // ===== AUTH VALIDATION for privileged actions =====
    const privilegedActions = ['register', 'login', 'verify', 'check_ban'];
    if (privilegedActions.includes(action) && user_id) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      // Validate the JWT and ensure user_id matches the authenticated user
      const anonKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!;
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user }, error: authError } = await authClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      // Prevent user_id spoofing: override with authenticated user's ID
      if (user.id !== user_id) {
        console.warn(`[track-ip] user_id mismatch: body=${user_id} auth=${user.id}`);
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ===== BAN CHECK =====
    if (action === 'check_ban') {
      // Check profile ban
      if (user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_banned, ban_reason')
          .eq('id', user_id)
          .maybeSingle();
        
        if (profile?.is_banned) {
          return new Response(JSON.stringify({ 
            banned: true, 
            reason: profile.ban_reason || 'Your account has been banned.' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Check IP against global_bans
      const { data: ipBan } = await supabase
        .from('global_bans')
        .select('reason')
        .eq('ban_type', 'ip')
        .eq('ban_value', ip)
        .eq('is_active', true)
        .maybeSingle();

      if (ipBan) {
        if (cleanDeviceId) {
          await supabase.from('global_bans').upsert({
            ban_type: 'hwid', ban_value: cleanDeviceId,
            reason: ipBan.reason || 'Linked to a permanently banned network.', is_active: true,
            metadata: { linked_ip: ip },
          }, { onConflict: 'ban_type,ban_value' });
        }
        if (user_id) {
          await Promise.all([
            supabase.from('profiles').update({ is_banned: true, ban_reason: ipBan.reason || 'Permanently banned.', banned_at: new Date().toISOString() }).eq('id', user_id),
            cleanDeviceId ? supabase.from('user_devices').upsert({ user_id, device_id: cleanDeviceId, last_seen_at: new Date().toISOString() }, { onConflict: 'user_id,device_id' }) : Promise.resolve(),
          ]);
        }
        return new Response(JSON.stringify({ 
          banned: true, 
          reason: ipBan.reason || 'Your IP address has been banned.' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (cleanDeviceId) {
        const { data: deviceBan } = await supabase
          .from('global_bans')
          .select('reason')
          .eq('ban_type', 'hwid')
          .eq('ban_value', cleanDeviceId)
          .eq('is_active', true)
          .maybeSingle();
        if (deviceBan) return jsonResponse({ banned: true, reason: deviceBan.reason || 'This device has been permanently banned.' });
      }

      // Check subnet bans
      const { data: allBans } = await supabase
        .from('global_bans')
        .select('ban_value, reason')
        .eq('ban_type', 'subnet')
        .eq('is_active', true);

      for (const ban of allBans || []) {
        if (subnetMatches(ip, ban.ban_value)) {
          if (cleanDeviceId) {
            await supabase.from('global_bans').upsert({
              ban_type: 'hwid', ban_value: cleanDeviceId,
              reason: ban.reason || 'Linked to a permanently banned network.', is_active: true,
              metadata: { linked_subnet: ban.ban_value },
            }, { onConflict: 'ban_type,ban_value' });
          }
          if (user_id) {
            await Promise.all([
              supabase.from('profiles').update({ is_banned: true, ban_reason: ban.reason || 'Permanently banned.', banned_at: new Date().toISOString() }).eq('id', user_id),
              cleanDeviceId ? supabase.from('user_devices').upsert({ user_id, device_id: cleanDeviceId, last_seen_at: new Date().toISOString() }, { onConflict: 'user_id,device_id' }) : Promise.resolve(),
            ]);
          }
          return new Response(JSON.stringify({ 
            banned: true, 
            reason: ban.reason || 'Your network has been banned.' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }


      // Carry an existing ban to a returning account's current IP and browser device.
      // This catches the same account after its VPN is disabled or changed.
      if (user_id) {
        const [{ data: knownIps }, { data: knownDevices }] = await Promise.all([
          supabase.from('user_ips').select('ip_address').eq('user_id', user_id),
          supabase.from('user_devices').select('device_id').eq('user_id', user_id),
        ]);
        const ipValues = (knownIps || []).map((row) => row.ip_address).filter(Boolean);
        const deviceValues = (knownDevices || []).map((row) => row.device_id).filter(Boolean);
        const linkedBans: Array<{ reason: string | null }> = [];
        if (ipValues.length) {
          const { data } = await supabase.from('global_bans').select('reason').eq('ban_type', 'ip').eq('is_active', true).in('ban_value', ipValues).limit(1);
          if (data?.[0]) linkedBans.push(data[0]);
        }
        if (!linkedBans.length && deviceValues.length) {
          const { data } = await supabase.from('global_bans').select('reason').eq('ban_type', 'hwid').eq('is_active', true).in('ban_value', deviceValues).limit(1);
          if (data?.[0]) linkedBans.push(data[0]);
        }
        const linkedBan = linkedBans[0];
        if (linkedBan) {
          const reason = linkedBan.reason || 'This account is permanently banned.';
          const rows: Record<string, unknown>[] = [
            { ban_type: 'ip', ban_value: ip, reason, is_active: true, metadata: { linked_user_id: user_id } },
          ];
          const subnet = getIpv4Subnet(ip);
          if (subnet) rows.push({ ban_type: 'subnet', ban_value: subnet, reason, is_active: true, metadata: { linked_user_id: user_id } });
          if (cleanDeviceId) rows.push({ ban_type: 'hwid', ban_value: cleanDeviceId, reason, is_active: true, metadata: { linked_user_id: user_id } });
          await Promise.all([
            supabase.from('global_bans').upsert(rows, { onConflict: 'ban_type,ban_value' }),
            supabase.from('profiles').update({ is_banned: true, ban_reason: reason, banned_at: new Date().toISOString() }).eq('id', user_id),
          ]);
          return jsonResponse({ banned: true, reason });
        }
      }

      return new Response(JSON.stringify({ banned: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ===== RATE LIMIT CHECK =====
    if (action === 'check_rate_limit') {
      const targetAction = limit_action || 'signup';
      
      // Cooldown windows per action
      const cooldowns: Record<string, number> = {
        'signup': 24 * 60 * 60 * 1000,      // 24 hours
        'login': 60 * 60 * 1000,             // 1 hour (10 attempts)
        'paste_create': 60 * 1000,           // 60 seconds
      };
      const maxCounts: Record<string, number> = {
        'signup': 1,
        'login': 10,
        'paste_create': 5,
      };
      
      const windowMs = cooldowns[targetAction] || 60000;
      const maxCount = maxCounts[targetAction] || 5;
      const windowStart = new Date(Date.now() - windowMs).toISOString();
      
      const { data: existing } = await supabase
        .from('rate_limits')
        .select('count, window_start')
        .eq('identifier', ip)
        .eq('action', targetAction)
        .gte('window_start', windowStart)
        .order('window_start', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (existing && existing.count >= maxCount) {
        return new Response(JSON.stringify({ allowed: false, action: targetAction }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({ allowed: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ===== RECORD SIGNUP (for rate limiting) =====
    if (action === 'record_signup') {
      const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data: existing } = await supabase
        .from('rate_limits')
        .select('id, count')
        .eq('identifier', ip)
        .eq('action', 'signup')
        .gte('window_start', windowStart)
        .order('window_start', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (existing) {
        await supabase.from('rate_limits').update({ count: existing.count + 1 }).eq('id', existing.id);
      } else {
        await supabase.from('rate_limits').insert({ identifier: ip, action: 'signup', count: 1 });
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'register') {
      // On registration, store the IP as primary
      const { error } = await supabase.from('user_ips').insert({
        user_id,
        ip_address: ip,
        is_primary: true
      });
      
      if (error) throw error;

      if (cleanDeviceId) {
        await supabase.from('user_devices').upsert({ user_id, device_id: cleanDeviceId, last_seen_at: new Date().toISOString() }, { onConflict: 'user_id,device_id' });
      }
      
      return new Response(JSON.stringify({ success: true, message: 'IP registered' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (action === 'login') {
      if (cleanDeviceId) {
        await supabase.from('user_devices').upsert({ user_id, device_id: cleanDeviceId, last_seen_at: new Date().toISOString() }, { onConflict: 'user_id,device_id' });
      }
      // First, check if this IP is blocked for this user
      const { data: blockedIp } = await supabase
        .from('blocked_ips')
        .select('id')
        .eq('user_id', user_id)
        .eq('ip_address', ip)
        .single();

      if (blockedIp) {
        return new Response(JSON.stringify({ 
          success: false, 
          allowed: false,
          blocked: true,
          message: 'This device has been blocked from this account' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check if IP matches any registered IP for this user
      const { data: userIps, error: fetchError } = await supabase
        .from('user_ips')
        .select('*')
        .eq('user_id', user_id);
      
      if (fetchError) throw fetchError;
      
      const matchingIp = userIps?.find(record => record.ip_address === ip);
      
      if (matchingIp) {
        // Update last used timestamp
        await supabase.from('user_ips')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', matchingIp.id);
        
        return new Response(JSON.stringify({ 
          success: true, 
          allowed: true,
          message: 'IP verified' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // IP doesn't match - add it to the list but not as primary
      await supabase.from('user_ips').insert({
        user_id,
        ip_address: ip,
        is_primary: false
      });
      
      return new Response(JSON.stringify({ 
        success: true, 
        allowed: true,
        new_ip: true,
        message: 'New IP added to account' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'verify') {
      const { data: userIps, error: fetchError } = await supabase
        .from('user_ips')
        .select('*')
        .eq('user_id', user_id);
      
      if (fetchError) throw fetchError;
      
      const hasMatchingIp = userIps?.some(record => record.ip_address === ip);
      
      return new Response(JSON.stringify({ 
        success: true, 
        ip_matches: hasMatchingIp,
        current_ip: ip
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Error in track-ip function:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
