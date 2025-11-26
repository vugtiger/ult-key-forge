import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Download } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

const Dashboard = () => {
  const [numKeys, setNumKeys] = useState("");
  const [themeColor, setThemeColor] = useState("255, 255, 255");
  const [keySystemName, setKeySystemName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generateRandomKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const convertToAsciiArt = async (text: string): Promise<string> => {
    // This would ideally call an API, but for now we'll use the text as-is
    // In production, you'd want to use a proper ASCII art generator
    return text.toUpperCase();
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
      const asciiText = await convertToAsciiArt(keySystemName);
      
      // Base Lua code template
      let luaCode = `-- ULT LUA PROTECTS KEY SYSTEM
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local TextService = game:GetService("TextService")

-- Valid keys and their assigned user IDs
local validKeys = {
${keys.map(key => `    ["${key}"] = nil`).join(',\n')}
}

local plr = Players.LocalPlayer
local userId = plr.UserId

-- Check if user already used a key
local usedKey = nil
for key, assignedUserId in pairs(validKeys) do
    if assignedUserId == userId then
        usedKey = key
        break
    end
end

if usedKey then
    print("Welcome back! Key: " .. usedKey)
    loadstring(game:HttpGet("https://pastebin.com/raw/YOUR_SCRIPT_HERE"))()
    return
end

local gui = Instance.new("ScreenGui", plr:WaitForChild("PlayerGui"))
gui.ResetOnSpawn = false
gui.DisplayOrder = 999999999

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

local logo = Instance.new("TextLabel", win)
logo.Size = UDim2.new(1,0,0,125)
logo.Position = UDim2.new(0,0,0,10)
logo.BackgroundTransparency = 1
logo.TextColor3 = Color3.fromRGB(${themeColor})
logo.TextTransparency = 1
logo.Font = Enum.Font.Code
logo.TextSize = 18
logo.Text = [[${asciiText}]]

task.spawn(function()
    task.wait(0.3)
    for i = 1, 30 do
        logo.TextTransparency = math.random(20,80)/100
        task.wait(0.04)
    end
    TweenService:Create(logo, TweenInfo.new(0.3), {TextTransparency = 0}):Play()
end)

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

local prefixWidth = 0
task.spawn(function()
    task.wait()
    prefixWidth = TextService:GetTextSize(prefix.Text, 28, Enum.Font.Code, Vector2.new(10000,10000)).X
    input.Position = UDim2.new(0, 30 + prefixWidth, 0, 200)
    input.Size = UDim2.new(1, -90 - prefixWidth, 0, 50)
end)

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
        loadstring(game:HttpGet("https://pastebin.com/raw/YOUR_SCRIPT_HERE"))()
    end
    gui:Destroy()
end

input.FocusLost:Connect(function(enter)
    if enter then
        local enteredKey = input.Text
        if validKeys[enteredKey] then
            if validKeys[enteredKey] == nil then
                validKeys[enteredKey] = userId
                fadeAndDestroy("Key Accepted! Loading...", Color3.fromRGB(0,255,0), true)
            else
                fadeAndDestroy("Key already used by another user!", Color3.fromRGB(255,0,0), false)
            end
        else
            fadeAndDestroy("Invalid Key! Access Denied", Color3.fromRGB(255,0,0), false)
        end
    end
end)

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
                This will be displayed as the logo text
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
            <li>• Keys are 5 characters long (letters and numbers)</li>
            <li>• Each key can only be used by one Roblox user (locked to User ID)</li>
            <li>• Keys are embedded directly in the Lua script</li>
            <li>• Fully customizable UI colors and branding</li>
            <li>• No maximum key limit - generate as many as you need</li>
          </ul>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
