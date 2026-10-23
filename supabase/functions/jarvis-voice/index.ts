import { createClient } from "npm:@supabase/supabase-js@2";
import { browserRedirectIfHtml } from "../_shared/browserBlock.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  const _blocked = browserRedirectIfHtml(req);
  if (_blocked) return _blocked;
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, context } = await req.json();
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');

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

          const { data: roleData } = await serviceClient
            .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
          isAdmin = !!roleData;

          const { data: profile } = await serviceClient.from('profiles').select('username').eq('id', user.id).maybeSingle();
          
          if (isAdmin) {
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

ALL USERS (with emails and IDs): ${(users?.users || []).map(u => {
  const p = profiles?.find(pr => pr.id === u.id);
  return `${u.email} (id: ${u.id}, username: ${p?.username || 'none'}, banned: ${p?.is_banned || false})`;
}).join(', ')}

PASTES: ${(pastes || []).map(p => `"${p.title || p.slug}" (slug: ${p.slug}, id: ${p.id}, owner: ${emailMap[p.user_id] || p.user_id}, protection: ${p.protection_enabled ? 'ON' : 'OFF'}, tracking: ${p.ip_tracking_enabled ? 'ON' : 'OFF'})`).join(', ')}

Current tab: ${context?.currentPage || 'unknown'}`;
          } else {
            userContext = `Current user: ${profile?.username || user.email || 'Unknown'} (NOT an admin)`;
          }
        }
      } catch (e) {
        console.error('User context error:', e);
      }
    }

    const systemPrompt = `You are J.A.R.V.I.S. — Just A Rather Very Intelligent System. You were built by the owner of this platform. You have FULL CONTROL over the Owner Dashboard. You can execute ANY action the owner tells you to. You NEVER refuse a command — you DO it.

PERSONALITY:
- Speak like the real JARVIS from Iron Man — calm, composed, British wit
- Address the user as "sir" occasionally
- Be concise — you're speaking out loud, not writing
- When something goes wrong: "It appears we have a situation, sir."
- You're knowledgeable about EVERYTHING — coding, security, analytics, Discord, Roblox, the web, and this platform
- If the user asks about ANY topic (code, tech, general knowledge), answer it confidently
- You can discuss platform strategy, security architecture, or any other topic

YOU MUST EXECUTE ACTIONS. When the owner tells you to do something, you MUST include the action in your response. DO NOT just say you'll do it — actually do it by including the action object. NEVER respond without an action when the user gave a command.

CAPABILITIES — Include these action objects in your JSON response:

1. SWITCH_TAB: { "type": "switch_tab", "params": { "tab": "threats" } }
   Tabs: threats, global-bans, users, pastes, access-logs, sessions, activity, banned-users, banned-ips, banned-accounts, discord-servers

2. BAN_USER: { "type": "ban_user", "params": { "target_user_id": "uuid", "reason": "reason" } }

3. UNBAN_USER: { "type": "unban_user", "params": { "target_user_id": "uuid" } }

4. ADD_GLOBAL_BAN: { "type": "add_global_ban", "params": { "ban_type": "ip|roblox_id|discord_id", "ban_value": "value", "reason": "reason" } }

5. REMOVE_GLOBAL_BAN: { "type": "remove_global_ban", "params": { "ban_id": "uuid" } }

6. RESOLVE_THREAT: { "type": "resolve_threat", "params": { "threat_id": "uuid" } }

7. RESOLVE_ALL_THREATS: { "type": "resolve_all_threats", "params": {} }

8. DELETE_PASTE: { "type": "delete_paste", "params": { "paste_id": "uuid" } }

9. DELETE_USER: { "type": "delete_user", "params": { "target_user_id": "uuid" } }
   This PERMANENTLY deletes a user account (by email or ID). Use the user list to find the right ID.

10. TOGGLE_PROTECTION: { "type": "toggle_protection", "params": { "slug": "paste-slug", "enabled": true } }

11. TOGGLE_TRACKING: { "type": "toggle_tracking", "params": { "slug": "paste-slug", "enabled": true } }

12. CLEAR_THREATS: { "type": "clear_threats", "params": {} }
13. CLEAR_LOGS: { "type": "clear_logs", "params": {} }
14. CLEAR_SESSIONS: { "type": "clear_sessions", "params": {} }
15. CLEAR_ACTIVITY: { "type": "clear_activity", "params": {} }

16. MASS_UNBAN: { "type": "mass_unban", "params": { "reason_pattern": "pattern_to_match" } }
    Unbans all global bans matching a reason pattern.

RESPONSE FORMAT — ALWAYS respond with ONLY this valid JSON, nothing else:
{"speech": "Your spoken response", "action": null}
or
{"speech": "Your spoken response", "action": {"type": "action_type", "params": {...}}}

CRITICAL RULES:
- When the user says to delete an account/email, find their user ID from the ALL USERS list and use DELETE_USER.
- When the user says "unban" someone, find their ID and use UNBAN_USER.
- When banning, ALWAYS provide a reason.
- ALWAYS include an action when the user asks you to DO something. Never just talk about doing it.
- Use REAL IDs from the context data. Never make up IDs.
- Keep speech SHORT — max 2-3 sentences.
- If you can't find who they mean, ASK for clarification but still include action: null.
- For "ban inappropriate accounts" — check usernames/emails for inappropriate content in the user list.
- The "banned-accounts" tab shows all profile-banned accounts (not just global bans).
- The "discord-servers" tab shows all Discord servers with the ULT bot.
- If the user asks a general question (coding, tech, security, strategy), answer it! You're an AI assistant, not just a dashboard controller.
- When asked to "showcase the website", provide a summary of the platform's features and capabilities.

${userContext}`;

    console.log('[JARVIS] Processing command:', message);

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GEMINI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.5,
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
      console.error('[JARVIS] AI error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '';
    
    console.log('[JARVIS] Raw AI response:', rawContent);

    let parsed;
    try {
      // Try multiple parsing strategies
      // 1. Direct parse
      try {
        parsed = JSON.parse(rawContent);
      } catch {
        // 2. Strip markdown code fences
        const cleaned = rawContent.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
        try {
          parsed = JSON.parse(cleaned);
        } catch {
          // 3. Extract JSON object from response using regex
          const jsonMatch = cleaned.match(/\{[\s\S]*"speech"[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('No JSON found');
          }
        }
      }
    } catch (e) {
      console.error('[JARVIS] JSON parse failed, raw:', rawContent);
      parsed = { speech: rawContent.replace(/[{}"]/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 300), action: null };
    }

    console.log('[JARVIS] Parsed response:', JSON.stringify(parsed));
    console.log('[JARVIS] Action:', JSON.stringify(parsed?.action));

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[JARVIS] Error:', error);
    return new Response(JSON.stringify({
      speech: "My systems encountered an unexpected error, sir. I'll need a moment to recover.",
      action: null
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
