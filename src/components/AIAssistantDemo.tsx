import { useState, useEffect } from "react";
import { Bot, User } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const demos = [
  {
    user: "Make me a fly script for Roblox",
    assistant: `local player = game.Players.LocalPlayer
local character = player.Character
local humanoid = character:WaitForChild("Humanoid")
local bodyVelocity = Instance.new("BodyVelocity")
bodyVelocity.MaxForce = Vector3.new(math.huge, math.huge, math.huge)
bodyVelocity.Velocity = Vector3.new(0, 50, 0)
bodyVelocity.Parent = character:WaitForChild("HumanoidRootPart")

-- Press E to toggle fly
game:GetService("UserInputService").InputBegan:Connect(function(input)
    if input.KeyCode == Enum.KeyCode.E then
        bodyVelocity.Velocity = Vector3.new(0, 50, 0)
    end
end)`
  },
  {
    user: "Create a speed boost script",
    assistant: `local player = game.Players.LocalPlayer
local character = player.Character or player.CharacterAdded:Wait()
local humanoid = character:WaitForChild("Humanoid")

-- Set walk speed to 100 (default is 16)
humanoid.WalkSpeed = 100

-- Optional: Reset on respawn
player.CharacterAdded:Connect(function(char)
    local hum = char:WaitForChild("Humanoid")
    hum.WalkSpeed = 100
end)

print("Speed boost activated!")`
  },
  {
    user: "Build me a simple landing page",
    assistant: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>My Website</title>
    <style>
        body { font-family: Arial; background: #0a0a0a; color: white; }
        .hero { text-align: center; padding: 100px 20px; }
        h1 { font-size: 3rem; }
        .btn { background: white; color: black; padding: 15px 30px; }
    </style>
</head>
<body>
    <div class="hero">
        <h1>Welcome to My Site</h1>
        <button class="btn">Get Started</button>
    </div>
</body>
</html>`
  }
];

const AIAssistantDemo = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentDemo, setCurrentDemo] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    const runDemo = async () => {
      const demo = demos[currentDemo];
      
      // Clear and start fresh
      setMessages([]);
      setDisplayedText("");
      await new Promise(r => setTimeout(r, 1000));
      
      // Type user message
      setIsTyping(true);
      for (let i = 0; i <= demo.user.length; i++) {
        setDisplayedText(demo.user.substring(0, i));
        await new Promise(r => setTimeout(r, 50));
      }
      
      // Show user message
      setMessages([{ role: "user", content: demo.user }]);
      setDisplayedText("");
      setIsTyping(false);
      await new Promise(r => setTimeout(r, 500));
      
      // Type assistant response
      setIsTyping(true);
      const words = demo.assistant.split(' ');
      let currentText = "";
      for (let i = 0; i < words.length; i++) {
        currentText += (i > 0 ? ' ' : '') + words[i];
        setDisplayedText(currentText);
        await new Promise(r => setTimeout(r, 30));
      }
      
      // Show full response
      setMessages([
        { role: "user", content: demo.user },
        { role: "assistant", content: demo.assistant }
      ]);
      setDisplayedText("");
      setIsTyping(false);
      
      // Wait before next demo
      await new Promise(r => setTimeout(r, 5000));
      setCurrentDemo((prev) => (prev + 1) % demos.length);
    };

    runDemo();
  }, [currentDemo]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-card/50 border border-border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-background/50 px-4 py-3 border-b border-border flex items-center gap-2">
          <Bot size={20} className="text-primary" />
          <span className="font-semibold">AI Assistant</span>
          <span className="text-xs text-muted-foreground ml-auto">Live Demo</span>
        </div>

        {/* Chat Area */}
        <div className="h-[300px] overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Bot size={16} />
                </div>
              )}
              <div className={`max-w-[80%] p-3 rounded-lg ${
                msg.role === "user" 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted"
              }`}>
                {msg.role === "assistant" ? (
                  <pre className="text-xs font-mono whitespace-pre-wrap overflow-x-auto">
                    {msg.content}
                  </pre>
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                  <User size={16} />
                </div>
              )}
            </div>
          ))}
          
          {isTyping && displayedText && (
            <div className="flex gap-3">
              {messages.length === 0 ? (
                <>
                  <div className="flex-1" />
                  <div className="max-w-[80%] p-3 rounded-lg bg-primary text-primary-foreground">
                    <p className="text-sm">{displayedText}<span className="animate-pulse">|</span></p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                    <User size={16} />
                  </div>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Bot size={16} />
                  </div>
                  <div className="max-w-[80%] p-3 rounded-lg bg-muted">
                    <pre className="text-xs font-mono whitespace-pre-wrap">
                      {displayedText}<span className="animate-pulse">|</span>
                    </pre>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Input mockup */}
        <div className="border-t border-border p-3">
          <div className="flex gap-2">
            <div className="flex-1 bg-input rounded-md px-3 py-2 text-sm text-muted-foreground">
              Type a message...
            </div>
            <div className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
              Send
            </div>
          </div>
        </div>
      </div>
      
      <p className="text-center text-sm text-muted-foreground mt-4">
        AI assistant helps with Roblox scripts, websites, and more
      </p>
    </div>
  );
};

export default AIAssistantDemo;
