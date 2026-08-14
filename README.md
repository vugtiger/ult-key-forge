# Ultluaprotectsyourode

make a website called Ult Lua protects make it so that theres a login page btw a good one at that and it needs to be able to detect if an account exist or dose not exist bc if you js create an account and create an another account with the same info then the website is js not fully properly done but yeah it need to know when somene has made an account and if the account is made and stuff and if its not made and stuff like that but yeah  make it so that theres ofc a dashboard and tabs on theleft side logout button on the tabs dashboard thing and a settings  button where you can enter chage the website theme ccolor to anything you want but yeah etc for the tabs add Key system Gen  make it so that in that tab theres stuff in there like download file  3 text boxes 1 named how many keys second one named ui theme color  third one named key system name  so first heres the code we gonna be using -- // ANFERIA KEY SYSTEM - FIXED DRAGGING + PERFECT INPUT \\ --

local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local TextService = game:GetService("TextService")

local plr = Players.LocalPlayer
local gui = Instance.new("ScreenGui", plr:WaitForChild("PlayerGui"))
gui.ResetOnSpawn = false
gui.DisplayOrder = 999999999

-- Window
local win = Instance.new("Frame", gui)
win.Size = UDim2.new(0, 680, 0, 290)
win.Position = UDim2.new(0.5, -340, 0.5, -145)
win.BackgroundColor3 = Color3.fromRGB(20,20,20)
win.BackgroundTransparency = 1
win.BorderSizePixel = 0
win.ClipsDescendants = true

local outline = Instance.new("UIStroke", win)
outline.Thickness = 2
outline.Color = Color3.new(1,1,1)
local glow = Instance.new("UIStroke", win)
glow.Thickness = 6
glow.Transparency = 0.65
glow.Color = Color3.new(1,1,1)

-- Logo + flicker
local logo = Instance.new("TextLabel", win)
logo.Size = UDim2.new(1,0,0,125)
logo.Position = UDim2.new(0,0,0,10)
logo.BackgroundTransparency = 1
logo.TextColor3 = Color3.new(1,1,1)
logo.TextTransparency = 1
logo.Font = Enum.Font.Code
logo.TextSize = 18
logo.Text = [[
█████╗ ███╗   ██╗███████╗██████╗ ██╗   █████╗ ██╗
██╔══██╗████╗  ██║██╔════╝██╔══██╗██║  ██╔══██╗██║
███████║██╔██╗ ██║█████╗  ██████╔╝██║  ███████║██║
██╔══██║██║╚██╗██║██╔══╝  ██╔══██╗██║  ██╔══██║██║
██║  ██║██║ ╚████║███████╗██║  ██║██║  ██║  ██║███████╗
╚═╝  ╚═╝╚═╝  ╚══╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝  ╚═╝╚══════╝
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
prefix.Text = "Pls enter your key > "
prefix.TextColor3 = Color3.new(1,1,1)
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
input.TextColor3 = Color3.new(1,1,1)
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
        loadstring(game:HttpGet("https://pastebin.com/raw/YOUR_SCRIPT_HERE"))()
    end
    gui:Destroy()
end

input.FocusLost:Connect(function(enter)
    if enter and input.Text == "ACCTOPG" then  -- CHANGE YOUR KEY HERE
        fadeAndDestroy("Key Accepted! Loading...", Color3.fromRGB(0,255,0), true)
    elseif enter then
        fadeAndDestroy("Wrong Key! Access Denied", Color3.fromRGB(255,0,0), false)
    end
end)

-- FIXED DRAGGING (no more sticking)
local dragging = false
local dragStart, startPos

local function startDrag(input)
    dragging = true
    dragStart = input.Position
    startPos = win.Position
end

local function stopDrag()
    dragging = false
end

local lastClickTime = 0
win.InputBegan:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseButton1 then
        local now = tick()
        if now - lastClickTime < 0.35 then
            fadeAndDestroy("Closed.", Color3.fromRGB(200,200,200), false)
            return
        end
        lastClickTime = now
        startDrag(input)
    end
end)

win.InputEnded:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseButton1 then
        stopDrag()
    end
end)

UserInputService.InputChanged:Connect(function(input)
    if dragging and input.UserInputType == Enum.UserInputType.MouseMovement then
        local delta = input.Position - dragStart
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

now for the first text box when they enter a number of how many keys they want to be on this key system and download the file you change the key in that code to however many keys they wated added also you need to edit the code to make it so that only one roblox user can use one of the random generated keys and nobody else can  you can do this by making it so that the code can detect what roblox user id uses one of the keys when they use it nobody else can but yeah 

now bassically however many keys they want generated is how many random generated keys you add to the code and they download th code with the keys they wanted added and every one of those keys can be used by one roblox user By using user id 


now for the second text box ui theme color what this dose is you select what color you want the  ui color to be not the whole ui bassically as you can see in th code i sent you make everything thats white whatever rgb color code they type in thata text box when they download it every white rgb color code will be turned into that rgb color code they wanted it to be 

now for the secod one  as you can see in the code theres this strange text called █████╗ ███╗   ██╗███████╗██████╗ ██╗ █████╗  ██╗
██╔══██╗████╗  ██║██╔════╝██╔══██╗██║██╔══██╗██║
███████║██╔██╗ ██║█████╗  ██████╔╝██║███████║██║
██╔══██║██║╚██╗██║██╔══╝  ██╔══██╗██║██╔══██║██║
██║  ██║██║ ╚████║███████╗██║  ██║██║██║  ██║███████╗
╚═╝  ╚═╝╚═╝  ╚══╝╚══════╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚══════╝ 

bassically whatever text or anything they type in that text box turns into that  but in the text they put in the text box so like for instance hello will turn into big giant word called hello like this █████╗ ███╗   ██╗███████╗██████╗ ██╗ █████╗  ██╗
██╔══██╗████╗  ██║██╔════╝██╔══██╗██║██╔══██╗██║
███████║██╔██╗ ██║█████╗  ██████╔╝██║███████║██║
██╔══██║██║╚██╗██║██╔══╝  ██╔══██╗██║██╔══██║██║
██║  ██║██║ ╚████║███████╗██║  ██║██║██║  ██║███████╗
╚═╝  ╚═╝╚═╝  ╚══╝╚══════╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚══════╝

but yeah now if you have any other ideas on what other tabs to add then add it you can add like a save tab where you upload roblox scripts and you save them there to come back later to dowload it bassically a storage you can add a ai chatbot that helps user understand what the site is about and can help them generate roblox script code they want and even build websites for them with a preview screen and a thing where you can see the html code and all that other code its building for your website and you can even publish the website and download all the code in one file that the ai made 

um and if any other ideas then add them 


also on the login page make it so that when you scroll down you see allfeatures you see screenshots of the tabs the features in the tabs everything it has its on section showcasing the features 


also i want the website theme to be white and black themed futuristic website no i mean  for the ui black color is the main thing for backgrounds and stuff white is for texts and stuff also make the whole website look more futureristic then this black and white black as in for backgrounds and stuff and white as in texts and stuff js make the website look good and not fucking cheap this should not look cheap it should look futuristic with black color as backgrounds and stuff and white as texts ad stuff i dont want this to look cheap again it much look offical and really good so do your best and dont fuck this website up again MAKE IT LOOK OFFICAL AND GOOD like i said it should look 


also make it so that there isnt a max to how many keys you can get on the keysystem and yeah thats it

also for the keys make it so that the keys are 5 letter/numbers long like this for example 8k3f7 but yeah  

also no emojies only icons

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ultluacodeprotectsyourcode.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a02bb7a8-0df5-476b-84f6-2f85cbc62792).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitLab and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
