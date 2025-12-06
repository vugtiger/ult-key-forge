import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DISCORD_PUBLIC_KEY = Deno.env.get("DISCORD_PUBLIC_KEY")!;
const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN")!;

// Verify Discord request signature
async function verifyDiscordRequest(request: Request, body: string): Promise<boolean> {
  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");
  
  if (!signature || !timestamp) return false;

  const encoder = new TextEncoder();
  const message = encoder.encode(timestamp + body);
  
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

// ASCII art character map
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
  const upperText = text.toUpperCase().slice(0, 10);
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

function generateSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// Send DM to user
async function sendDM(userId: string, content: string, files?: { name: string; content: string }[]) {
  try {
    // Create DM channel
    const dmChannelRes = await fetch(`https://discord.com/api/v10/users/@me/channels`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ recipient_id: userId })
    });
    
    const dmChannel = await dmChannelRes.json();
    if (!dmChannel.id) {
      console.error('Failed to create DM channel:', dmChannel);
      return false;
    }

    // Send message with optional file attachments
    if (files && files.length > 0) {
      const formData = new FormData();
      formData.append('payload_json', JSON.stringify({ content }));
      
      files.forEach((file, index) => {
        const blob = new Blob([file.content], { type: 'text/plain' });
        formData.append(`files[${index}]`, blob, file.name);
      });

      await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${DISCORD_BOT_TOKEN}`
        },
        body: formData
      });
    } else {
      await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      });
    }
    
    return true;
  } catch (error) {
    console.error('Failed to send DM:', error);
    return false;
  }
}

// Fetch attachment content
async function fetchAttachment(url: string): Promise<string> {
  const response = await fetch(url);
  return await response.text();
}

// Handle slash commands
async function handleCommand(interaction: any) {
  const { data, member } = interaction;
  const commandName = data.name;
  const discordUserId = member?.user?.id || interaction.user?.id;
  const discordUsername = member?.user?.username || interaction.user?.username;
  
  const supabase = getSupabaseClient();
  
  console.log(`Command received: ${commandName} from ${discordUsername} (${discordUserId})`);

  // Get user by Discord ID
  async function getUser() {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('discord_user_id', discordUserId)
      .maybeSingle();
    
    if (profile) {
      return { userId: profile.id, username: profile.username };
    }
    return null;
  }

  switch (commandName) {
    case 'register': {
      const email = data.options?.find((o: any) => o.name === 'email')?.value;
      const password = data.options?.find((o: any) => o.name === 'password')?.value;
      
      if (!email || !password) {
        return { type: 4, data: { content: '❌ Please provide both email and password.', flags: 64 } };
      }

      if (password.length < 6) {
        return { type: 4, data: { content: '❌ Password must be at least 6 characters.', flags: 64 } };
      }

      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('discord_user_id', discordUserId)
        .maybeSingle();

      if (existingProfile) {
        return { type: 4, data: { content: '❌ Your Discord account is already linked to an account.', flags: 64 } };
      }

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

      if (authError) {
        console.error('Auth error:', authError);
        return { type: 4, data: { content: `❌ Registration failed: ${authError.message}`, flags: 64 } };
      }

      await supabase
        .from('profiles')
        .update({ discord_user_id: discordUserId, discord_username: discordUsername })
        .eq('id', authData.user.id);

      await sendDM(discordUserId, `✅ **Account Created Successfully!**\n\n**Email:** ${email}\n\nYou can now use all bot commands and login on the website!`);

      return { type: 4, data: { content: `✅ Account created! Check your DMs for details.`, flags: 64 } };
    }

    case 'login': {
      const email = data.options?.find((o: any) => o.name === 'email')?.value;
      const password = data.options?.find((o: any) => o.name === 'password')?.value;
      
      if (!email || !password) {
        return { type: 4, data: { content: '❌ Please provide both email and password.', flags: 64 } };
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        return { type: 4, data: { content: '❌ Invalid email or password.', flags: 64 } };
      }

      await supabase
        .from('profiles')
        .update({ discord_user_id: discordUserId, discord_username: discordUsername })
        .eq('id', authData.user.id);

      await sendDM(discordUserId, `✅ **Discord Account Linked!**\n\nYou can now use all bot commands.`);

      return { type: 4, data: { content: `✅ Logged in and Discord linked! Check your DMs.`, flags: 64 } };
    }

    case 'keysystemgen': {
      const user = await getUser();
      if (!user) {
        return { type: 4, data: { content: '❌ Please `/register` or `/login` first.', flags: 64 } };
      }

      const numKeys = data.options?.find((o: any) => o.name === 'keys')?.value || 10;
      const name = data.options?.find((o: any) => o.name === 'name')?.value || 'KeySystem';
      const color = data.options?.find((o: any) => o.name === 'color')?.value || '255, 255, 255';

      if (numKeys < 1 || numKeys > 1000) {
        return { type: 4, data: { content: '❌ Number of keys must be between 1 and 1000.', flags: 64 } };
      }

      const keys = Array.from({ length: numKeys }, () => generateRandomKey());
      const asciiText = convertToAsciiArt(name);
      
      // Generate full Lua code
      const luaCode = `-- ULT LUA PROTECTS KEY SYSTEM
-- Name: ${name}
-- Keys: ${numKeys}
-- Theme: RGB(${color})

local VALID_KEYS = {
${keys.map(key => `    "${key}"`).join(',\n')}
}

local function checkKey(inputKey)
    for _, key in ipairs(VALID_KEYS) do
        if key == inputKey then
            return true
        end
    end
    return false
end

-- ASCII Art Title
local ascii = [[
${asciiText}
]]

print(ascii)
print("Enter your key:")
local userKey = io.read()

if checkKey(userKey) then
    print("✅ Key Valid! Access Granted.")
else
    print("❌ Invalid Key!")
end
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

      await supabase.from('user_activity').insert({
        user_id: user.userId,
        activity_type: 'key_system_created',
        activity_data: { name, num_keys: numKeys, source: 'discord_bot' }
      });

      // DM the user with the file
      await sendDM(
        discordUserId,
        `✅ **Key System Generated!**\n\n**Name:** ${name}\n**Keys:** ${numKeys}\n**Theme:** RGB(${color})\n\nYour key system file is attached below!`,
        [{ name: `${name.replace(/\s+/g, '_')}_keysystem.lua`, content: luaCode }]
      );

      return { type: 4, data: { content: `✅ Key system **${name}** generated! Check your DMs for the file.`, flags: 64 } };
    }

    case 'savescript': {
      const user = await getUser();
      if (!user) {
        return { type: 4, data: { content: '❌ Please `/register` or `/login` first.', flags: 64 } };
      }

      const name = data.options?.find((o: any) => o.name === 'name')?.value;
      const attachmentId = data.options?.find((o: any) => o.name === 'file')?.value;
      
      if (!name) {
        return { type: 4, data: { content: '❌ Please provide a script name.', flags: 64 } };
      }

      // Get attachment from resolved data
      const attachment = data.resolved?.attachments?.[attachmentId];
      if (!attachment) {
        return { type: 4, data: { content: '❌ Please upload a file.', flags: 64 } };
      }

      // Fetch file content
      const scriptContent = await fetchAttachment(attachment.url);

      await supabase.from('saved_scripts').insert({
        user_id: user.userId,
        name,
        script_content: scriptContent,
        description: `Uploaded via Discord: ${attachment.filename}`
      });

      await supabase.from('user_activity').insert({
        user_id: user.userId,
        activity_type: 'script_saved',
        activity_data: { name, source: 'discord_bot', filename: attachment.filename }
      });

      await sendDM(discordUserId, `✅ **Script Saved!**\n\n**Name:** ${name}\n**File:** ${attachment.filename}\n\nYou can view it in the Script Storage tab on the website.`);

      return { type: 4, data: { content: `✅ Script **${name}** saved! Check your DMs for confirmation.`, flags: 64 } };
    }

    case 'paste': {
      const user = await getUser();
      if (!user) {
        return { type: 4, data: { content: '❌ Please `/register` or `/login` first.', flags: 64 } };
      }

      const title = data.options?.find((o: any) => o.name === 'name')?.value || 'Untitled';
      const attachmentId = data.options?.find((o: any) => o.name === 'file')?.value;

      // Get attachment from resolved data
      const attachment = data.resolved?.attachments?.[attachmentId];
      if (!attachment) {
        return { type: 4, data: { content: '❌ Please upload a file.', flags: 64 } };
      }

      // Fetch file content
      const content = await fetchAttachment(attachment.url);
      const slug = generateSlug();

      const { data: paste, error } = await supabase
        .from('pastes')
        .insert({
          user_id: user.userId,
          title,
          content,
          slug,
          protection_enabled: false
        })
        .select('id, slug')
        .single();

      if (error) {
        console.error('Paste error:', error);
        return { type: 4, data: { content: `❌ Failed to create paste: ${error.message}`, flags: 64 } };
      }

      const rawUrl = `https://iyfvpnjrghsownkpazec.supabase.co/functions/v1/get-paste/${paste.slug}`;

      await sendDM(discordUserId, `✅ **Paste Created!**\n\n**Title:** ${title}\n**Raw URL:** ${rawUrl}\n\nYou can manage it in the Pastebin tab on the website.`);

      return { type: 4, data: { content: `✅ Paste **${title}** created! Check your DMs for the raw URL.`, flags: 64 } };
    }

    case 'scriptprotection': {
      const user = await getUser();
      if (!user) {
        return { type: 4, data: { content: '❌ Please `/register` or `/login` first.', flags: 64 } };
      }

      const pasteSlug = data.options?.find((o: any) => o.name === 'paste')?.value;
      const enabled = data.options?.find((o: any) => o.name === 'enabled')?.value;

      if (!pasteSlug) {
        return { type: 4, data: { content: '❌ Please select a paste.', flags: 64 } };
      }

      // Update protection status
      const { error } = await supabase
        .from('pastes')
        .update({ protection_enabled: enabled })
        .eq('slug', pasteSlug)
        .eq('user_id', user.userId);

      if (error) {
        return { type: 4, data: { content: `❌ Failed to update: ${error.message}`, flags: 64 } };
      }

      await sendDM(discordUserId, `✅ **Protection Updated!**\n\n**Paste:** ${pasteSlug}\n**Protection:** ${enabled ? 'Enabled' : 'Disabled'}`);

      return { type: 4, data: { content: `✅ Protection ${enabled ? 'enabled' : 'disabled'} for paste! Check your DMs.`, flags: 64 } };
    }

    case 'whitelist': {
      const user = await getUser();
      if (!user) {
        return { type: 4, data: { content: '❌ Please `/register` or `/login` first.', flags: 64 } };
      }

      const pasteSlug = data.options?.find((o: any) => o.name === 'paste')?.value;
      const robloxUserId = data.options?.find((o: any) => o.name === 'userid')?.value;

      if (!pasteSlug || !robloxUserId) {
        return { type: 4, data: { content: '❌ Please provide both paste and user ID.', flags: 64 } };
      }

      // Get paste ID from slug
      const { data: paste } = await supabase
        .from('pastes')
        .select('id')
        .eq('slug', pasteSlug)
        .eq('user_id', user.userId)
        .maybeSingle();

      if (!paste) {
        return { type: 4, data: { content: '❌ Paste not found or you don\'t own it.', flags: 64 } };
      }

      // Add to whitelist
      const { error } = await supabase
        .from('paste_access_control')
        .insert({
          paste_id: paste.id,
          roblox_user_id: robloxUserId,
          access_type: 'whitelist'
        });

      if (error) {
        if (error.code === '23505') {
          return { type: 4, data: { content: '❌ User ID already whitelisted for this paste.', flags: 64 } };
        }
        return { type: 4, data: { content: `❌ Failed to whitelist: ${error.message}`, flags: 64 } };
      }

      await sendDM(discordUserId, `✅ **User Whitelisted!**\n\n**Paste:** ${pasteSlug}\n**User ID:** ${robloxUserId}`);

      return { type: 4, data: { content: `✅ User ID **${robloxUserId}** whitelisted! Check your DMs.`, flags: 64 } };
    }

    case 'mypastes': {
      const user = await getUser();
      if (!user) {
        return { type: 4, data: { content: '❌ Please `/register` or `/login` first.', flags: 64 } };
      }

      const { data: pastes } = await supabase
        .from('pastes')
        .select('title, slug, protection_enabled, created_at')
        .eq('user_id', user.userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!pastes || pastes.length === 0) {
        return { type: 4, data: { content: '📭 No pastes found. Use `/paste` to create one!', flags: 64 } };
      }

      const list = pastes.map((p, i) => 
        `${i + 1}. **${p.title || 'Untitled'}** (\`${p.slug}\`) - Protection: ${p.protection_enabled ? '✅' : '❌'}`
      ).join('\n');

      return { type: 4, data: { content: `📝 **Your Pastes:**\n\n${list}`, flags: 64 } };
    }

    case 'mykeys': {
      const user = await getUser();
      if (!user) {
        return { type: 4, data: { content: '❌ Please `/register` or `/login` first.', flags: 64 } };
      }

      const { data: keySystems } = await supabase
        .from('key_systems')
        .select('name, num_keys, created_at')
        .eq('user_id', user.userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!keySystems || keySystems.length === 0) {
        return { type: 4, data: { content: '📭 No key systems found. Use `/keysystemgen` to create one!', flags: 64 } };
      }

      const list = keySystems.map((ks, i) => 
        `${i + 1}. **${ks.name}** - ${ks.num_keys} keys`
      ).join('\n');

      return { type: 4, data: { content: `🔑 **Your Key Systems:**\n\n${list}`, flags: 64 } };
    }

    case 'scripts': {
      const user = await getUser();
      if (!user) {
        return { type: 4, data: { content: '❌ Please `/register` or `/login` first.', flags: 64 } };
      }

      const { data: scripts } = await supabase
        .from('saved_scripts')
        .select('name, description, created_at')
        .eq('user_id', user.userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!scripts || scripts.length === 0) {
        return { type: 4, data: { content: '📭 No scripts found. Use `/savescript` to save one!', flags: 64 } };
      }

      const list = scripts.map((s, i) => 
        `${i + 1}. **${s.name}** - ${s.description || 'No description'}`
      ).join('\n');

      return { type: 4, data: { content: `📜 **Your Saved Scripts:**\n\n${list}`, flags: 64 } };
    }

    case 'profile': {
      const user = await getUser();
      if (!user) {
        return { type: 4, data: { content: '❌ Please `/register` or `/login` first.', flags: 64 } };
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
          content: `🤖 **ULT LUA PROTECTS Bot Commands**\n\n**Account:**\n\`/register\` - Create new account\n\`/login\` - Link existing account\n\`/profile\` - View your profile\n\n**Key Systems:**\n\`/keysystemgen\` - Generate a key system (DMs you the file)\n\`/mykeys\` - View your key systems\n\n**Scripts:**\n\`/scripts\` - View saved scripts\n\`/savescript\` - Save a script (upload file)\n\n**Pastebin:**\n\`/paste\` - Create a paste (upload file, DMs raw URL)\n\`/mypastes\` - View your pastes\n\`/scriptprotection\` - Toggle paste protection\n\`/whitelist\` - Add user ID to paste whitelist`, 
          flags: 0 
        }
      };
    }

    default:
      return { type: 4, data: { content: '❓ Unknown command. Use `/help` to see available commands.', flags: 64 } };
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.text();
  
  const isValid = await verifyDiscordRequest(req, body);
  if (!isValid) {
    console.error("Invalid Discord signature");
    return new Response("Invalid signature", { status: 401 });
  }

  const interaction = JSON.parse(body);
  console.log("Interaction received:", interaction.type, interaction.data?.name);

  // Handle PING (type 1)
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
