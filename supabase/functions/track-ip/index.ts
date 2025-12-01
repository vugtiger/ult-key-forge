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
    const { user_id, action } = await req.json();
    
    // Get IP from request headers
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 
               req.headers.get('cf-connecting-ip') || 
               req.headers.get('x-real-ip') || 
               'unknown';

    console.log(`IP tracking for user ${user_id}, action: ${action}, IP: ${ip}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === 'register') {
      // On registration, store the IP as primary
      const { error } = await supabase.from('user_ips').insert({
        user_id,
        ip_address: ip,
        is_primary: true
      });
      
      if (error) throw error;
      
      return new Response(JSON.stringify({ success: true, message: 'IP registered' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (action === 'login') {
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
      
      // IP doesn't match - this is a new device/location
      // Add it to the list but not as primary
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
      // Check if IP matches
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
