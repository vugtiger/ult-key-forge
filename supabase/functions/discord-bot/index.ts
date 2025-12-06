import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DISCORD_PUBLIC_KEY = Deno.env.get("DISCORD_PUBLIC_KEY")!;

// Verify Discord request signature
async function verifyDiscordRequest(request: Request, body: string): Promise<boolean> {
  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");
  
  if (!signature || !timestamp) return false;

  const encoder = new TextEncoder();
  const message = encoder.encode(timestamp + body);
  
  // Import the public key
  const keyData = new Uint8Array(DISCORD_PUBLIC_KEY.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "Ed25519", namedCurve: "Ed25519" },
    false,
    ["verify"]
  );

  const signatureData = new Uint8Array(signature.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  
  try {
    return await crypto.subtle.verify("Ed25519", key, signatureData, message);
  } catch {
    return false;
  }
}

// Create Supabase client
function getSupabaseClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ASCII art character map (simplified for Discord)
const asciiChars: Record<string, string[]> = {
  'A': ['█████╗ ', '██╔══██╗', '███████║', '██╔══██║', '██║  ██║', '╚═╝  ╚═╝'],
  'B': ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔══██╗', '██████╔╝', '╚═════╝ '],
  'C': ['██████╗', '██╔════╝', '██║     ', '██║     ', '╚██████╗', ' ╚═════╝'],
  'D': ['██████╗ ', '██╔══██╗', '██║  ██║', '██║  ██║', '██████╔╝', '╚═════╝ '],
  'E': ['███████╗', '██╔════╝', '█████╗  ', '██╔══╝  ', '███████╗', '╚══════╝'],
  'F': ['███████╗', '██╔════╝', '█████╗  ', '██╔══╝  ', '██║     ', '╚═╝     '],
  'G': ['██████╗ ', '██╔════╝ ', '██║  ███╗', '██║   ██║', '╚██████╔╝', ' ╚═════╝ '],
  'H': ['██╗  ██╗', '██║  ██║', '███████║', '██╔══██║', '██║  ██║', '╚═╝  ╚═╝'],
  'I': ['██╗', '██║', '██║', '██║', '██║', '╚═╝'],
  'J': ['     ██╗', '     ██║', '     ██║', '██   ██║', '╚█████╔╝', ' ╚════╝ '],
  'K': ['██╗  ██╗', '██║ ██╔╝', '█████╔╝ ', '██╔═██╗ ', '██║  ██╗', '╚═╝  ╚═╝'],
  'L': ['██╗     ', '██║     ', '██║     ', '██║     ', '███████╗', '╚══════╝'],
  'M': ['███╗   ███╗', '████╗ ████║', '██╔████╔██║', '██║╚██╔╝██║', '██║ ╚═╝ ██║', '╚═╝     ╚═╝'],
  'N': ['███╗   ██╗', '████╗  ██║', '██╔██╗ ██║', '██║╚██╗██║', '██║ ╚████║', '╚═╝  ╚═══╝'],
  'O': ['██████╗ ', '██╔═══██╗', '██║   ██║', '██║   ██║', '╚██████╔╝', ' ╚═════╝ '],
  'P': ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔═══╝ ', '██║     ', '╚═╝     '],
  'Q': ['██████╗ ', '██╔═══██╗', '██║   ██║', '██║▄▄ ██║', '╚██████╔╝', ' ╚══▀▀═╝ '],
  'R': ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔══██╗', '██║  ██║', '╚═╝  ╚═╝'],
  'S': ['███████╗', '██╔════╝', '███████╗', '╚════██║', '███████║', '╚══════╝'],
  'T': ['████████╗', '╚══██╔══╝', '   ██║   ', '   ██║   ', '   ██║   ', '   ╚═╝   '],
  'U': ['██╗   ██╗', '██║   ██║', '██║   ██║', '██║   ██║', '╚██████╔╝', ' ╚═════╝ '],
  'V': ['██╗   ██╗', '██║   ██║', '██║   ██║', '╚██╗ ██╔╝', ' ╚████╔╝ ', '  ╚═══╝  '],
  'W': ['██╗    ██╗', '██║    ██║', '██║ █╗ ██║', '██║███╗██║', '╚███╔███╔╝', ' ╚══╝╚══╝ '],
  'X': ['██╗  ██╗', '╚██╗██╔╝', ' ╚███╔╝ ', ' ██╔██╗ ', '██╔╝ ██╗', '╚═╝  ╚═╝'],
  'Y': ['██╗   ██╗', '╚██╗ ██╔╝', ' ╚████╔╝ ', '  ╚██╔╝  ', '   ██║   ', '   ╚═╝   '],
  'Z': ['███████╗', '╚══███╔╝', '  ███╔╝ ', ' ███╔╝  ', '███████╗', '╚══════╝'],
  ' ': ['   ', '   ', '   ', '   ', '   ', '   '],
};

function convertToAsciiArt(text: string): string {
  const upperText = text.toUpperCase().slice(0, 10); // Limit for Discord
  const lines: string[] = ['', '', '', '', '', ''];
  
  for (const char of upperText) {
    const asciiChar = asciiChars[char] || asciiChars[' '];
    for (let i = 0; i < 6; i++) {
      lines[i] += asciiChar[i] || '   ';
    }
  }
  
  return lines.join('\n');
}

function generateRandomKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// Handle slash commands
async function handleCommand(interaction: any) {
  const { data, member } = interaction;
  const commandName = data.name;
  const discordUserId = member?.user?.id || interaction.user?.id;
  const discordUsername = member?.user?.username || interaction.user?.username;
  
  const supabase = getSupabaseClient();
  
  console.log(`Command received: ${commandName} from ${discordUsername} (${discordUserId})`);

  // Get or create user by Discord ID
  async function getOrCreateUser() {
    // Check if user exists by discord_user_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('discord_user_id', discordUserId)
      .single();
    
    if (profile) {
      return { userId: profile.id, username: profile.username, isNew: false };
    }
    return null;
  }

  switch (commandName) {
    case 'register': {
      const email = data.options?.find((o: any) => o.name === 'email')?.value;
      const password = data.options?.find((o: any) => o.name === 'password')?.value;
      
      if (!email || !password) {
        return {
          type: 4,
          data: { content: '❌ Please provide both email and password.', flags: 64 }
        };
      }

      if (password.length < 6) {
        return {
          type: 4,
          data: { content: '❌ Password must be at least 6 characters.', flags: 64 }
        };
      }

      // Check if Discord ID already registered
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('discord_user_id', discordUserId)
        .single();

      if (existingProfile) {
        return {
          type: 4,
          data: { content: '❌ Your Discord account is already linked to an account.', flags: 64 }
        };
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

      if (authError) {
        console.error('Auth error:', authError);
        return {
          type: 4,
          data: { content: `❌ Registration failed: ${authError.message}`, flags: 64 }
        };
      }

      // Update profile with Discord info
      await supabase
        .from('profiles')
        .update({ 
          discord_user_id: discordUserId,
          discord_username: discordUsername 
        })
        .eq('id', authData.user.id);

      return {
        type: 4,
        data: { 
          content: `✅ Account created successfully!\n\n**Email:** ${email}\nYou can now login on the website or use bot commands.`, 
          flags: 64 
        }
      };
    }

    case 'login': {
      const email = data.options?.find((o: any) => o.name === 'email')?.value;
      const password = data.options?.find((o: any) => o.name === 'password')?.value;
      
      if (!email || !password) {
        return {
          type: 4,
          data: { content: '❌ Please provide both email and password.', flags: 64 }
        };
      }

      // Verify credentials
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        return {
          type: 4,
          data: { content: '❌ Invalid email or password.', flags: 64 }
        };
      }

      // Link Discord ID to profile
      await supabase
        .from('profiles')
        .update({ 
          discord_user_id: discordUserId,
          discord_username: discordUsername 
        })
        .eq('id', authData.user.id);

      return {
        type: 4,
        data: { 
          content: `✅ Logged in and Discord linked!\n\nYou can now use all bot commands.`, 
          flags: 64 
        }
      };
    }

    case 'genkeys': {
      const user = await getOrCreateUser();
      if (!user) {
        return {
          type: 4,
          data: { content: '❌ Please `/register` or `/login` first to link your Discord account.', flags: 64 }
        };
      }

      const numKeys = data.options?.find((o: any) => o.name === 'amount')?.value || 10;
      const name = data.options?.find((o: any) => o.name === 'name')?.value || 'KeySystem';
      const color = data.options?.find((o: any) => o.name === 'color')?.value || '255, 255, 255';

      if (numKeys < 1 || numKeys > 1000) {
        return {
          type: 4,
          data: { content: '❌ Number of keys must be between 1 and 1000.', flags: 64 }
        };
      }

      const keys = Array.from({ length: numKeys }, () => generateRandomKey());
      const asciiText = convertToAsciiArt(name);
      
      // Generate Lua code (simplified for Discord)
      const luaCode = `-- ULT LUA PROTECTS KEY SYSTEM
-- Name: ${name}
-- Keys: ${numKeys}
-- Theme: RGB(${color})

local VALID_KEYS = {${keys.map(key => `"${key}"`).join(', ')}}

-- Full code available on the website
`;

      // Save to database
      await supabase.from('key_systems').insert({
        user_id: user.userId,
        name,
        num_keys: numKeys,
        theme_color: color,
        ascii_text: asciiText,
        generated_code: luaCode,
      });

      // Log activity
      await supabase.from('user_activity').insert({
        user_id: user.userId,
        activity_type: 'key_system_created',
        activity_data: { name, num_keys: numKeys, source: 'discord_bot' }
      });

      const keysList = keys.slice(0, 10).join('\n');
      const moreKeysMsg = keys.length > 10 ? `\n... and ${keys.length - 10} more keys` : '';

      return {
        type: 4,
        data: { 
          content: `✅ **Key System Generated!**\n\n**Name:** ${name}\n**Keys:** ${numKeys}\n**Theme:** RGB(${color})\n\n\`\`\`\n${keysList}${moreKeysMsg}\n\`\`\`\n\n*View full code on the website*`, 
          flags: 64 
        }
      };
    }

    case 'mykeys': {
      const user = await getOrCreateUser();
      if (!user) {
        return {
          type: 4,
          data: { content: '❌ Please `/register` or `/login` first.', flags: 64 }
        };
      }

      const { data: keySystems } = await supabase
        .from('key_systems')
        .select('name, num_keys, created_at')
        .eq('user_id', user.userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!keySystems || keySystems.length === 0) {
        return {
          type: 4,
          data: { content: '📭 You haven\'t created any key systems yet. Use `/genkeys` to create one!', flags: 64 }
        };
      }

      const list = keySystems.map((ks, i) => 
        `${i + 1}. **${ks.name}** - ${ks.num_keys} keys`
      ).join('\n');

      return {
        type: 4,
        data: { content: `🔑 **Your Key Systems:**\n\n${list}`, flags: 64 }
      };
    }

    case 'scripts': {
      const user = await getOrCreateUser();
      if (!user) {
        return {
          type: 4,
          data: { content: '❌ Please `/register` or `/login` first.', flags: 64 }
        };
      }

      const { data: scripts } = await supabase
        .from('saved_scripts')
        .select('name, description, created_at')
        .eq('user_id', user.userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!scripts || scripts.length === 0) {
        return {
          type: 4,
          data: { content: '📭 No saved scripts found.', flags: 64 }
        };
      }

      const list = scripts.map((s, i) => 
        `${i + 1}. **${s.name}** - ${s.description || 'No description'}`
      ).join('\n');

      return {
        type: 4,
        data: { content: `📜 **Your Saved Scripts:**\n\n${list}`, flags: 64 }
      };
    }

    case 'savescript': {
      const user = await getOrCreateUser();
      if (!user) {
        return {
          type: 4,
          data: { content: '❌ Please `/register` or `/login` first.', flags: 64 }
        };
      }

      const name = data.options?.find((o: any) => o.name === 'name')?.value;
      const code = data.options?.find((o: any) => o.name === 'code')?.value;
      const description = data.options?.find((o: any) => o.name === 'description')?.value || '';

      if (!name || !code) {
        return {
          type: 4,
          data: { content: '❌ Please provide both name and code.', flags: 64 }
        };
      }

      await supabase.from('saved_scripts').insert({
        user_id: user.userId,
        name,
        code,
        description
      });

      await supabase.from('user_activity').insert({
        user_id: user.userId,
        activity_type: 'script_saved',
        activity_data: { name, source: 'discord_bot' }
      });

      return {
        type: 4,
        data: { content: `✅ Script **${name}** saved successfully!`, flags: 64 }
      };
    }

    case 'paste': {
      const user = await getOrCreateUser();
      if (!user) {
        return {
          type: 4,
          data: { content: '❌ Please `/register` or `/login` first.', flags: 64 }
        };
      }

      const content = data.options?.find((o: any) => o.name === 'content')?.value;
      const title = data.options?.find((o: any) => o.name === 'title')?.value || 'Untitled';
      const isPublic = data.options?.find((o: any) => o.name === 'public')?.value ?? true;

      if (!content) {
        return {
          type: 4,
          data: { content: '❌ Please provide paste content.', flags: 64 }
        };
      }

      const { data: paste, error } = await supabase
        .from('pastes')
        .insert({
          user_id: user.userId,
          title,
          content,
          is_public: isPublic
        })
        .select('id')
        .single();

      if (error) {
        return {
          type: 4,
          data: { content: `❌ Failed to create paste: ${error.message}`, flags: 64 }
        };
      }

      const baseUrl = Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.lovable.app') || 'https://yoursite.com';
      
      return {
        type: 4,
        data: { 
          content: `✅ Paste created!\n\n**Title:** ${title}\n**Visibility:** ${isPublic ? 'Public' : 'Private'}\n**ID:** \`${paste.id}\``, 
          flags: 64 
        }
      };
    }

    case 'profile': {
      const user = await getOrCreateUser();
      if (!user) {
        return {
          type: 4,
          data: { content: '❌ Please `/register` or `/login` first.', flags: 64 }
        };
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, created_at')
        .eq('id', user.userId)
        .single();

      const { count: keyCount } = await supabase
        .from('key_systems')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.userId);

      const { count: scriptCount } = await supabase
        .from('saved_scripts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.userId);

      const { count: pasteCount } = await supabase
        .from('pastes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.userId);

      const createdAt = profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown';

      return {
        type: 4,
        data: { 
          content: `👤 **Your Profile**\n\n**Username:** ${profile?.username || 'Not set'}\n**Discord:** ${discordUsername}\n**Joined:** ${createdAt}\n\n📊 **Stats:**\n🔑 Key Systems: ${keyCount || 0}\n📜 Scripts: ${scriptCount || 0}\n📝 Pastes: ${pasteCount || 0}`, 
          flags: 64 
        }
      };
    }

    case 'help': {
      return {
        type: 4,
        data: { 
          content: `🤖 **ULT LUA PROTECTS Bot Commands**\n\n**Account:**\n\`/register\` - Create new account\n\`/login\` - Link existing account\n\`/profile\` - View your profile\n\n**Key Systems:**\n\`/genkeys\` - Generate a key system\n\`/mykeys\` - View your key systems\n\n**Scripts:**\n\`/scripts\` - View saved scripts\n\`/savescript\` - Save a new script\n\n**Pastebin:**\n\`/paste\` - Create a paste`, 
          flags: 0 
        }
      };
    }

    default:
      return {
        type: 4,
        data: { content: '❓ Unknown command. Use `/help` to see available commands.', flags: 64 }
      };
  }
}

serve(async (req) => {
  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.text();
  
  // Verify the request is from Discord
  const isValid = await verifyDiscordRequest(req, body);
  if (!isValid) {
    console.error("Invalid Discord signature");
    return new Response("Invalid signature", { status: 401 });
  }

  const interaction = JSON.parse(body);
  console.log("Interaction received:", interaction.type, interaction.data?.name);

  // Handle PING (type 1) - Discord verification
  if (interaction.type === 1) {
    return new Response(JSON.stringify({ type: 1 }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // Handle slash commands (type 2)
  if (interaction.type === 2) {
    try {
      const response = await handleCommand(interaction);
      return new Response(JSON.stringify(response), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("Command error:", error);
      return new Response(JSON.stringify({
        type: 4,
        data: { content: "❌ An error occurred processing your command.", flags: 64 }
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  return new Response(JSON.stringify({ type: 1 }), {
    headers: { "Content-Type": "application/json" }
  });
});
