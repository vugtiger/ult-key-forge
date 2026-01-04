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
  '0': ['██████╗ ', '██╔═████╗', '██║██╔██║', '████╔╝██║', '╚██████╔╝', ' ╚═════╝ '],
  '1': ['██╗', '██║', '██║', '██║', '██║', '╚═╝'],
  '2': ['██████╗ ', '╚════██╗', ' █████╔╝', '██╔═══╝ ', '███████╗', '╚══════╝'],
  '3': ['██████╗ ', '╚════██╗', ' █████╔╝', ' ╚═══██╗', '██████╔╝', '╚═════╝ '],
  '4': ['██╗  ██╗', '██║  ██║', '███████║', '╚════██║', '     ██║', '     ╚═╝'],
  '5': ['███████╗', '██╔════╝', '███████╗', '╚════██║', '███████║', '╚══════╝'],
  '6': ['██████╗ ', '██╔════╝ ', '███████╗', '██╔═══██╗', '╚██████╔╝', ' ╚═════╝ '],
  '7': ['███████╗', '╚════██║', '    ██╔╝', '   ██╔╝ ', '   ██║  ', '   ╚═╝  '],
  '8': ['██████╗ ', '██╔══██╗', '╚█████╔╝', '██╔══██╗', '╚█████╔╝', ' ╚════╝ '],
  '9': ['██████╗ ', '██╔═══██╗', '╚██████║', ' ╚═══██║', ' █████╔╝', ' ╚════╝ '],
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

// Generate the full key system Lua code (matching website exactly)
function generateFullKeySystemCode(name: string, keys: string[], themeColor: string): string {
  const asciiText = convertToAsciiArt(name);
  const keysString = keys.map(key => `"${key}"`).join(', ');
  
  return `-- // ULT LUA PROTECTS KEY SYSTEM \\ --

--[[
  HOW THE KEY-USER ID TRACKING WORKS:
  
  SCENARIO 1: First Time User Uses a Key
  - User enters a valid key that hasn't been used
  - System saves: usedKeysData["keyValue"] = "userId"
  - Result: ACCESS GRANTED
  
  SCENARIO 2: Same User Uses Key Again
  - User enters a key they previously used
  - System checks: Key owner matches current user
  - Result: ACCESS GRANTED (same owner can reuse their key)
  
  SCENARIO 3: Different User Tries to Use Already-Used Key
  - User tries to enter a key someone else claimed
  - System checks: Key owner doesn't match current user
  - Result: ACCESS DENIED (different user can't use someone else's key)
  
  HOW TO MANUALLY ASSIGN KEYS TO SPECIFIC USER IDS:
  Replace: local usedKeysData = {}
  With: local usedKeysData = {
    ["${keys[0] || 'KEY1'}"] = "123456789",  -- Pre-assign to specific user
  }
]]--

local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local TextService = game:GetService("TextService")
local HttpService = game:GetService("HttpService")

local plr = Players.LocalPlayer
local gui = Instance.new("ScreenGui", plr:WaitForChild("PlayerGui"))
gui.ResetOnSpawn = false
gui.DisplayOrder = 999999999

-- Valid keys (5 characters each)
local VALID_KEYS = {${keysString}}

-- Storage for used keys (key -> userId mapping)
local usedKeysData = {}
local DATA_KEY = "UltLuaUsedKeys_${name.replace(/\s+/g, '_')}"

-- Load used keys from DataStore
local function loadUsedKeys()
    local success, data = pcall(function()
        return HttpService:JSONDecode(game:GetService("DataStoreService"):GetDataStore(DATA_KEY):GetAsync("keys") or "{}")
    end)
    if success then
        usedKeysData = data
    end
end

-- Save used keys to DataStore
local function saveUsedKeys()
    pcall(function()
        game:GetService("DataStoreService"):GetDataStore(DATA_KEY):SetAsync("keys", HttpService:JSONEncode(usedKeysData))
    end)
end

loadUsedKeys()

-- Window
local win = Instance.new("Frame", gui)
win.Size = UDim2.new(0, 680, 0, 290)
win.Position = UDim2.new(0.5, -340, 0.5, -145)
win.BackgroundColor3 = Color3.fromRGB(20,20,20)
win.BackgroundTransparency = 0.25
win.BorderSizePixel = 0
win.ClipsDescendants = true

local outline = Instance.new("UIStroke", win)
outline.Thickness = 2
outline.Color = Color3.fromRGB(${themeColor})
local glow = Instance.new("UIStroke", win)
glow.Thickness = 6
glow.Transparency = 0.65
glow.Color = Color3.fromRGB(${themeColor})

-- Logo + flicker
local logo = Instance.new("TextLabel", win)
logo.Size = UDim2.new(1,0,0,125)
logo.Position = UDim2.new(0,0,0,10)
logo.BackgroundTransparency = 1
logo.TextColor3 = Color3.fromRGB(${themeColor})
logo.TextTransparency = 1
logo.Font = Enum.Font.Code
logo.TextSize = 18
logo.Text = [[
${asciiText}
]]

task.spawn(function()
    task.wait(0.3)
    for i = 1, 30 do
        logo.TextTransparency = math.random(20,80)/100
        task.wait(0.04)
    end
    TweenService:Create(logo, TweenInfo.new(0.3), {TextTransparency = 0}):Play()
end)

-- Fixed prefix
local prefix = Instance.new("TextLabel", win)
prefix.Size = UDim2.new(1,-60,0,50)
prefix.Position = UDim2.new(0,30,0,200)
prefix.BackgroundTransparency = 1
prefix.Text = "Enter your key > "
prefix.TextColor3 = Color3.fromRGB(${themeColor})
prefix.Font = Enum.Font.Code
prefix.TextSize = 28
prefix.TextXAlignment = Enum.TextXAlignment.Left
prefix.TextTransparency = 1

-- Real TextBox
local input = Instance.new("TextBox", win)
input.Size = UDim2.new(1,-60,0,50)
input.Position = UDim2.new(0,30,0,200)
input.BackgroundTransparency = 1
input.Text = ""
input.TextColor3 = Color3.fromRGB(${themeColor})
input.Font = Enum.Font.Code
input.TextSize = 28
input.TextXAlignment = Enum.TextXAlignment.Left
input.ClearTextOnFocus = false

-- Position input after prefix
local prefixWidth = 0
task.spawn(function()
    task.wait()
    prefixWidth = TextService:GetTextSize(prefix.Text, 28, Enum.Font.Code, Vector2.new(10000,10000)).X
    input.Position = UDim2.new(0, 30 + prefixWidth, 0, 200)
    input.Size = UDim2.new(1, -90 - prefixWidth, 0, 50)
end)

-- Fade + load
local function fadeAndDestroy(msg, color, load)
    input.TextEditable = false
    input.Text = msg
    input.TextColor3 = color

    TweenService:Create(win, TweenInfo.new(0.9), {BackgroundTransparency = 1}):Play()
    TweenService:Create(prefix, TweenInfo.new(0.9), {TextTransparency = 1}):Play()
    TweenService:Create(input, TweenInfo.new(0.9), {TextTransparency = 1}):Play()
    TweenService:Create(logo, TweenInfo.new(0.9), {TextTransparency = 1}):Play()
    TweenService:Create(outline, TweenInfo.new(0.9), {Transparency = 1}):Play()
    TweenService:Create(glow, TweenInfo.new(0.9), {Transparency = 1}):Play()

    task.wait(1)
    if load then
        -- REPLACE WITH YOUR SCRIPT URL
        loadstring(game:HttpGet("https://pastebin.com/raw/YOUR_SCRIPT_HERE"))()
    end
    gui:Destroy()
end

input.FocusLost:Connect(function(enter)
    if not enter then return end
    
    local userId = tostring(plr.UserId)
    local enteredKey = input.Text
    
    -- STEP 1: Check if the entered key exists in VALID_KEYS array
    local isValidKey = false
    for _, key in ipairs(VALID_KEYS) do
        if key == enteredKey then
            isValidKey = true
            break
        end
    end
    
    if not isValidKey then
        fadeAndDestroy("Wrong Key! Access Denied", Color3.fromRGB(255,0,0), false)
        return
    end
    
    -- STEP 2: Check if this key has been used before
    if usedKeysData[enteredKey] then
        -- Key has been used before, check WHO used it
        if usedKeysData[enteredKey] == userId then
            -- Same user who originally used the key - ALLOW
            fadeAndDestroy("Key Accepted! Loading...", Color3.fromRGB(0,255,0), true)
        else
            -- Different user trying to use an already-claimed key - DENY
            fadeAndDestroy("Key Already Used! Access Denied", Color3.fromRGB(255,0,0), false)
        end
        return
    end
    
    -- STEP 3: Key is valid and hasn't been used - claim it for this user
    usedKeysData[enteredKey] = userId
    saveUsedKeys()
    fadeAndDestroy("Key Accepted! Loading...", Color3.fromRGB(0,255,0), true)
end)

-- FIXED DRAGGING (no more sticking)
local dragging = false
local dragStart, startPos

local function startDrag(inputObj)
    dragging = true
    dragStart = inputObj.Position
    startPos = win.Position
end

local function stopDrag()
    dragging = false
end

local lastClickTime = 0
win.InputBegan:Connect(function(inputObj)
    if inputObj.UserInputType == Enum.UserInputType.MouseButton1 then
        local now = tick()
        if now - lastClickTime < 0.35 then
            fadeAndDestroy("Closed.", Color3.fromRGB(200,200,200), false)
            return
        end
        lastClickTime = now
        startDrag(inputObj)
    end
end)

win.InputEnded:Connect(function(inputObj)
    if inputObj.UserInputType == Enum.UserInputType.MouseButton1 then
        stopDrag()
    end
end)

UserInputService.InputChanged:Connect(function(inputObj)
    if dragging and inputObj.UserInputType == Enum.UserInputType.MouseMovement then
        local delta = inputObj.Position - dragStart
        win.Position = UDim2.new(
            startPos.X.Scale, startPos.X.Offset + delta.X,
            startPos.Y.Scale, startPos.Y.Offset + delta.Y
        )
    end
end)

-- Fade in
TweenService:Create(win, TweenInfo.new(0.7), {BackgroundTransparency = 0.25}):Play()
TweenService:Create(prefix, TweenInfo.new(0.7), {TextTransparency = 0}):Play()
TweenService:Create(input, TweenInfo.new(0.7), {TextTransparency = 0}):Play()
`;
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

    case 'logout': {
      const user = await getUser();
      if (!user) {
        return { type: 4, data: { content: '❌ You are not logged in.', flags: 64 } };
      }

      // Unlink Discord from profile
      await supabase
        .from('profiles')
        .update({ discord_user_id: null, discord_username: null })
        .eq('id', user.userId);

      return { type: 4, data: { content: `✅ Successfully logged out! Your Discord is now unlinked from your account.`, flags: 64 } };
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
      
      // Generate the FULL Lua code (matching website exactly)
      const luaCode = generateFullKeySystemCode(name, keys, color);

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
        [{ name: `${name.replace(/\s+/g, '_')}_KeySystem.lua`, content: luaCode }]
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

      // Fixed URL format to match website
      const rawUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/get-paste?slug=${paste.slug}`;

      await sendDM(discordUserId, `✅ **Paste Created!**\n\n**Title:** ${title}\n**Raw URL:** ${rawUrl}\n\nYou can manage it in the Pastebin tab on the website.`);

      return { type: 4, data: { content: `✅ Paste **${title}** created! Check your DMs for the raw URL.`, flags: 64 } };
    }

    case 'scriptprotection': {
      const user = await getUser();
      if (!user) {
        return { type: 4, data: { content: '❌ Please `/register` or `/login` first.', flags: 64 } };
      }

      const pasteName = data.options?.find((o: any) => o.name === 'paste')?.value;
      const enabled = data.options?.find((o: any) => o.name === 'enabled')?.value;

      if (!pasteName) {
        return { type: 4, data: { content: '❌ Please provide the paste name.', flags: 64 } };
      }

      // Find paste by title (name) instead of slug
      const { data: paste } = await supabase
        .from('pastes')
        .select('id, title, slug')
        .eq('user_id', user.userId)
        .ilike('title', pasteName)
        .maybeSingle();

      if (!paste) {
        return { type: 4, data: { content: `❌ Paste "${pasteName}" not found. Use \`/mypastes\` to see your pastes.`, flags: 64 } };
      }

      // Update protection status
      const { error } = await supabase
        .from('pastes')
        .update({ protection_enabled: enabled })
        .eq('id', paste.id);

      if (error) {
        return { type: 4, data: { content: `❌ Failed to update: ${error.message}`, flags: 64 } };
      }

      await sendDM(discordUserId, `✅ **Protection Updated!**\n\n**Paste:** ${paste.title || 'Untitled'}\n**Protection:** ${enabled ? 'Enabled' : 'Disabled'}`);

      return { type: 4, data: { content: `✅ Protection ${enabled ? 'enabled' : 'disabled'} for paste **${paste.title || 'Untitled'}**! Check your DMs.`, flags: 64 } };
    }

    case 'whitelist': {
      const user = await getUser();
      if (!user) {
        return { type: 4, data: { content: '❌ Please `/register` or `/login` first.', flags: 64 } };
      }

      const pasteName = data.options?.find((o: any) => o.name === 'paste')?.value;
      const robloxUserId = data.options?.find((o: any) => o.name === 'userid')?.value;

      if (!pasteName || !robloxUserId) {
        return { type: 4, data: { content: '❌ Please provide both paste name and user ID.', flags: 64 } };
      }

      // Find paste by title (name) instead of slug
      const { data: paste } = await supabase
        .from('pastes')
        .select('id, title')
        .eq('user_id', user.userId)
        .ilike('title', pasteName)
        .maybeSingle();

      if (!paste) {
        return { type: 4, data: { content: `❌ Paste "${pasteName}" not found. Use \`/mypastes\` to see your pastes.`, flags: 64 } };
      }

      // Remove existing entry if any
      await supabase
        .from('paste_access_control')
        .delete()
        .eq('paste_id', paste.id)
        .eq('roblox_user_id', robloxUserId);

      // Add to whitelist
      const { error } = await supabase
        .from('paste_access_control')
        .insert({
          paste_id: paste.id,
          roblox_user_id: robloxUserId,
          access_type: 'whitelist'
        });

      if (error) {
        return { type: 4, data: { content: `❌ Failed to whitelist: ${error.message}`, flags: 64 } };
      }

      await sendDM(discordUserId, `✅ **User Whitelisted!**\n\n**Paste:** ${paste.title || 'Untitled'}\n**User ID:** ${robloxUserId}`);

      return { type: 4, data: { content: `✅ User ID **${robloxUserId}** whitelisted for paste **${paste.title || 'Untitled'}**! Check your DMs.`, flags: 64 } };
    }

    case 'blacklist': {
      const user = await getUser();
      if (!user) {
        return { type: 4, data: { content: '❌ Please `/register` or `/login` first.', flags: 64 } };
      }

      const pasteName = data.options?.find((o: any) => o.name === 'paste')?.value;
      const robloxUserId = data.options?.find((o: any) => o.name === 'userid')?.value;

      if (!pasteName || !robloxUserId) {
        return { type: 4, data: { content: '❌ Please provide both paste name and user ID.', flags: 64 } };
      }

      // Find paste by title (name)
      const { data: paste } = await supabase
        .from('pastes')
        .select('id, title')
        .eq('user_id', user.userId)
        .ilike('title', pasteName)
        .maybeSingle();

      if (!paste) {
        return { type: 4, data: { content: `❌ Paste "${pasteName}" not found. Use \`/mypastes\` to see your pastes.`, flags: 64 } };
      }

      // Remove existing entry if any
      await supabase
        .from('paste_access_control')
        .delete()
        .eq('paste_id', paste.id)
        .eq('roblox_user_id', robloxUserId);

      // Add to blacklist
      const { error } = await supabase
        .from('paste_access_control')
        .insert({
          paste_id: paste.id,
          roblox_user_id: robloxUserId,
          access_type: 'blacklist'
        });

      if (error) {
        return { type: 4, data: { content: `❌ Failed to blacklist: ${error.message}`, flags: 64 } };
      }

      await sendDM(discordUserId, `✅ **User Blacklisted!**\n\n**Paste:** ${paste.title || 'Untitled'}\n**User ID:** ${robloxUserId}`);

      return { type: 4, data: { content: `✅ User ID **${robloxUserId}** blacklisted from paste **${paste.title || 'Untitled'}**! Check your DMs.`, flags: 64 } };
    }

    case 'factoryreset': {
      const user = await getUser();
      if (!user) {
        return { type: 4, data: { content: '❌ Please `/register` or `/login` first.', flags: 64 } };
      }

      // Get paste IDs first, then delete access control entries
      const { data: userPastes } = await supabase
        .from('pastes')
        .select('id')
        .eq('user_id', user.userId);
      
      if (userPastes && userPastes.length > 0) {
        const pasteIds = userPastes.map(p => p.id);
        await supabase.from('paste_access_control').delete().in('paste_id', pasteIds);
      }
      
      // Delete all user data from all tables
      await supabase.from('pastes').delete().eq('user_id', user.userId);
      await supabase.from('key_systems').delete().eq('user_id', user.userId);
      await supabase.from('saved_scripts').delete().eq('user_id', user.userId);
      await supabase.from('user_activity').delete().eq('user_id', user.userId);

      await sendDM(discordUserId, `✅ **Factory Reset Complete!**\n\nAll your data has been wiped:\n- Key Systems\n- Saved Scripts\n- Pastes\n- Activity History\n\nYour account still exists, you can start fresh!`);

      return { type: 4, data: { content: `✅ Factory reset complete! All your data has been wiped. Check your DMs.`, flags: 64 } };
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
        `${i + 1}. **${p.title || 'Untitled'}** - Protection: ${p.protection_enabled ? '✅' : '❌'}`
      ).join('\n');

      return { type: 4, data: { content: `📝 **Your Pastes:**\n\n${list}\n\n*Use paste name with /scriptprotection, /whitelist, /blacklist commands*`, flags: 64 } };
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

    case 'ai': {
      const user = await getUser();
      if (!user) {
        return { type: 4, data: { content: '❌ Please `/register` or `/login` first.', flags: 64 } };
      }

      const enabled = data.options?.find((o: any) => o.name === 'enabled')?.value;
      const message = data.options?.find((o: any) => o.name === 'message')?.value;

      if (enabled === false) {
        return { type: 4, data: { content: '🤖 **AI Assistant disabled.** Use `/ai enabled:True message:"your question"` to chat with the AI.', flags: 64 } };
      }

      if (!message) {
        return { type: 4, data: { content: '❌ Please provide a message to send to the AI.\n\nExample: `/ai enabled:True message:"How do I make a Roblox script?"`', flags: 64 } };
      }

      // Call the AI chat function
      try {
        const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
        if (!LOVABLE_API_KEY) {
          return { type: 4, data: { content: '❌ AI service is not configured.', flags: 64 } };
        }

        const systemPrompt = `You are a helpful AI assistant for ULT LUA PROTECTS platform. You specialize in:

1. **Roblox Lua Scripting**: Help users write, debug, and optimize Roblox scripts
2. **Web Development**: Assist with HTML, CSS, JavaScript for building websites
3. **Key Systems**: Explain how key systems work and security best practices
4. **Code Review**: Analyze code and provide constructive feedback

Guidelines:
- Provide clear, concise code examples
- Explain complex concepts in simple terms
- Always consider security and best practices
- Be friendly and encouraging
- Keep responses under 1800 characters for Discord

When helping with Roblox scripts, consider game performance and security.
When building websites, focus on clean, modern, responsive design.`;

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: message }
            ],
            max_tokens: 1000,
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error('AI API error:', aiResponse.status, errorText);
          
          if (aiResponse.status === 429) {
            return { type: 4, data: { content: '⏳ AI is busy. Please try again in a moment.', flags: 64 } };
          }
          
          return { type: 4, data: { content: '❌ AI service temporarily unavailable.', flags: 64 } };
        }

        const aiData = await aiResponse.json();
        let aiContent = aiData.choices[0]?.message?.content || 'No response generated.';
        
        // Truncate if too long for Discord
        if (aiContent.length > 1900) {
          aiContent = aiContent.substring(0, 1897) + '...';
        }

        return { 
          type: 4, 
          data: { 
            content: `🤖 **AI Assistant:**\n\n${aiContent}`, 
            flags: 0 
          } 
        };
      } catch (error) {
        console.error('AI chat error:', error);
        return { type: 4, data: { content: '❌ Failed to get AI response. Please try again.', flags: 64 } };
      }
    }

    case 'setwhitelisttime': {
      const user = await getUser();
      if (!user) {
        return { type: 4, data: { content: '❌ Please `/register` or `/login` first.', flags: 64 } };
      }

      const pasteName = data.options?.find((o: any) => o.name === 'paste')?.value;
      const robloxUserId = data.options?.find((o: any) => o.name === 'userid')?.value;
      const eternal = data.options?.find((o: any) => o.name === 'eternal')?.value || false;
      const minutes = data.options?.find((o: any) => o.name === 'minutes')?.value || 0;
      const hours = data.options?.find((o: any) => o.name === 'hours')?.value || 0;
      const days = data.options?.find((o: any) => o.name === 'days')?.value || 0;

      if (!pasteName || !robloxUserId) {
        return { type: 4, data: { content: '❌ Please provide both paste name and user ID.', flags: 64 } };
      }

      // Find paste by title
      const { data: paste } = await supabase
        .from('pastes')
        .select('id, title')
        .eq('user_id', user.userId)
        .ilike('title', pasteName)
        .maybeSingle();

      if (!paste) {
        return { type: 4, data: { content: `❌ Paste "${pasteName}" not found. Use \`/mypastes\` to see your pastes.`, flags: 64 } };
      }

      // Find the whitelist entry
      const { data: entry } = await supabase
        .from('paste_access_control')
        .select('id')
        .eq('paste_id', paste.id)
        .eq('roblox_user_id', robloxUserId)
        .eq('access_type', 'whitelist')
        .maybeSingle();

      if (!entry) {
        return { type: 4, data: { content: `❌ User ID "${robloxUserId}" is not whitelisted on this paste.`, flags: 64 } };
      }

      // Calculate expiration
      let expiresAt = null;
      if (!eternal && (minutes > 0 || hours > 0 || days > 0)) {
        const now = new Date();
        now.setMinutes(now.getMinutes() + minutes);
        now.setHours(now.getHours() + hours);
        now.setDate(now.getDate() + days);
        expiresAt = now.toISOString();
      }

      // Update the entry
      const { error } = await supabase
        .from('paste_access_control')
        .update({ 
          expires_at: expiresAt,
          is_eternal: eternal
        })
        .eq('id', entry.id);

      if (error) {
        return { type: 4, data: { content: `❌ Failed to update: ${error.message}`, flags: 64 } };
      }

      const timeMsg = eternal ? 'Eternal (never expires)' : 
        expiresAt ? `Expires: ${new Date(expiresAt).toLocaleString()}` : 'No expiration set';

      await sendDM(discordUserId, `✅ **Whitelist Time Updated!**\n\n**Paste:** ${paste.title || 'Untitled'}\n**User ID:** ${robloxUserId}\n**Status:** ${timeMsg}`);

      return { type: 4, data: { content: `✅ Updated whitelist time for user **${robloxUserId}**! ${timeMsg}`, flags: 64 } };
    }

    case 'stats': {
      const user = await getUser();
      if (!user) {
        return { type: 4, data: { content: '❌ Please `/register` or `/login` first.', flags: 64 } };
      }

      const pasteName = data.options?.find((o: any) => o.name === 'paste')?.value;

      if (!pasteName) {
        return { type: 4, data: { content: '❌ Please provide a paste name.', flags: 64 } };
      }

      // Find paste by title
      const { data: paste } = await supabase
        .from('pastes')
        .select('id, title')
        .eq('user_id', user.userId)
        .ilike('title', pasteName)
        .maybeSingle();

      if (!paste) {
        return { type: 4, data: { content: `❌ Paste "${pasteName}" not found. Use \`/mypastes\` to see your pastes.`, flags: 64 } };
      }

      // Get execution count
      const { count: execCount } = await supabase
        .from('paste_executions')
        .select('*', { count: 'exact', head: true })
        .eq('paste_id', paste.id);

      // Get whitelist count
      const { count: whitelistCount } = await supabase
        .from('paste_access_control')
        .select('*', { count: 'exact', head: true })
        .eq('paste_id', paste.id)
        .eq('access_type', 'whitelist');

      // Get blacklist count
      const { count: blacklistCount } = await supabase
        .from('paste_access_control')
        .select('*', { count: 'exact', head: true })
        .eq('paste_id', paste.id)
        .eq('access_type', 'blacklist');

      return { 
        type: 4, 
        data: { 
          content: `📊 **Stats for "${paste.title || 'Untitled'}"**\n\n🚀 Executions: ${execCount || 0}\n✅ Whitelisted: ${whitelistCount || 0}\n❌ Blacklisted: ${blacklistCount || 0}`, 
          flags: 64 
        } 
      };
    }

    case 'panel': {
      const user = await getUser();
      if (!user) {
        return { type: 4, data: { content: '❌ Please `/register` or `/login` first.', flags: 64 } };
      }

      const panelName = data.options?.find((o: any) => o.name === 'name')?.value;
      const pasteName = data.options?.find((o: any) => o.name === 'paste')?.value;
      const roleId = data.options?.find((o: any) => o.name === 'role')?.value;
      const channelId = interaction.channel_id;

      if (!panelName || !pasteName || !roleId) {
        return { type: 4, data: { content: '❌ Please provide panel name, paste, and role.', flags: 64 } };
      }

      // Find paste by title
      const { data: paste } = await supabase
        .from('pastes')
        .select('id, title, slug')
        .eq('user_id', user.userId)
        .ilike('title', pasteName)
        .maybeSingle();

      if (!paste) {
        return { type: 4, data: { content: `❌ Paste "${pasteName}" not found. Use \`/mypastes\` to see your pastes.`, flags: 64 } };
      }

      // Create the control panel in database
      const { data: panel, error } = await supabase
        .from('control_panels')
        .insert({
          user_id: user.userId,
          name: panelName,
          paste_id: paste.id,
          discord_role_id: roleId,
          discord_channel_id: channelId
        })
        .select('id')
        .single();

      if (error) {
        console.error('Panel creation error:', error);
        return { type: 4, data: { content: `❌ Failed to create panel: ${error.message}`, flags: 64 } };
      }

      // Send the control panel message with buttons
      const panelEmbed = {
        title: `${panelName} Control Panel`,
        description: `This control panel is for the project: **${panelName}**\nIf you're a buyer, click on the buttons below to redeem your key, get the script or get your role.`,
        color: 0x2B5B3C,
        footer: { 
          text: `Sent by ${discordUsername} | ${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
        }
      };

      const panelButtons = {
        type: 1,
        components: [
          {
            type: 2,
            style: 3, // Success (Green)
            label: 'Redeem Key',
            emoji: { name: '🔑' },
            custom_id: `redeem_key:${panel.id}`
          },
          {
            type: 2,
            style: 1, // Primary (Blue)
            label: 'Get Script',
            emoji: { name: '📜' },
            custom_id: `get_script:${panel.id}`
          },
          {
            type: 2,
            style: 1, // Primary (Blue)
            label: 'Get Role',
            emoji: { name: '🎭' },
            custom_id: `get_role:${panel.id}`
          }
        ]
      };

      // Send the panel message
      const msgResponse = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          embeds: [panelEmbed],
          components: [panelButtons]
        })
      });

      const msgData = await msgResponse.json();

      // Save the message ID
      await supabase
        .from('control_panels')
        .update({ discord_message_id: msgData.id })
        .eq('id', panel.id);

      return { type: 4, data: { content: `✅ Control panel **${panelName}** created! Use \`/genkeys panel:${panelName} amount:10\` to generate keys.`, flags: 64 } };
    }

    case 'genkeys': {
      const user = await getUser();
      if (!user) {
        return { type: 4, data: { content: '❌ Please `/register` or `/login` first.', flags: 64 } };
      }

      const panelName = data.options?.find((o: any) => o.name === 'panel')?.value;
      const amount = data.options?.find((o: any) => o.name === 'amount')?.value || 10;
      const minutes = data.options?.find((o: any) => o.name === 'minutes')?.value;
      const hours = data.options?.find((o: any) => o.name === 'hours')?.value;
      const days = data.options?.find((o: any) => o.name === 'days')?.value;

      if (!panelName) {
        return { type: 4, data: { content: '❌ Please provide a panel name.', flags: 64 } };
      }

      // Find panel by name
      const { data: panel } = await supabase
        .from('control_panels')
        .select('id, name')
        .eq('user_id', user.userId)
        .ilike('name', panelName)
        .maybeSingle();

      if (!panel) {
        return { type: 4, data: { content: `❌ Panel "${panelName}" not found. Use \`/mypanels\` to see your panels.`, flags: 64 } };
      }

      // Calculate expiration time if any time is specified
      let expiresAt: string | null = null;
      let expirationText = "Permanent";
      
      if (minutes || hours || days) {
        const now = new Date();
        let totalMs = 0;
        const parts: string[] = [];
        
        if (days) {
          totalMs += days * 24 * 60 * 60 * 1000;
          parts.push(`${days}d`);
        }
        if (hours) {
          totalMs += hours * 60 * 60 * 1000;
          parts.push(`${hours}h`);
        }
        if (minutes) {
          totalMs += minutes * 60 * 1000;
          parts.push(`${minutes}m`);
        }
        
        expiresAt = new Date(now.getTime() + totalMs).toISOString();
        expirationText = parts.join(' ');
      }

      // Generate keys
      const keys: string[] = [];
      for (let i = 0; i < amount; i++) {
        const key = `${generateRandomKey()}-${generateRandomKey()}-${generateRandomKey()}`;
        keys.push(key);
      }

      // Insert keys into database with expiration
      const keyInserts = keys.map(k => ({
        panel_id: panel.id,
        key_value: k,
        expires_at: expiresAt
      }));

      const { error } = await supabase
        .from('control_panel_keys')
        .insert(keyInserts);

      if (error) {
        console.error('Key generation error:', error);
        return { type: 4, data: { content: `❌ Failed to generate keys: ${error.message}`, flags: 64 } };
      }

      // Create file content
      const fileContent = `# Keys for ${panel.name}\n# Generated: ${new Date().toISOString()}\n# Expiration: ${expirationText}\n# Total: ${amount}\n\n${keys.join('\n')}`;

      // DM the user with the keys file
      await sendDM(
        discordUserId,
        `✅ **Keys Generated!**\n\n**Panel:** ${panel.name}\n**Amount:** ${amount}\n**Expiration:** ${expirationText}\n\nYour keys are attached below. Share these with your buyers!`,
        [{ name: `${panel.name.replace(/\s+/g, '_')}_keys.txt`, content: fileContent }]
      );

      return { type: 4, data: { content: `✅ Generated **${amount}** keys for panel **${panel.name}**! Expiration: **${expirationText}**. Check your DMs for the file.`, flags: 64 } };
    }

    case 'mypanels': {
      const user = await getUser();
      if (!user) {
        return { type: 4, data: { content: '❌ Please `/register` or `/login` first.', flags: 64 } };
      }

      const { data: panels } = await supabase
        .from('control_panels')
        .select('name, created_at')
        .eq('user_id', user.userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!panels || panels.length === 0) {
        return { type: 4, data: { content: '📭 No control panels found. Use `/panel` to create one!', flags: 64 } };
      }

      const list = panels.map((p, i) => 
        `${i + 1}. **${p.name}**`
      ).join('\n');

      return { type: 4, data: { content: `🎮 **Your Control Panels:**\n\n${list}\n\n*Use panel name with /genkeys command*`, flags: 64 } };
    }

    case 'help': {
      return {
        type: 4,
        data: { 
          content: `🤖 **ULT LUA PROTECTS Bot Commands**\n\n**Account:**\n\`/register\` - Create new account\n\`/login\` - Link existing account\n\`/logout\` - Unlink Discord\n\`/profile\` - View your profile\n\`/factoryreset\` - Wipe all your data\n\n**Key Systems:**\n\`/keysystemgen\` - Generate a key system\n\`/mykeys\` - View your key systems\n\n**Scripts:**\n\`/scripts\` - View saved scripts\n\`/savescript\` - Save a script\n\n**Pastebin:**\n\`/paste\` - Create a paste\n\`/mypastes\` - View your pastes\n\`/scriptprotection\` - Toggle protection\n\`/whitelist\` - Add to whitelist\n\`/blacklist\` - Add to blacklist\n\`/setwhitelisttime\` - Set expiration\n\`/stats\` - View stats\n\n**Control Panels:**\n\`/panel\` - Create control panel\n\`/genkeys\` - Generate keys\n\`/mypanels\` - View panels\n\n**AI:**\n\`/ai\` - Chat with AI`, 
          flags: 0 
        }
      };
    }

    default:
      return { type: 4, data: { content: '❓ Unknown command. Use `/help` to see available commands.', flags: 64 } };
  }
}

// Handle button interactions
async function handleButton(interaction: any) {
  const customId = interaction.data.custom_id;
  const discordUserId = interaction.member?.user?.id || interaction.user?.id;
  const guildId = interaction.guild_id;
  
  const supabase = getSupabaseClient();
  
  console.log(`Button clicked: ${customId} by ${discordUserId}`);
  
  const [action, panelId] = customId.split(':');
  
  if (!panelId) {
    return { type: 4, data: { content: '❌ Invalid button.', flags: 64 } };
  }
  
  // Get panel info
  const { data: panel } = await supabase
    .from('control_panels')
    .select('id, name, paste_id, discord_role_id, user_id')
    .eq('id', panelId)
    .single();
  
  if (!panel) {
    return { type: 4, data: { content: '❌ Control panel not found.', flags: 64 } };
  }
  
  // Check if user has redeemed a key for this panel
  const { data: redeemedKey } = await supabase
    .from('control_panel_keys')
    .select('id')
    .eq('panel_id', panelId)
    .eq('redeemed_by_discord_id', discordUserId)
    .maybeSingle();
  
  const isWhitelisted = !!redeemedKey;
  
  switch (action) {
    case 'redeem_key': {
      // Return a modal for key input with Roblox User ID
      return {
        type: 9,
        data: {
          custom_id: `redeem_modal:${panelId}`,
          title: '🔑 Redeem Your Key',
          components: [
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: 'key_input',
                  label: 'Enter your key',
                  style: 1,
                  placeholder: 'XXXXX-XXXXX-XXXXX',
                  required: true,
                  min_length: 17,
                  max_length: 17
                }
              ]
            },
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: 'roblox_userid',
                  label: 'Enter your Roblox User ID',
                  style: 1,
                  placeholder: '123456789',
                  required: true,
                  min_length: 1,
                  max_length: 20
                }
              ]
            }
          ]
        }
      };
    }
    
    case 'get_script': {
      if (!isWhitelisted) {
        return { type: 4, data: { content: '❌ You must redeem a key first to access the script.', flags: 64 } };
      }
      
      // Get the paste
      const { data: paste } = await supabase
        .from('pastes')
        .select('slug')
        .eq('id', panel.paste_id)
        .single();
      
      if (!paste) {
        return { type: 4, data: { content: '❌ Script not found.', flags: 64 } };
      }
      
      const rawUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/get-paste?slug=${paste.slug}`;
      const loadstring = `loadstring(game:HttpGet("${rawUrl}"))()`;
      
      // DM the user the script - ephemeral so only they can see
      return { 
        type: 4, 
        data: { 
          content: `📜 **Here is your script:**\n\n\`\`\`lua\n${loadstring}\n\`\`\`\n\n*This message will disappear when you close it. Copy the script now!*`, 
          flags: 64 
        } 
      };
    }
    
    case 'get_role': {
      if (!isWhitelisted) {
        return { type: 4, data: { content: '❌ You must redeem a key first to get the role.', flags: 64 } };
      }
      
      // Check if user already has the role
      const memberRoles = interaction.member?.roles || [];
      if (memberRoles.includes(panel.discord_role_id)) {
        return { type: 4, data: { content: '✅ You already have the assigned role!', flags: 64 } };
      }
      
      // Assign the role
      try {
        const roleResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}/roles/${panel.discord_role_id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!roleResponse.ok) {
          console.error('Failed to assign role:', await roleResponse.text());
          return { type: 4, data: { content: '❌ Failed to assign role. The bot may not have permission.', flags: 64 } };
        }
        
        return { type: 4, data: { content: `✅ You have been given the <@&${panel.discord_role_id}> role!`, flags: 64 } };
      } catch (error) {
        console.error('Role assignment error:', error);
        return { type: 4, data: { content: '❌ Failed to assign role.', flags: 64 } };
      }
    }
    
    default:
      return { type: 4, data: { content: '❌ Unknown action.', flags: 64 } };
  }
}

// Handle modal submissions
async function handleModal(interaction: any) {
  const customId = interaction.data.custom_id;
  const discordUserId = interaction.member?.user?.id || interaction.user?.id;
  const guildId = interaction.guild_id;
  
  const supabase = getSupabaseClient();
  
  const [action, panelId] = customId.split(':');
  
  if (action === 'redeem_modal') {
    const keyInput = interaction.data.components?.[0]?.components?.[0]?.value;
    const robloxUserId = interaction.data.components?.[1]?.components?.[0]?.value;
    
    if (!keyInput) {
      return { type: 4, data: { content: '❌ Please enter a key.', flags: 64 } };
    }
    
    if (!robloxUserId) {
      return { type: 4, data: { content: '❌ Please enter your Roblox User ID.', flags: 64 } };
    }

    // Validate Roblox user ID is numeric
    if (!/^\d+$/.test(robloxUserId.trim())) {
      return { type: 4, data: { content: '❌ Invalid Roblox User ID. Please enter only numbers.', flags: 64 } };
    }
    
    // Check if key exists and is not redeemed
    const { data: key } = await supabase
      .from('control_panel_keys')
      .select('id, redeemed_by_discord_id, expires_at')
      .eq('panel_id', panelId)
      .eq('key_value', keyInput.trim())
      .maybeSingle();
    
    if (!key) {
      return { type: 4, data: { content: '❌ Invalid key. Please check and try again.', flags: 64 } };
    }

    // Check if key has expired
    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      return { type: 4, data: { content: '❌ This key has expired.', flags: 64 } };
    }
    
    if (key.redeemed_by_discord_id) {
      if (key.redeemed_by_discord_id === discordUserId) {
        return { type: 4, data: { content: '✅ You have already redeemed this key!', flags: 64 } };
      }
      return { type: 4, data: { content: '❌ This key has already been redeemed by someone else.', flags: 64 } };
    }
    
    // Get panel to get paste_id
    const { data: panel } = await supabase
      .from('control_panels')
      .select('discord_role_id, paste_id')
      .eq('id', panelId)
      .single();

    if (!panel) {
      return { type: 4, data: { content: '❌ Control panel not found.', flags: 64 } };
    }

    // Redeem the key and save Roblox user ID
    const { error } = await supabase
      .from('control_panel_keys')
      .update({ 
        redeemed_by_discord_id: discordUserId,
        redeemed_at: new Date().toISOString(),
        roblox_user_id: robloxUserId.trim()
      })
      .eq('id', key.id);
    
    if (error) {
      console.error('Key redemption error:', error);
      return { type: 4, data: { content: '❌ Failed to redeem key.', flags: 64 } };
    }

    // Add Roblox user ID to paste whitelist if paste is connected
    if (panel.paste_id) {
      // Calculate whitelist expiration based on key expiration
      const whitelistExpiresAt = key.expires_at || null;
      const isEternal = !key.expires_at;

      // Check if user is already whitelisted
      const { data: existingAccess } = await supabase
        .from('paste_access_control')
        .select('id')
        .eq('paste_id', panel.paste_id)
        .eq('roblox_user_id', robloxUserId.trim())
        .eq('access_type', 'whitelist')
        .maybeSingle();

      if (existingAccess) {
        // Update existing whitelist entry
        await supabase
          .from('paste_access_control')
          .update({
            expires_at: whitelistExpiresAt,
            is_eternal: isEternal
          })
          .eq('id', existingAccess.id);
      } else {
        // Add new whitelist entry
        await supabase
          .from('paste_access_control')
          .insert({
            paste_id: panel.paste_id,
            roblox_user_id: robloxUserId.trim(),
            access_type: 'whitelist',
            expires_at: whitelistExpiresAt,
            is_eternal: isEternal
          });
      }
    }
    
    // Assign the role automatically
    if (panel?.discord_role_id) {
      try {
        await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}/roles/${panel.discord_role_id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (error) {
        console.error('Auto role assignment failed:', error);
      }
    }

    const expirationMsg = key.expires_at 
      ? `\n⏰ **Expires:** ${new Date(key.expires_at).toLocaleString()}`
      : '';
    
    return { 
      type: 4, 
      data: { 
        content: `✅ **Key Redeemed Successfully!**\n\n🎮 **Roblox User ID:** ${robloxUserId} has been whitelisted!${expirationMsg}\n\nYou now have access to:\n• 📜 Get Script\n• 🎭 Get Role\n\nClick the buttons on the control panel to use them!`, 
        flags: 64 
      } 
    };
  }
  
  return { type: 4, data: { content: '❌ Unknown modal.', flags: 64 } };
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
  console.log("Interaction received:", interaction.type, interaction.data?.name || interaction.data?.custom_id);

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

  // Handle button interactions (type 3)
  if (interaction.type === 3) {
    try {
      const response = await handleButton(interaction);
      return new Response(JSON.stringify(response), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("Button error:", error);
      return new Response(JSON.stringify({
        type: 4,
        data: { content: "❌ An error occurred.", flags: 64 }
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  // Handle modal submissions (type 5)
  if (interaction.type === 5) {
    try {
      const response = await handleModal(interaction);
      return new Response(JSON.stringify(response), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("Modal error:", error);
      return new Response(JSON.stringify({
        type: 4,
        data: { content: "❌ An error occurred.", flags: 64 }
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  return new Response(JSON.stringify({ type: 1 }), {
    headers: { "Content-Type": "application/json" }
  });
});
