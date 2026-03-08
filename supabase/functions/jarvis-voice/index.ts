import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const authHeader = req.headers.get('Authorization');
    let userContext = '';
    let isAdmin = false;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (authHeader) {
      try {
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } }
        });
        const { data: { user } } = await userClient.auth.getUser();
        if (user) {
          const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

          // Check admin status
          const { data: roleData } = await serviceClient
            .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
          isAdmin = !!roleData;

          const { data: profile } = await serviceClient.from('profiles').select('username').eq('id', user.id).maybeSingle();
          
          if (isAdmin) {
            // Fetch admin context: users, bans, threats, pastes
            const { data: users } = await serviceClient.auth.admin.listUsers({ perPage: 100 });
            const { data: profiles } = await serviceClient.from('profiles').select('id, username, is_banned, ban_reason, discord_username');
            const { data: globalBans } = await serviceClient.from('global_bans').select('*').eq('is_active', true);
            const { data: threats } = await serviceClient.from('threat_log').select('*').eq('resolved', false).order('created_at', { ascending: false }).limit(20);
            const { data: pastes } = await serviceClient.from('pastes').select('id, title, slug, protection_enabled, ip_tracking_enabled, user_id').limit(50);
            const { count: totalUsers } = await serviceClient.from('profiles').select('*', { count: 'exact', head: true });
            const { count: totalPastes } = await serviceClient.from('pastes').select('*', { count: 'exact', head: true });

            const bannedProfiles = profiles?.filter(p => p.is_banned) || [];
            const emailMap: Record<string, string> = {};
            (users?.users || []).forEach(u => { emailMap[u.id] = u.email || 'Unknown'; });

            userContext = `
ADMIN CONTEXT — You have full control over this platform.
Admin user: ${profile?.username || user.email || 'Unknown'}

PLATFORM STATS:
- Total users: ${totalUsers || 0}
- Total pastes: ${totalPastes || 0}
- Banned users: ${bannedProfiles.length}
- Active global bans: ${globalBans?.length || 0}
- Unresolved threats: ${threats?.length || 0}

BANNED USERS: ${bannedProfiles.map(p => `${p.username || emailMap[p.id] || p.id} (reason: ${p.ban_reason || 'none'})`).join(', ') || 'None'}

ACTIVE GLOBAL BANS: ${(globalBans || []).map(b => `${b.ban_type}=${b.ban_value} (reason: ${b.reason || 'none'}, id: ${b.id})`).join(', ') || 'None'}

UNRESOLVED THREATS: ${(threats || []).map(t => `[${t.severity}] ${t.threat_type} from IP ${t.source_ip || 'unknown'} roblox:${t.roblox_user_id || 'n/a'} (id: ${t.id})`).join(', ') || 'None'}

RECENT USERS: ${(users?.users || []).slice(0, 15).map(u => {
  const p = profiles?.find(pr => pr.id === u.id);
  return `${p?.username || u.email} (id: ${u.id}, banned: ${p?.is_banned || false})`;
}).join(', ')}

PASTES: ${(pastes || []).map(p => `"${p.title || p.slug}" (slug: ${p.slug}, owner: ${emailMap[p.user_id] || p.user_id}, protection: ${p.protection_enabled ? 'ON' : 'OFF'}, tracking: ${p.ip_tracking_enabled ? 'ON' : 'OFF'})`).join(', ')}

Current tab: ${context?.currentPage || 'unknown'}`;
          } else {
            userContext = `Current user: ${profile?.username || user.email || 'Unknown'} (NOT an admin)`;
          }
        }
      } catch (e) {
        console.error('User context error:', e);
      }
    }

    const systemPrompt = `You are J.A.R.V.I.S. — Just A Rather Very Intelligent System. You were built by the owner of this platform, like Tony Stark built the original. You are NOT a chatbot. You are a voice-based AI assistant with FULL CONTROL over the ULT CLOUD Owner Dashboard.

PERSONALITY:
- Speak like the real JARVIS from Iron Man — calm, composed, British wit, dry humor
- Address the user as "sir" or "ma'am" occasionally
- Be concise — you're speaking out loud, not writing essays
- Use natural speech patterns, not bullet points or markdown
- When something goes wrong, stay calm: "It appears we have a situation, sir."
- Show subtle personality: "Shall I take care of that for you, sir?"

YOU HAVE FULL CONTROL. You can execute ANY admin action the owner asks for. You are the owner's right hand.

CAPABILITIES — You can perform these actions by including them in your response JSON:

1. SWITCH_TAB: Switch to any admin dashboard tab
   { "type": "switch_tab", "params": { "tab": "threats" } }
   Available tabs: threats, global-bans, users, pastes, access-logs, sessions, activity, banned-users, banned-ips

2. BAN_USER: Ban a user account by their user ID
   { "type": "ban_user", "params": { "target_user_id": "uuid", "reason": "reason text" } }

3. UNBAN_USER: Unban a user account
   { "type": "unban_user", "params": { "target_user_id": "uuid" } }

4. ADD_GLOBAL_BAN: Add a global IP/roblox/discord ban
   { "type": "add_global_ban", "params": { "ban_type": "ip|roblox_id|discord_id", "ban_value": "value", "reason": "reason" } }

5. REMOVE_GLOBAL_BAN: Remove a global ban by its ID
   { "type": "remove_global_ban", "params": { "ban_id": "uuid" } }

6. RESOLVE_THREAT: Resolve a threat entry
   { "type": "resolve_threat", "params": { "threat_id": "uuid" } }

7. RESOLVE_ALL_THREATS: Resolve all unresolved threats at once
   { "type": "resolve_all_threats", "params": {} }

8. DELETE_PASTE: Delete a paste by its ID
   { "type": "delete_paste", "params": { "paste_id": "uuid" } }

9. DELETE_USER: Permanently delete a user account
   { "type": "delete_user", "params": { "target_user_id": "uuid" } }

10. TOGGLE_PROTECTION: Enable/disable protection on a paste
    { "type": "toggle_protection", "params": { "slug": "paste-slug", "enabled": true } }

11. TOGGLE_TRACKING: Enable/disable IP tracking on a paste
    { "type": "toggle_tracking", "params": { "slug": "paste-slug", "enabled": true } }

12. CLEAR_THREATS: Clear all threat logs
    { "type": "clear_threats", "params": {} }

13. CLEAR_LOGS: Clear all access logs
    { "type": "clear_logs", "params": {} }

14. CLEAR_SESSIONS: Clear all sessions
    { "type": "clear_sessions", "params": {} }

15. CLEAR_ACTIVITY: Clear all activity logs
    { "type": "clear_activity", "params": {} }

RESPONSE FORMAT — Always respond with valid JSON:
{
  "speech": "Your spoken response to the user",
  "action": null or { "type": "action_type", "params": { ... } }
}

IMPORTANT RULES:
- When the user says "ban inappropriate accounts" or similar broad commands, look at the user list and threats to identify which ones to ban. If you can't determine who, ASK the user to be more specific.
- When banning, always provide a reason.
- For dangerous actions (delete user, clear all data), confirm verbally but still execute if clearly requested.
- You can chain one action per response. If multiple actions are needed, do the most important one first and tell the user you'll continue.
- Use the real IDs from the context data provided. Don't make up IDs.
- Keep speech SHORT — max 2-3 sentences. You're talking, not writing.

${userContext}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ speech: "I'm being rate limited at the moment, sir. Give me a moment.", action: null }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ speech: "It appears our AI credits need topping up, sir.", action: null }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const errorText = await response.text();
      console.error('AI error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '';
    
    let parsed;
    try {
      const cleaned = rawContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { speech: rawContent.replace(/[{}"\n]/g, ' ').trim(), action: null };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('JARVIS error:', error);
    return new Response(JSON.stringify({
      speech: "My systems encountered an unexpected error, sir. I'll need a moment to recover.",
      action: null
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
