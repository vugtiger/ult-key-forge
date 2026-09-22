import { createClient } from "npm:@supabase/supabase-js@2";
import { browserRedirectIfHtml } from "../_shared/browserBlock.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Discord OAuth2 endpoints
const DISCORD_AUTH_URL = 'https://discord.com/api/oauth2/authorize';
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';
const DISCORD_USER_URL = 'https://discord.com/api/users/@me';

Deno.serve(async (req) => {
  const _blocked = browserRedirectIfHtml(req);
  if (_blocked) return _blocked;
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const discordClientId = Deno.env.get('DISCORD_APPLICATION_ID');
    const discordClientSecret = Deno.env.get('DISCORD_CLIENT_SECRET');

    const supabase = createClient(supabaseUrl, supabaseKey);

    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('cf-connecting-ip') ||
      'unknown';

    // Prevent OAuth redirect loops: after Discord redirects back to get-paste,
    // we append oauth_ts and get-paste will skip re-redirecting for a short window.
    const buildPasteRedirect = (pasteSlug: string) => {
      const ts = Date.now();
      return `${supabaseUrl}/functions/v1/get-paste?slug=${encodeURIComponent(pasteSlug)}&oauth_ts=${ts}`;
    };

    // Step 1: Initiate Discord OAuth - redirect to Discord
    if (action === 'start') {
      const pasteSlug = url.searchParams.get('slug');

      if (!pasteSlug) {
        return new Response('Missing paste slug', { status: 400, headers: corsHeaders });
      }

      if (!discordClientId) {
        // Discord not configured, redirect directly to paste
        return new Response(null, {
          status: 302,
          headers: {
            ...corsHeaders,
            Location: buildPasteRedirect(pasteSlug),
          },
        });
      }

      // Generate state token for security
      const state = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

      // Store state in database
      await supabase.from('discord_oauth_states').insert({
        state,
        paste_slug: pasteSlug,
        ip_address: clientIp,
        expires_at: expiresAt,
      });

      const redirectUri = `${supabaseUrl}/functions/v1/discord-identify?action=callback`;
      const scope = 'identify';

      const authUrl = new URL(DISCORD_AUTH_URL);
      authUrl.searchParams.set('client_id', discordClientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', scope);
      authUrl.searchParams.set('state', state);
      // Always show the authorize screen
      authUrl.searchParams.set('prompt', 'consent');

      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          Location: authUrl.toString(),
        },
      });
    }

    // Step 2: Handle Discord callback
    if (action === 'callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      // If Discord returned an error (user denied / not logged in)
      if (error) {
        const { data: stateData } = await supabase
          .from('discord_oauth_states')
          .select('paste_slug')
          .eq('state', state)
          .single();

        if (stateData) {
          await supabase.from('discord_oauth_states').delete().eq('state', state);
          return new Response(null, {
            status: 302,
            headers: {
              ...corsHeaders,
              Location: buildPasteRedirect(stateData.paste_slug),
            },
          });
        }

        return new Response('OAuth error', { status: 400, headers: corsHeaders });
      }

      if (!code || !state) {
        return new Response('Missing code or state', { status: 400, headers: corsHeaders });
      }

      // Validate state
      const { data: stateData, error: stateError } = await supabase
        .from('discord_oauth_states')
        .select('*')
        .eq('state', state)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (stateError || !stateData) {
        return new Response('Invalid or expired state', { status: 400, headers: corsHeaders });
      }

      // Clean up state
      await supabase.from('discord_oauth_states').delete().eq('state', state);

      const redirectUri = `${supabaseUrl}/functions/v1/discord-identify?action=callback`;

      // Exchange code for token
      const tokenResponse = await fetch(DISCORD_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: discordClientId!,
          client_secret: discordClientSecret!,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        console.error('Token exchange failed:', await tokenResponse.text());
        return new Response(null, {
          status: 302,
          headers: {
            ...corsHeaders,
            Location: buildPasteRedirect(stateData.paste_slug),
          },
        });
      }

      const tokenData = await tokenResponse.json();

      // Get Discord user info
      const userResponse = await fetch(DISCORD_USER_URL, {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      if (!userResponse.ok) {
        console.error('User fetch failed:', await userResponse.text());
        return new Response(null, {
          status: 302,
          headers: {
            ...corsHeaders,
            Location: buildPasteRedirect(stateData.paste_slug),
          },
        });
      }

      const discordUser = await userResponse.json();

      // Calculate Discord account creation date from snowflake ID
      const discordEpoch = 1420070400000; // Discord epoch (2015-01-01)
      const snowflake = BigInt(discordUser.id);
      const timestamp = Number(snowflake >> 22n) + discordEpoch;
      const createdAt = new Date(timestamp).toISOString();

      // Store Discord session for this IP
      await supabase.from('discord_oauth_sessions').upsert(
        {
          ip_address: clientIp,
          discord_user_id: discordUser.id,
          discord_username: discordUser.username,
          discord_avatar: discordUser.avatar,
          discord_created_at: createdAt,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        },
        {
          onConflict: 'ip_address',
        },
      );

      console.log(`Discord identified: ${discordUser.username} (${discordUser.id}) from IP: ${clientIp}`);

      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          Location: buildPasteRedirect(stateData.paste_slug),
        },
      });
    }

    return new Response('Invalid action', { status: 400, headers: corsHeaders });
  } catch (error) {
    console.error('Discord identify error:', error);
    return new Response('Internal error', { status: 500, headers: corsHeaders });
  }
});

