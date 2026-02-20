import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Download } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import TabHelpSection from "@/components/onboarding/TabHelpSection";
import { keySystemHelp } from "@/components/onboarding/helpContent";

// ASCII art character map for converting text
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

const convertToAsciiArt = (text: string): string => {
  const upperText = text.toUpperCase();
  const lines: string[] = ['', '', '', '', '', ''];
  
  for (const char of upperText) {
    const asciiChar = asciiChars[char] || asciiChars[' '];
    for (let i = 0; i < 6; i++) {
      lines[i] += asciiChar[i] || '   ';
    }
  }
  
  return lines.join('\n');
};

const Dashboard = () => {
  const [numKeys, setNumKeys] = useState("");
  const [themeColor, setThemeColor] = useState("255, 255, 255");
  const [keySystemName, setKeySystemName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generateRandomKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const generateLuaCode = async () => {
    if (!numKeys || !keySystemName) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const keys = Array.from({ length: parseInt(numKeys) }, () => generateRandomKey());
      const asciiText = convertToAsciiArt(keySystemName);
      
      const luaCode = `-- // ULT LUA PROTECTS KEY SYSTEM \\ --

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
local VALID_KEYS = {${keys.map(key => `"${key}"`).join(', ')}}

-- Storage for used keys (key -> userId mapping)
local usedKeysData = {}
local DATA_KEY = "UltLuaUsedKeys_${keySystemName.replace(/\s+/g, '_')}"

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

      // Save to database
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await supabase.from('key_systems').insert({
        user_id: user.id,
        name: keySystemName,
        num_keys: parseInt(numKeys),
        theme_color: themeColor,
        ascii_text: asciiText,
        generated_code: luaCode,
      });

      // Log activity for password reset verification
      await supabase.from('user_activity').insert({
        user_id: user.id,
        activity_type: 'key_system_created',
        activity_data: { name: keySystemName, num_keys: parseInt(numKeys) }
      });

      // Download file
      const blob = new Blob([luaCode], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${keySystemName.replace(/\s+/g, '_')}_KeySystem.lua`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success!",
        description: "Key system generated and downloaded",
      });

      // Reset form
      setNumKeys("");
      setThemeColor("255, 255, 255");
      setKeySystemName("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Key System Generator</h1>
          <p className="text-muted-foreground">
            Create custom key systems with unlimited keys and full customization
          </p>
        </div>

        <TabHelpSection {...keySystemHelp} />

        <Card className="p-6 cyber-border bg-card/50 backdrop-blur-xl">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="numKeys">Number of Keys</Label>
              <Input
                id="numKeys"
                type="number"
                min="1"
                placeholder="e.g., 100"
                value={numKeys}
                onChange={(e) => setNumKeys(e.target.value)}
                className="bg-input"
              />
              <p className="text-sm text-muted-foreground">
                Enter how many keys you want to generate (no limit)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="themeColor">UI Theme Color (RGB)</Label>
              <Input
                id="themeColor"
                placeholder="e.g., 255, 100, 50"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
                className="bg-input"
              />
              <p className="text-sm text-muted-foreground">
                Enter RGB values (e.g., "255, 255, 255" for white)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="keySystemName">Key System Name</Label>
              <Input
                id="keySystemName"
                placeholder="e.g., MY COOL SCRIPT"
                value={keySystemName}
                onChange={(e) => setKeySystemName(e.target.value)}
                className="bg-input"
              />
              <p className="text-sm text-muted-foreground">
                This will be converted to ASCII art and displayed as the logo
              </p>
            </div>

            <Button
              onClick={generateLuaCode}
              disabled={loading}
              className="w-full cyber-glow"
              size="lg"
            >
              <Download className="mr-2" size={20} />
              {loading ? "Generating..." : "Generate & Download"}
            </Button>
          </div>
        </Card>

        <Card className="p-6 bg-card/30 border-border/50">
          <h3 className="text-lg font-semibold mb-3">How it works:</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>- Keys are 5 characters long (letters and numbers)</li>
            <li>- Each key can only be used by one Roblox user (locked to User ID via DataStore)</li>
            <li>- Keys persist across sessions using Roblox DataStore</li>
            <li>- Name is converted to ASCII art automatically</li>
            <li>- Fully customizable UI colors</li>
            <li>- No maximum key limit - generate as many as you need</li>
          </ul>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
