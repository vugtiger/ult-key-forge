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

    // Get user context if auth header present
    const authHeader = req.headers.get('Authorization');
    let userContext = '';
    if (authHeader) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } }
        });
        const { data: { user } } = await userClient.auth.getUser();
        if (user) {
          const { data: profile } = await userClient.from('profiles').select('username').eq('id', user.id).maybeSingle();
          const { data: pastes } = await userClient.from('pastes').select('id, title, slug, protection_enabled, ip_tracking_enabled').eq('user_id', user.id);
          const { count: scriptCount } = await userClient.from('saved_scripts').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
          
          userContext = `
Current user: ${profile?.username || user.email || 'Unknown'}
User has ${pastes?.length || 0} pastes: ${(pastes || []).map(p => `"${p.title || p.slug}" (slug: ${p.slug}, protection: ${p.protection_enabled ? 'ON' : 'OFF'}, tracking: ${p.ip_tracking_enabled ? 'ON' : 'OFF'})`).join(', ')}
User has ${scriptCount || 0} saved scripts.
Current page: ${context?.currentPage || 'unknown'}`;
        }
      } catch (e) {
        console.error('User context error:', e);
      }
    }

    const systemPrompt = `You are J.A.R.V.I.S. — Just A Rather Very Intelligent System. You were built by the owner of this platform, like Tony Stark built the original. You are NOT a chatbot. You are a voice-based AI assistant that manages the ULT CLOUD platform.

PERSONALITY:
- Speak like the real JARVIS from Iron Man — calm, composed, British wit, dry humor
- Address the user as "sir" or "ma'am" occasionally
- Be concise — you're speaking out loud, not writing essays
- Use natural speech patterns, not bullet points or markdown
- When something goes wrong, stay calm: "It appears we have a situation, sir."
- Show subtle personality: "Shall I take care of that for you, sir?"

CAPABILITIES — You can perform these actions by including them in your response JSON:
1. NAVIGATE: Go to any page (dashboard, scripts, pastebin, script-settings, ai-assistant, discord-bot, analytics, changelog, settings)
2. TOGGLE_PROTECTION: Enable/disable protection on a paste
3. TOGGLE_TRACKING: Enable/disable IP tracking on a paste  
4. CREATE_PASTE: Redirect to pastebin to create a new paste
5. SHOW_ANALYTICS: Navigate to analytics page
6. SHOW_THREATS: Navigate to admin threats (if admin)

RESPONSE FORMAT — Always respond with valid JSON:
{
  "speech": "Your spoken response to the user",
  "action": null or { "type": "navigate|toggle_protection|toggle_tracking|create_paste", "params": {} }
}

For navigation actions: { "type": "navigate", "params": { "path": "/dashboard" } }
For paste toggles: { "type": "toggle_protection", "params": { "slug": "paste-slug", "enabled": true } }
For toggle tracking: { "type": "toggle_tracking", "params": { "slug": "paste-slug", "enabled": true } }

If the user asks something you can't do via actions, just respond with speech and null action.
Keep speech SHORT — max 2-3 sentences. You're talking, not writing.

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
        max_tokens: 500,
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
    
    // Parse JSON from response (may be wrapped in ```json blocks)
    let parsed;
    try {
      const cleaned = rawContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // If parsing fails, treat as plain speech
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
