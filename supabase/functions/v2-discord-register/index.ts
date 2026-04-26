// v2 Discord bot — slash command registration
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const commands = [
  { name: "ping", description: "Check that the v2 bot is alive" },
  { name: "link", description: "Link your Discord to a v2 web account",
    options: [{ name: "code", description: "6-digit code from your v2 settings page", type: 3, required: true }] },
  { name: "unlink", description: "Unlink your Discord from your v2 account" },
  { name: "me", description: "Show your linked v2 account" },
  { name: "projects", description: "List your v2 projects" },
  { name: "newproject", description: "Create a v2 project",
    options: [{ name: "name", description: "Project name", type: 3, required: true }] },
  { name: "keygen", description: "Generate keys in a project",
    options: [
      { name: "project", description: "Project name", type: 3, required: true },
      { name: "amount", description: "How many keys (1-100)", type: 4, required: true, min_value: 1, max_value: 100 },
      { name: "days", description: "Days until expiry (0 = permanent)", type: 4, required: false, min_value: 0, max_value: 3650 },
    ]
  },
  { name: "keys", description: "List recent keys in a project",
    options: [{ name: "project", description: "Project name", type: 3, required: true }] },
  { name: "revoke", description: "Revoke a key by value",
    options: [{ name: "key", description: "Key value", type: 3, required: true }] },
  { name: "blacklist", description: "Add an entry to a project's blacklist",
    options: [
      { name: "project", description: "Project name", type: 3, required: true },
      { name: "type", description: "Type", type: 3, required: true,
        choices: [
          { name: "HWID", value: "hwid" }, { name: "IP", value: "ip" },
          { name: "Discord ID", value: "discord_id" }, { name: "Roblox User ID", value: "user_id" }
        ]
      },
      { name: "value", description: "Value to block", type: 3, required: true },
      { name: "reason", description: "Reason", type: 3, required: false },
    ]
  },
  { name: "stats", description: "Show stats for a project",
    options: [{ name: "project", description: "Project name", type: 3, required: true }] },
  { name: "help", description: "Show all v2 bot commands" },
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
    return new Response(JSON.stringify({ success: true, commands: result.map((c: any) => c.name) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
