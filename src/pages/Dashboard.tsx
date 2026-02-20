import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Zap, ChevronRight, ChevronLeft, Check, Copy, Download, Key, Clock, Hash, Users, Link2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// ASCII art
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
    for (let i = 0; i < 6; i++) lines[i] += asciiChar[i] || '   ';
  }
  return lines.join('\n');
};

const KEY_DURATIONS = [
  { label: '1 Hour', value: '1h', ms: 60 * 60 * 1000 },
  { label: '6 Hours', value: '6h', ms: 6 * 60 * 60 * 1000 },
  { label: '24 Hours', value: '24h', ms: 24 * 60 * 60 * 1000 },
  { label: '7 Days', value: '7d', ms: 7 * 24 * 60 * 60 * 1000 },
  { label: '30 Days', value: '30d', ms: 30 * 24 * 60 * 60 * 1000 },
  { label: 'Permanent', value: 'permanent', ms: 0 },
];

const generateRandomKey = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

interface Paste {
  id: string;
  title: string | null;
  slug: string;
}

interface GeneratedKey {
  key: string;
  expiresAt: string | null;
}

const STEPS = ['Select Paste', 'Configure Keys', 'Roblox IDs', 'Generate'];

const Dashboard = () => {
  const [step, setStep] = useState(0);
  const [pastes, setPastes] = useState<Paste[]>([]);
  const [selectedPaste, setSelectedPaste] = useState<string>('');
  const [keySystemName, setKeySystemName] = useState('');
  const [themeColor, setThemeColor] = useState('255, 255, 255');
  const [numKeys, setNumKeys] = useState('10');
  const [duration, setDuration] = useState('permanent');
  const [robloxIds, setRobloxIds] = useState('');
  const [generatedKeys, setGeneratedKeys] = useState<GeneratedKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPastes, setLoadingPastes] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchPastes = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('pastes').select('id, title, slug').eq('user_id', user.id).order('created_at', { ascending: false });
      setPastes(data || []);
      setLoadingPastes(false);
    };
    fetchPastes();
  }, []);

  const handleGenerate = async () => {
    if (!selectedPaste || !keySystemName || !numKeys) {
      toast({ title: "Missing fields", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const count = Math.min(parseInt(numKeys), 500);
      const durationConfig = KEY_DURATIONS.find(d => d.value === duration)!;
      const now = Date.now();

      // Generate keys
      const keys: GeneratedKey[] = Array.from({ length: count }, () => ({
        key: generateRandomKey(),
        expiresAt: durationConfig.ms > 0 ? new Date(now + durationConfig.ms).toISOString() : null,
      }));

      // Insert keys linked to the paste (via control_panel_keys via a new control panel)
      // First, create/find a control panel for this paste
      let panelId: string;
      const { data: existingPanel } = await supabase
        .from('control_panels')
        .select('id')
        .eq('paste_id', selectedPaste)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingPanel) {
        panelId = existingPanel.id;
      } else {
        const { data: newPanel, error: panelError } = await supabase
          .from('control_panels')
          .insert({ user_id: user.id, name: keySystemName, paste_id: selectedPaste })
          .select('id')
          .single();
        if (panelError) throw panelError;
        panelId = newPanel.id;
      }

      // Insert keys
      const keyInserts = keys.map(k => ({
        panel_id: panelId,
        key_value: k.key,
        expires_at: k.expiresAt,
      }));
      const { error: keysError } = await supabase.from('control_panel_keys').insert(keyInserts);
      if (keysError) throw keysError;

      // Add Roblox user IDs to paste access control
      const robloxIdList = robloxIds
        .split('\n')
        .map(id => id.trim())
        .filter(id => id && /^\d+$/.test(id) && parseInt(id) >= 1000);

      if (robloxIdList.length > 0) {
        const accessInserts = robloxIdList.map(robloxId => ({
          paste_id: selectedPaste,
          roblox_user_id: robloxId,
          access_type: 'whitelist',
          is_eternal: durationConfig.ms === 0,
          expires_at: durationConfig.ms > 0 ? new Date(now + durationConfig.ms).toISOString() : null,
        }));
        await supabase.from('paste_access_control').upsert(accessInserts, { onConflict: 'paste_id,roblox_user_id' });
      }

      // Generate + save the Lua key system code
      const asciiText = convertToAsciiArt(keySystemName);
      const keyList = keys.map(k => `"${k.key}"`).join(', ');
      const luaCode = `-- // ULT LUA KEY SYSTEM - Generated for ${keySystemName} \\ --

local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local TextService = game:GetService("TextService")
local HttpService = game:GetService("HttpService")

local plr = Players.LocalPlayer
local gui = Instance.new("ScreenGui", plr:WaitForChild("PlayerGui"))
gui.ResetOnSpawn = false
gui.DisplayOrder = 999999999

local VALID_KEYS = {${keyList}}
local usedKeysData = {}
local DATA_KEY = "UltLuaUsedKeys_${keySystemName.replace(/\s+/g, '_')}"

local function loadUsedKeys()
    local success, data = pcall(function()
        return HttpService:JSONDecode(game:GetService("DataStoreService"):GetDataStore(DATA_KEY):GetAsync("keys") or "{}")
    end)
    if success then usedKeysData = data end
end

local function saveUsedKeys()
    pcall(function()
        game:GetService("DataStoreService"):GetDataStore(DATA_KEY):SetAsync("keys", HttpService:JSONEncode(usedKeysData))
    end)
end

loadUsedKeys()

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
        -- REPLACE WITH YOUR PASTE URL
        loadstring(game:HttpGet("YOUR_PASTE_URL_HERE"))()
    end
    gui:Destroy()
end

input.FocusLost:Connect(function(enter)
    if not enter then return end
    local userId = tostring(plr.UserId)
    local enteredKey = input.Text
    local isValidKey = false
    for _, key in ipairs(VALID_KEYS) do
        if key == enteredKey then isValidKey = true break end
    end
    if not isValidKey then
        fadeAndDestroy("Wrong Key! Access Denied", Color3.fromRGB(255,0,0), false)
        return
    end
    if usedKeysData[enteredKey] then
        if usedKeysData[enteredKey] == userId then
            fadeAndDestroy("Key Accepted! Loading...", Color3.fromRGB(0,255,0), true)
        else
            fadeAndDestroy("Key Already Used! Access Denied", Color3.fromRGB(255,0,0), false)
        end
        return
    end
    usedKeysData[enteredKey] = userId
    saveUsedKeys()
    fadeAndDestroy("Key Accepted! Loading...", Color3.fromRGB(0,255,0), true)
end)

local dragging = false
local dragStart, startPos
local lastClickTime = 0
win.InputBegan:Connect(function(inputObj)
    if inputObj.UserInputType == Enum.UserInputType.MouseButton1 then
        local now = tick()
        if now - lastClickTime < 0.35 then
            fadeAndDestroy("Closed.", Color3.fromRGB(200,200,200), false)
            return
        end
        lastClickTime = now
        dragging = true
        dragStart = inputObj.Position
        startPos = win.Position
    end
end)
win.InputEnded:Connect(function(i)
    if i.UserInputType == Enum.UserInputType.MouseButton1 then dragging = false end
end)
UserInputService.InputChanged:Connect(function(i)
    if dragging and i.UserInputType == Enum.UserInputType.MouseMovement then
        local d = i.Position - dragStart
        win.Position = UDim2.new(startPos.X.Scale, startPos.X.Offset + d.X, startPos.Y.Scale, startPos.Y.Offset + d.Y)
    end
end)

TweenService:Create(win, TweenInfo.new(0.7), {BackgroundTransparency = 0.25}):Play()
TweenService:Create(prefix, TweenInfo.new(0.7), {TextTransparency = 0}):Play()
TweenService:Create(input, TweenInfo.new(0.7), {TextTransparency = 0}):Play()
`;

      // Save key system record
      await supabase.from('key_systems').insert({
        user_id: user.id,
        name: keySystemName,
        num_keys: count,
        theme_color: themeColor,
        ascii_text: asciiText,
        generated_code: luaCode,
      });

      await supabase.from('user_activity').insert({
        user_id: user.id,
        activity_type: 'key_system_created',
        activity_data: { name: keySystemName, num_keys: count, paste_id: selectedPaste, duration }
      });

      setGeneratedKeys(keys);
      setStep(4);

      toast({ title: "✅ Key System Created!", description: `${count} keys generated and linked to your paste` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyAllKeys = () => {
    navigator.clipboard.writeText(generatedKeys.map(k => k.key).join('\n'));
    toast({ title: "Copied!", description: "All keys copied to clipboard" });
  };

  const downloadKeys = () => {
    const blob = new Blob([generatedKeys.map(k => k.key).join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${keySystemName.replace(/\s+/g, '_')}_keys.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetWizard = () => {
    setStep(0);
    setSelectedPaste('');
    setKeySystemName('');
    setThemeColor('255, 255, 255');
    setNumKeys('10');
    setDuration('permanent');
    setRobloxIds('');
    setGeneratedKeys([]);
  };

  const canProceed = () => {
    if (step === 0) return !!selectedPaste && !!keySystemName;
    if (step === 1) return !!numKeys && parseInt(numKeys) > 0 && !!duration;
    return true;
  };

  const selectedPasteObj = pastes.find(p => p.id === selectedPaste);

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <Zap className="text-primary" size={36} />
            Key System Generator
          </h1>
          <p className="text-muted-foreground">Automate your entire key system in seconds — linked directly to your paste</p>
        </div>

        {/* Step Indicator */}
        {step < 4 && (
          <div className="flex items-center gap-2 mb-6">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  i < step ? 'bg-primary text-primary-foreground' :
                  i === step ? 'bg-primary/20 border-2 border-primary text-primary' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {i < step ? <Check size={14} /> : i + 1}
                </div>
                <span className={`text-xs hidden sm:block ${i === step ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{label}</span>
                {i < STEPS.length - 1 && <div className={`h-px w-6 sm:w-12 ${i < step ? 'bg-primary' : 'bg-border'}`} />}
              </div>
            ))}
          </div>
        )}

        {/* STEP 0: Select Paste + Name */}
        {step === 0 && (
          <Card className="p-6 cyber-border bg-card/50 backdrop-blur-xl space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <Link2 className="text-primary" size={20} />
              <h2 className="text-lg font-semibold">Link to a Paste</h2>
            </div>

            <div className="space-y-2">
              <Label>Select Your Paste</Label>
              {loadingPastes ? (
                <div className="text-sm text-muted-foreground">Loading pastes...</div>
              ) : pastes.length === 0 ? (
                <div className="text-sm text-muted-foreground p-3 border border-border/50 rounded-lg">
                  No pastes found. <a href="/pastebin" className="text-primary underline">Create a paste first</a>.
                </div>
              ) : (
                <Select value={selectedPaste} onValueChange={setSelectedPaste}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a paste..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pastes.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title || p.slug} <span className="text-muted-foreground text-xs ml-1">/{p.slug}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Key System Name</Label>
              <Input
                placeholder="e.g., MY HUB"
                value={keySystemName}
                onChange={(e) => setKeySystemName(e.target.value.toUpperCase())}
                className="uppercase"
              />
              <p className="text-xs text-muted-foreground">This will be shown as ASCII art in the key GUI</p>
            </div>

            <div className="space-y-2">
              <Label>UI Theme Color (RGB)</Label>
              <Input
                placeholder="e.g., 255, 100, 50"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
              />
            </div>
          </Card>
        )}

        {/* STEP 1: Configure Keys */}
        {step === 1 && (
          <Card className="p-6 cyber-border bg-card/50 backdrop-blur-xl space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <Key className="text-primary" size={20} />
              <h2 className="text-lg font-semibold">Configure Keys</h2>
            </div>

            <div className="space-y-2">
              <Label>Number of Keys to Generate</Label>
              <Input
                type="number"
                min="1"
                max="500"
                placeholder="e.g., 50"
                value={numKeys}
                onChange={(e) => setNumKeys(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Max 500 keys per generation</p>
            </div>

            <div className="space-y-2">
              <Label>Key Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KEY_DURATIONS.map(d => (
                    <SelectItem key={d.value} value={d.value}>
                      <div className="flex items-center gap-2">
                        <Clock size={14} />
                        {d.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {duration === 'permanent' ? 'Keys never expire' : `Keys expire after ${KEY_DURATIONS.find(d => d.value === duration)?.label}`}
              </p>
            </div>
          </Card>
        )}

        {/* STEP 2: Roblox IDs */}
        {step === 2 && (
          <Card className="p-6 cyber-border bg-card/50 backdrop-blur-xl space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <Users className="text-primary" size={20} />
              <h2 className="text-lg font-semibold">Whitelist Roblox Users (Optional)</h2>
            </div>

            <div className="space-y-2">
              <Label>Roblox User IDs</Label>
              <Textarea
                placeholder={"123456789\n987654321\n..."}
                value={robloxIds}
                onChange={(e) => setRobloxIds(e.target.value)}
                className="min-h-[150px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Enter one Roblox user ID per line. These users will be added to your paste's whitelist with the selected duration. Skip this step to use key-only access.
              </p>
            </div>
          </Card>
        )}

        {/* STEP 3: Review & Generate */}
        {step === 3 && (
          <Card className="p-6 cyber-border bg-card/50 backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Hash className="text-primary" size={20} />
              <h2 className="text-lg font-semibold">Review & Generate</h2>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-border/30">
                <span className="text-muted-foreground">Paste</span>
                <span className="font-medium">{selectedPasteObj?.title || selectedPasteObj?.slug || '—'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/30">
                <span className="text-muted-foreground">Key System Name</span>
                <span className="font-medium">{keySystemName}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/30">
                <span className="text-muted-foreground">Number of Keys</span>
                <span className="font-medium">{numKeys}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/30">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">{KEY_DURATIONS.find(d => d.value === duration)?.label}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/30">
                <span className="text-muted-foreground">Whitelisted Users</span>
                <span className="font-medium">{robloxIds.split('\n').filter(id => id.trim() && /^\d+$/.test(id.trim()) && parseInt(id.trim()) >= 1000).length} users</span>
              </div>
            </div>

            <Button onClick={handleGenerate} disabled={loading} className="w-full cyber-glow" size="lg">
              <Zap className="mr-2" size={20} />
              {loading ? "Generating..." : "Generate Key System"}
            </Button>
          </Card>
        )}

        {/* STEP 4: Results */}
        {step === 4 && (
          <Card className="p-6 cyber-border bg-card/50 backdrop-blur-xl space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <Check className="text-green-500" size={20} />
              <h2 className="text-lg font-semibold text-green-500">Key System Created!</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {generatedKeys.length} keys generated and linked to your paste. Share the keys with your users.
            </p>

            <div className="flex gap-2">
              <Button onClick={copyAllKeys} variant="outline" className="flex-1">
                <Copy className="mr-2" size={16} /> Copy All Keys
              </Button>
              <Button onClick={downloadKeys} variant="outline" className="flex-1">
                <Download className="mr-2" size={16} /> Download Keys
              </Button>
            </div>

            <div className="max-h-64 overflow-y-auto bg-muted/30 rounded-lg p-3 font-mono text-sm space-y-1">
              {generatedKeys.map((k, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className="text-foreground">{k.key}</span>
                  {k.expiresAt && <span className="text-xs text-muted-foreground">expires {new Date(k.expiresAt).toLocaleDateString()}</span>}
                </div>
              ))}
            </div>

            <Button onClick={resetWizard} className="w-full" variant="outline">
              Create Another Key System
            </Button>
          </Card>
        )}

        {/* Navigation Buttons */}
        {step < 4 && (
          <div className="flex gap-3">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(s => s - 1)} className="flex-1">
                <ChevronLeft size={16} className="mr-1" /> Back
              </Button>
            )}
            {step < 3 ? (
              <Button
                onClick={() => setStep(s => s + 1)}
                disabled={!canProceed()}
                className="flex-1 cyber-glow"
              >
                Next <ChevronRight size={16} className="ml-1" />
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
