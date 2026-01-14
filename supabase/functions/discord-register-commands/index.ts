import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const commands = [
  {
    name: "register",
    description: "Create a new ULT LUA PROTECTS account",
    options: [
      { name: "email", description: "Your email address", type: 3, required: true },
      { name: "password", description: "Your password (min 6 characters)", type: 3, required: true }
    ]
  },
  {
    name: "login",
    description: "Link your existing account to Discord",
    options: [
      { name: "email", description: "Your email address", type: 3, required: true },
      { name: "password", description: "Your password", type: 3, required: true }
    ]
  },
  {
    name: "logout",
    description: "Unlink your Discord from your account"
  },
  {
    name: "keysystemgen",
    description: "Generate a key system (DMs you the file)",
    options: [
      { name: "keys", description: "Number of keys to generate (1-1000)", type: 4, required: true, min_value: 1, max_value: 1000 },
      { name: "color", description: "UI theme color RGB (e.g., 255, 0, 0)", type: 3, required: true },
      { name: "name", description: "Key system name", type: 3, required: true }
    ]
  },
  {
    name: "mykeys",
    description: "View your generated key systems"
  },
  {
    name: "savescript",
    description: "Save a script to your account",
    options: [
      { name: "name", description: "Script name", type: 3, required: true },
      { name: "file", description: "Script file to upload", type: 11, required: true }
    ]
  },
  {
    name: "scripts",
    description: "View your saved scripts"
  },
  {
    name: "paste",
    description: "Create a paste (DMs you the raw URL)",
    options: [
      { name: "name", description: "Paste title", type: 3, required: true },
      { name: "file", description: "File to paste", type: 11, required: true }
    ]
  },
  {
    name: "mypastes",
    description: "View your pastes"
  },
  {
    name: "scriptprotection",
    description: "Toggle protection on a paste",
    options: [
      { name: "paste", description: "Paste name/title", type: 3, required: true },
      { name: "enabled", description: "Enable or disable protection", type: 5, required: true }
    ]
  },
  {
    name: "whitelist",
    description: "Add a Roblox user ID to paste whitelist",
    options: [
      { name: "paste", description: "Paste name/title", type: 3, required: true },
      { name: "userid", description: "Roblox user ID to whitelist", type: 3, required: true }
    ]
  },
  {
    name: "blacklist",
    description: "Add a Roblox user ID to paste blacklist",
    options: [
      { name: "paste", description: "Paste name/title", type: 3, required: true },
      { name: "userid", description: "Roblox user ID to blacklist", type: 3, required: true }
    ]
  },
  {
    name: "setwhitelisttime",
    description: "Set expiration time for a whitelisted user",
    options: [
      { name: "paste", description: "Paste name/title", type: 3, required: true },
      { name: "userid", description: "Roblox user ID", type: 3, required: true },
      { name: "eternal", description: "Set to eternal (never expires)", type: 5, required: false },
      { name: "minutes", description: "Minutes until expiration", type: 4, required: false },
      { name: "hours", description: "Hours until expiration", type: 4, required: false },
      { name: "days", description: "Days until expiration", type: 4, required: false }
    ]
  },
  {
    name: "stats",
    description: "View paste execution statistics",
    options: [
      { name: "paste", description: "Paste name/title", type: 3, required: true }
    ]
  },
  {
    name: "factoryreset",
    description: "Wipe all your data (key systems, scripts, pastes) - account stays"
  },
  {
    name: "profile",
    description: "View your profile and stats"
  },
  {
    name: "ai",
    description: "Chat with the AI assistant",
    options: [
      { name: "enabled", description: "Enable or disable AI (True/False)", type: 5, required: true },
      { name: "message", description: "Your message/question for the AI", type: 3, required: false }
    ]
  },
  {
    name: "panel",
    description: "Create a control panel for your paste",
    options: [
      { name: "name", description: "Control panel name", type: 3, required: true },
      { name: "paste", description: "Paste name/title to link", type: 3, required: true },
      { name: "role", description: "Role ID to assign to buyers", type: 8, required: true }
    ]
  },
  {
    name: "genkeys",
    description: "Generate keys for a control panel (DMs you the file)",
    options: [
      { name: "panel", description: "Control panel name", type: 3, required: true },
      { name: "amount", description: "Number of keys to generate (1-100)", type: 4, required: true, min_value: 1, max_value: 100 },
      { name: "minutes", description: "Minutes until key expires", type: 4, required: false, min_value: 1 },
      { name: "hours", description: "Hours until key expires", type: 4, required: false, min_value: 1 },
      { name: "days", description: "Days until key expires", type: 4, required: false, min_value: 1 }
    ]
  },
  {
    name: "mypanels",
    description: "View your control panels"
  },
  {
    name: "consoleblacklist",
    description: "Blacklist a Discord user from using a control panel",
    options: [
      { name: "panel", description: "Control panel name", type: 3, required: true },
      { name: "user", description: "Discord user to blacklist", type: 6, required: true },
      { name: "reason", description: "Reason for blacklisting", type: 3, required: false }
    ]
  },
  {
    name: "forceexpire",
    description: "Force expire a user's access to a control panel",
    options: [
      { name: "panel", description: "Control panel name", type: 3, required: true },
      { name: "user", description: "Discord user to force expire", type: 6, required: true }
    ]
  },
  {
    name: "publicprotection",
    description: "Toggle public protection (no whitelist required, but still encrypted)",
    options: [
      { name: "paste", description: "Paste name/title", type: 3, required: true },
      { name: "enabled", description: "Enable or disable public protection", type: 5, required: true }
    ]
  },
  {
    name: "unblacklist",
    description: "Remove a Discord user from control panel blacklist",
    options: [
      { name: "panel", description: "Control panel name", type: 3, required: true },
      { name: "user", description: "Discord user to unblacklist", type: 6, required: true }
    ]
  },
  {
    name: "help",
    description: "Show all available commands"
  }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN");
    const DISCORD_APPLICATION_ID = Deno.env.get("DISCORD_APPLICATION_ID");

    if (!DISCORD_BOT_TOKEN || !DISCORD_APPLICATION_ID) {
      throw new Error("Missing Discord credentials");
    }

    const response = await fetch(
      `https://discord.com/api/v10/applications/${DISCORD_APPLICATION_ID}/commands`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(commands)
      }
    );

    const result = await response.json();
    
    if (!response.ok) {
      console.error("Discord API error:", result);
      return new Response(JSON.stringify({ error: result }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("Commands registered:", result);
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Commands registered successfully!",
      commands: result.map((c: any) => c.name)
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error: any) {
    console.error("Error registering commands:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
