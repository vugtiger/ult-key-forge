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
      {
        name: "email",
        description: "Your email address",
        type: 3, // STRING
        required: true
      },
      {
        name: "password",
        description: "Your password (min 6 characters)",
        type: 3,
        required: true
      }
    ]
  },
  {
    name: "login",
    description: "Link your existing account to Discord",
    options: [
      {
        name: "email",
        description: "Your email address",
        type: 3,
        required: true
      },
      {
        name: "password",
        description: "Your password",
        type: 3,
        required: true
      }
    ]
  },
  {
    name: "genkeys",
    description: "Generate a new key system",
    options: [
      {
        name: "name",
        description: "Name of the key system",
        type: 3,
        required: true
      },
      {
        name: "amount",
        description: "Number of keys to generate (1-1000)",
        type: 4, // INTEGER
        required: true,
        min_value: 1,
        max_value: 1000
      },
      {
        name: "color",
        description: "RGB color (e.g., 255, 0, 0 for red)",
        type: 3,
        required: false
      }
    ]
  },
  {
    name: "mykeys",
    description: "View your generated key systems"
  },
  {
    name: "scripts",
    description: "View your saved scripts"
  },
  {
    name: "savescript",
    description: "Save a new script",
    options: [
      {
        name: "name",
        description: "Script name",
        type: 3,
        required: true
      },
      {
        name: "code",
        description: "The script code",
        type: 3,
        required: true
      },
      {
        name: "description",
        description: "Script description",
        type: 3,
        required: false
      }
    ]
  },
  {
    name: "paste",
    description: "Create a new paste",
    options: [
      {
        name: "content",
        description: "Paste content",
        type: 3,
        required: true
      },
      {
        name: "title",
        description: "Paste title",
        type: 3,
        required: false
      },
      {
        name: "public",
        description: "Make paste public",
        type: 5, // BOOLEAN
        required: false
      }
    ]
  },
  {
    name: "profile",
    description: "View your profile and stats"
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

    // Register global commands
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
