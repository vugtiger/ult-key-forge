// Nebula Discord bot — full Luarmor-parity slash command registration
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STR = 3, INT = 4;

const commands = [
  { name: "ping", description: "Check that Nebula is alive" },
  { name: "help", description: "Show all Nebula commands" },

  // Account
  { name: "link", description: "Link your Discord to a Nebula web account",
    options: [{ name: "code", description: "6-digit code from /v2/settings", type: STR, required: true }] },
  { name: "unlink", description: "Unlink your Discord" },
  { name: "me", description: "Show your linked Nebula account" },

  // Projects
  { name: "projects", description: "List your projects" },
  { name: "newproject", description: "Create a project",
    options: [{ name: "name", description: "Project name", type: STR, required: true }] },
  { name: "delproject", description: "Delete a project (irreversible)",
    options: [{ name: "name", description: "Project name", type: STR, required: true }] },

  // Keys — full Luarmor parity
  { name: "keygen", description: "Generate keys",
    options: [
      { name: "project", description: "Project name", type: STR, required: true },
      { name: "amount", description: "How many (1-100)", type: INT, required: true, min_value: 1, max_value: 100 },
      { name: "days", description: "Days until expiry (0 = permanent)", type: INT, required: false, min_value: 0, max_value: 3650 },
      { name: "note", description: "Optional note", type: STR, required: false },
    ]},
  { name: "keys", description: "List recent keys for a project",
    options: [{ name: "project", description: "Project name", type: STR, required: true }] },
  { name: "keyinfo", description: "Show details for a single key",
    options: [{ name: "key", description: "Key value", type: STR, required: true }] },
  { name: "revoke", description: "Revoke a key",
    options: [{ name: "key", description: "Key value", type: STR, required: true }] },
  { name: "unrevoke", description: "Re-activate a revoked key",
    options: [{ name: "key", description: "Key value", type: STR, required: true }] },
  { name: "resethwid", description: "Reset HWID lock on a key",
    options: [{ name: "key", description: "Key value", type: STR, required: true }] },
  { name: "extend", description: "Extend a key's expiry",
    options: [
      { name: "key", description: "Key value", type: STR, required: true },
      { name: "days", description: "Days to add", type: INT, required: true, min_value: 1 },
    ]},
  { name: "transfer", description: "Transfer a key to a new HWID owner",
    options: [
      { name: "key", description: "Key value", type: STR, required: true },
      { name: "newhwid", description: "New HWID", type: STR, required: true },
    ]},
  { name: "whitelist", description: "Whitelist a Discord user with a free key",
    options: [
      { name: "project", description: "Project name", type: STR, required: true },
      { name: "user", description: "Discord user", type: 6, required: true },
      { name: "days", description: "Days valid (0 = permanent)", type: INT, required: false },
    ]},

  // Moderation
  { name: "blacklist", description: "Blacklist a HWID/IP/Discord ID/Roblox ID",
    options: [
      { name: "project", description: "Project name", type: STR, required: true },
      { name: "type", description: "Type", type: STR, required: true, choices: [
        { name: "HWID", value: "hwid" }, { name: "IP", value: "ip" },
        { name: "Discord ID", value: "discord_id" }, { name: "Roblox User ID", value: "user_id" }] },
      { name: "value", description: "Value to block", type: STR, required: true },
      { name: "reason", description: "Reason", type: STR, required: false },
    ]},
  { name: "unblacklist", description: "Remove a blacklist entry",
    options: [
      { name: "project", description: "Project name", type: STR, required: true },
      { name: "value", description: "Value to unblock", type: STR, required: true },
    ]},

  // Analytics & insight
  { name: "stats", description: "Show project stats",
    options: [{ name: "project", description: "Project name", type: STR, required: true }] },
  { name: "execstats", description: "Show 7-day exec stats",
    options: [{ name: "project", description: "Project name", type: STR, required: true }] },
  { name: "userlookup", description: "Look up a user by HWID, key, or Discord ID",
    options: [{ name: "query", description: "Value to search", type: STR, required: true }] },

  // Resellers
  { name: "addreseller", description: "Add a reseller for a project",
    options: [
      { name: "user", description: "Discord user (must be linked)", type: 6, required: true },
      { name: "project", description: "Project name", type: STR, required: true },
    ]},
  { name: "removereseller", description: "Remove a reseller",
    options: [{ name: "user", description: "Discord user", type: 6, required: true }] },

  // API
  { name: "apitoken", description: "Generate an API token (sent via DM)",
    options: [{ name: "name", description: "Token label", type: STR, required: true }] },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const TOKEN = Deno.env.get("V2_DISCORD_BOT_TOKEN");
    const APP_ID = Deno.env.get("V2_DISCORD_APPLICATION_ID");
    if (!TOKEN || !APP_ID) throw new Error("Missing V2 Discord credentials");

    const r = await fetch(`https://discord.com/api/v10/applications/${APP_ID}/commands`, {
      method: "PUT",
      headers: { "Authorization": `Bot ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
    });
    const result = await r.json();
    if (!r.ok) {
      console.error("Discord error:", result);
      return new Response(JSON.stringify({ error: result }), { status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ success: true, count: result.length, commands: result.map((c: any) => c.name) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
