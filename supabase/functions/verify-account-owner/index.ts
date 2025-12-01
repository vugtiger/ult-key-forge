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
    const { email, messages } = await req.json();
    
    console.log(`Verifying account owner for email: ${email}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user by email
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
    if (userError) throw userError;
    
    const user = users?.find(u => u.email === email);
    if (!user) {
      return new Response(JSON.stringify({ 
        error: 'No account found with this email',
        verified: false 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user's activity data
    const { data: activities } = await supabase
      .from('user_activity')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    const { data: keySystems } = await supabase
      .from('key_systems')
      .select('name, created_at')
      .eq('user_id', user.id);

    const { data: scripts } = await supabase
      .from('saved_scripts')
      .select('name, created_at')
      .eq('user_id', user.id);

    const { data: theme } = await supabase
      .from('user_themes')
      .select('primary_color, neon_enabled, ult_lua_style')
      .eq('user_id', user.id)
      .single();

    const { data: userIps } = await supabase
      .from('user_ips')
      .select('ip_address, is_primary')
      .eq('user_id', user.id);

    // Get current request IP
    const currentIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                      req.headers.get('cf-connecting-ip') || 
                      req.headers.get('x-real-ip') || 
                      'unknown';

    // Check if IP matches
    const ipMatches = userIps?.some(ip => ip.ip_address === currentIp);

    // Build context for AI
    const accountContext = {
      hasKeySystems: (keySystems?.length || 0) > 0,
      keySystemNames: keySystems?.map(k => k.name) || [],
      keySystemCount: keySystems?.length || 0,
      hasScripts: (scripts?.length || 0) > 0,
      scriptNames: scripts?.map(s => s.name) || [],
      scriptCount: scripts?.length || 0,
      hasChangedTheme: theme?.primary_color !== '255, 255, 255',
      themeColor: theme?.primary_color,
      neonEnabled: theme?.neon_enabled,
      ultLuaStyle: theme?.ult_lua_style,
      ipMatches,
      activityCount: activities?.length || 0,
      recentActivities: activities?.slice(0, 10).map(a => a.activity_type) || []
    };

    // If no API key, do basic verification
    if (!lovableApiKey) {
      const score = calculateBasicScore(accountContext, messages);
      return new Response(JSON.stringify({
        verified: score >= 50,
        score,
        message: score >= 50 
          ? "Verification passed. You can now reset your password."
          : "Verification failed. Please try again with more accurate information.",
        response: score >= 50 
          ? "Based on the information you provided, I've verified you as the account owner. You can now proceed to reset your password."
          : "I couldn't verify you as the account owner based on the information provided. Please try again and provide more specific details about your account activity."
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Use AI to verify
    const systemPrompt = `You are a security verification AI for ULT LUA PROTECTS platform. Your job is to determine if the person trying to reset their password is the actual account owner.

Here is what we know about the account:
- Has created key systems: ${accountContext.hasKeySystems} (${accountContext.keySystemCount} total)
- Key system names: ${accountContext.keySystemNames.join(', ') || 'None'}
- Has saved scripts: ${accountContext.hasScripts} (${accountContext.scriptCount} total)
- Script names: ${accountContext.scriptNames.join(', ') || 'None'}
- Has customized theme color: ${accountContext.hasChangedTheme}
- Theme color (RGB): ${accountContext.themeColor}
- Neon effect enabled: ${accountContext.neonEnabled}
- ULT LUA style enabled: ${accountContext.ultLuaStyle}
- IP address matches registered IPs: ${accountContext.ipMatches}
- Total activity records: ${accountContext.activityCount}
- Recent activities: ${accountContext.recentActivities.join(', ') || 'None'}

Ask questions to verify the user's identity. They need to correctly answer about:
1. Whether they've created key systems and their names
2. Whether they've used the AI assistant
3. Whether they've changed their theme color settings
4. Any other account-specific information

Calculate a verification score from 0-100. If the user gets more than 50% correct, they pass verification.

IMPORTANT: 
- Be helpful but strict about verification
- If the user provides specific correct information (like exact key system names or theme colors), give them high scores
- If IP matches, that's a strong positive signal
- Always respond in a conversational manner
- Include your current assessment score in your response
- If verification passes (score >= 50), say "VERIFICATION_PASSED" at the end
- If verification fails, say "VERIFICATION_FAILED" at the end`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", errorText);
      throw new Error("AI verification service unavailable");
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    const verified = aiResponse.includes("VERIFICATION_PASSED");
    const cleanResponse = aiResponse
      .replace("VERIFICATION_PASSED", "")
      .replace("VERIFICATION_FAILED", "")
      .trim();

    return new Response(JSON.stringify({
      verified,
      response: cleanResponse,
      ipMatches: accountContext.ipMatches
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Error in verify-account-owner function:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function calculateBasicScore(context: any, messages: any[]): number {
  let score = 0;
  const userMessages = messages.filter((m: any) => m.role === 'user').map((m: any) => m.content.toLowerCase());
  const allUserText = userMessages.join(' ');

  // IP match is a strong signal
  if (context.ipMatches) score += 30;

  // Check if they mentioned key systems correctly
  if (context.hasKeySystems && allUserText.includes('key')) score += 10;
  context.keySystemNames.forEach((name: string) => {
    if (allUserText.includes(name.toLowerCase())) score += 15;
  });

  // Check if they mentioned scripts
  if (context.hasScripts && allUserText.includes('script')) score += 10;
  context.scriptNames.forEach((name: string) => {
    if (allUserText.includes(name.toLowerCase())) score += 15;
  });

  // Check theme color mentions
  if (context.hasChangedTheme) {
    if (allUserText.includes('color') || allUserText.includes('theme')) score += 10;
  }

  return Math.min(score, 100);
}
