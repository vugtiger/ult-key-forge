import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function parseCookies(cookieHeader: string | null) {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) continue;
    out[k] = decodeURIComponent(v);
  }
  return out;
}

function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

function discordCreatedAtFromSnowflake(id: string): string | null {
  try {
    const snowflake = BigInt(id);
    const timestamp = Number((snowflake >> 22n) + 1420070400000n);
    return new Date(timestamp).toISOString();
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code || !state) {
      return new Response("Missing code/state", {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate state
    const { data: stateRow, error: stateErr } = await supabase
      .from("discord_oauth_states")
      .select("slug, used_at")
      .eq("state", state)
      .maybeSingle();

    if (stateErr || !stateRow || stateRow.used_at) {
      return new Response("Invalid/used state", {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const clientId = Deno.env.get("DISCORD_APPLICATION_ID")!;
    const clientSecret = Deno.env.get("DISCORD_CLIENT_SECRET")!;

    // Must exactly match the redirect URI configured on Discord app
    const redirectUri = `${url.origin}/functions/v1/discord-oauth-callback`;

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    });

    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const tokenText = await tokenRes.text();
    if (!tokenRes.ok) {
      console.error("Discord token exchange failed:", tokenRes.status, tokenText);
      return new Response("Failed to exchange token", {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const tokenJson = JSON.parse(tokenText);
    const accessToken = tokenJson.access_token as string | undefined;

    if (!accessToken) {
      console.error("Discord token response missing access_token:", tokenJson);
      return new Response("Failed to exchange token", {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const meRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const meText = await meRes.text();
    if (!meRes.ok) {
      console.error("Discord /users/@me failed:", meRes.status, meText);
      return new Response("Failed to fetch Discord user", {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const me = JSON.parse(meText);
    const discordUserId = String(me.id);
    const discordUsername = me.username ? String(me.username) : null;
    const discordAvatar = me.avatar ? String(me.avatar) : null;
    const discordCreatedAt = discordCreatedAtFromSnowflake(discordUserId);

    const sessionToken = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: insertErr } = await supabase.from("discord_oauth_sessions").insert({
      token: sessionToken,
      discord_user_id: discordUserId,
      discord_username: discordUsername,
      discord_avatar: discordAvatar,
      discord_created_at: discordCreatedAt,
      expires_at: expiresAt,
    });

    if (insertErr) {
      console.error("Failed to insert discord_oauth_sessions:", insertErr);
      return new Response("Failed to create session", {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    await supabase
      .from("discord_oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("state", state)
      .is("used_at", null);

    const cookies = parseCookies(req.headers.get("cookie"));
    void cookies; // (reserved)

    const maxAge = 7 * 24 * 60 * 60;
    const setCookie = `dsc=${encodeURIComponent(sessionToken)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;

    const redirectTo = `${url.origin}/functions/v1/get-paste?slug=${encodeURIComponent(stateRow.slug)}`;

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: redirectTo,
        "Set-Cookie": setCookie,
      },
    });
  } catch (err) {
    console.error("discord-oauth-callback error:", err);
    return new Response("Internal error", {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }
});
