import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const commands = [
  // Account Commands
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
    name: "profile",
    description: "View your profile and stats"
  },
  {
    name: "factoryreset",
    description: "Wipe all your data (key systems, scripts, pastes) - account stays"
  },

  // Script Commands
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
    name: "deletescript",
    description: "Delete one of your saved scripts",
    options: [
      { name: "name", description: "Script name", type: 3, required: true }
    ]
  },

  // Pastebin Commands
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
    name: "deletepaste",
    description: "Delete one of your pastes permanently",
    options: [
      { name: "paste", description: "Paste name/title", type: 3, required: true }
    ]
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
    name: "publicprotection",
    description: "Toggle public protection (no whitelist required, but still encrypted)",
    options: [
      { name: "paste", description: "Paste name/title", type: 3, required: true },
      { name: "enabled", description: "Enable or disable public protection", type: 5, required: true }
    ]
  },
  {
    name: "hidecode",
    description: "Hide code from raw URL (shows blank but loadstring still works)",
    options: [
      { name: "paste", description: "Paste name/title", type: 3, required: true },
      { name: "enabled", description: "Enable or disable hide code", type: 5, required: true }
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
    name: "removewhitelist",
    description: "Remove a Roblox user ID from paste whitelist",
    options: [
      { name: "paste", description: "Paste name/title", type: 3, required: true },
      { name: "userid", description: "Roblox user ID to remove", type: 3, required: true }
    ]
  },
  {
    name: "removeblacklist",
    description: "Remove a Roblox user ID from paste blacklist",
    options: [
      { name: "paste", description: "Paste name/title", type: 3, required: true },
      { name: "userid", description: "Roblox user ID to remove", type: 3, required: true }
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

  // IP Tracking
  {
    name: "iptracking",
    description: "Toggle IP tracking on a paste",
    options: [
      { name: "paste", description: "Paste name/title", type: 3, required: true },
      { name: "enabled", description: "Enable or disable IP tracking", type: 5, required: true }
    ]
  },

  // Game Restriction
  {
    name: "setgame",
    description: "Set game restriction on a paste (bind to a Roblox game)",
    options: [
      { name: "paste", description: "Paste name/title", type: 3, required: true },
      { name: "enabled", description: "Enable or disable game restriction", type: 5, required: true },
      { name: "gameid", description: "Roblox Game/Place ID to bind (required if enabling)", type: 3, required: false },
      { name: "gamename", description: "Game name (optional, for display)", type: 3, required: false }
    ]
  },

  // My Game Linked Pastes
  {
    name: "mygamelinkedpastes",
    description: "View all pastes with game bindings and their bound games"
  },

  // Invite Bot
  {
    name: "invite",
    description: "Get the bot invite link to add it to your server"
  },

  // Analytics command removed

  // Changelog Logs
  {
    name: "logs",
    description: "Set a channel to receive changelog update notifications",
    options: [
      { name: "channel", description: "Channel to send changelog updates to", type: 7, required: true }
    ]
  },

  // Key System Setup (connected to Key System Gen on website)
  {
    name: "keysystemsetup",
    description: "Create a key system for a paste (like website Key System Gen)",
    options: [
      { name: "paste", description: "Paste name/title to link", type: 3, required: true },
      { name: "name", description: "Key system / panel name", type: 3, required: true },
      { name: "color", description: "UI color RGB (e.g. 255, 0, 0)", type: 3, required: true },
      { name: "keys", description: "Number of keys to generate (1-100)", type: 4, required: true, min_value: 1, max_value: 100 },
      {
        name: "duration",
        description: "Key duration",
        type: 3,
        required: true,
        choices: [
          { name: "1 Hour", value: "1h" },
          { name: "6 Hours", value: "6h" },
          { name: "24 Hours", value: "24h" },
          { name: "7 Days", value: "7d" },
          { name: "30 Days", value: "30d" },
          { name: "Permanent", value: "permanent" }
        ]
      }
    ]
  },

  // Console Feedback
  {
    name: "consolefeedback",
    description: "Toggle console feedback (loading bar + welcome message) on a paste",
    options: [
      { name: "paste", description: "Paste name/title", type: 3, required: true },
      { name: "enabled", description: "Enable or disable console feedback", type: 5, required: true }
    ]
  },

  // Key Gen (generate more keys for existing panel)
  {
    name: "keygen",
    description: "Generate more keys for an existing key system panel",
    options: [
      { name: "paste", description: "Paste name/title linked to key system", type: 3, required: true },
      { name: "amount", description: "Number of keys to generate (1-100)", type: 4, required: true, min_value: 1, max_value: 100 },
      {
        name: "duration",
        description: "Key duration",
        type: 3,
        required: true,
        choices: [
          { name: "1 Hour", value: "1h" },
          { name: "6 Hours", value: "6h" },
          { name: "24 Hours", value: "24h" },
          { name: "7 Days", value: "7d" },
          { name: "30 Days", value: "30d" },
          { name: "Permanent", value: "permanent" }
        ]
      }
    ]
  },

  // My Key System Keys
  {
    name: "mykeysystemkeys",
    description: "View keys for a paste linked to a key system",
    options: [
      { name: "paste", description: "Paste name/title", type: 3, required: true }
    ]
  },

  // Key System Whitelist (assign user ID to a key)
  {
    name: "keysystemwhitelist",
    description: "Assign a Roblox User ID to an existing generated key",
    options: [
      { name: "key", description: "The key value to assign", type: 3, required: true },
      { name: "userid", description: "Roblox User ID to assign to the key", type: 3, required: true }
    ]
  },

  // Delete Key System
  {
    name: "deletekeysystem",
    description: "Delete the key system from a paste (paste stays, key system is removed)",
    options: [
      { name: "paste", description: "Paste name/title", type: 3, required: true }
    ]
  },

  // Control Panel Commands
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
    name: "unblacklist",
    description: "Remove a Discord user from control panel blacklist",
    options: [
      { name: "panel", description: "Control panel name", type: 3, required: true },
      { name: "user", description: "Discord user to unblacklist", type: 6, required: true }
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

  // Generate Keys for Control Panel
  {
    name: "genkeys",
    description: "Generate keys for an existing control panel",
    options: [
      { name: "panel", description: "Control panel name", type: 3, required: true },
      { name: "amount", description: "Number of keys to generate (1-100)", type: 4, required: true, min_value: 1, max_value: 100 },
      { name: "minutes", description: "Minutes until keys expire", type: 4, required: false },
      { name: "hours", description: "Hours until keys expire", type: 4, required: false },
      { name: "days", description: "Days until keys expire", type: 4, required: false }
    ]
  },

  // View Panel Keys
  {
    name: "viewpanelkeys",
    description: "View all keys for a control panel with their status",
    options: [
      { name: "panel", description: "Control panel name", type: 3, required: true }
    ]
  },

  // Help Command
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
