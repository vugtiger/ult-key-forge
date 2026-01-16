import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Code, Lock, FileCode, Zap, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const ApiDocs = () => {
  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard!');
  };

  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

  const endpoints = [
    {
      method: "GET",
      path: "/get-paste/{slug}",
      description: "Retrieve paste content by slug. Use in Roblox loadstring.",
      auth: "None",
      example: `loadstring(game:HttpService():GetAsync("${baseUrl}/get-paste/your-slug"))()`,
      response: `-- Returns the Lua script content directly
print("Hello from ULT LUA!")`
    },
    {
      method: "POST",
      path: "/verify-account-owner",
      description: "Verify Discord account ownership for key redemption",
      auth: "None",
      example: `fetch("${baseUrl}/verify-account-owner", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    panel_id: "uuid",
    discord_user_id: "123456789",
    roblox_user_id: "987654321"
  })
})`,
      response: `{
  "success": true,
  "message": "Verification successful"
}`
    },
    {
      method: "POST",
      path: "/ai-chat",
      description: "Chat with the AI assistant for Lua scripting help",
      auth: "Bearer Token",
      example: `fetch("${baseUrl}/ai-chat", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_JWT_TOKEN"
  },
  body: JSON.stringify({
    message: "How do I create a part in Roblox?"
  })
})`,
      response: `{
  "response": "To create a part in Roblox, you can use..."
}`
    }
  ];

  const luaExamples = [
    {
      title: "Basic Loadstring",
      code: `-- Load and execute a script from ULT LUA
loadstring(game:HttpService():GetAsync("${baseUrl}/get-paste/your-slug"))()`
    },
    {
      title: "Protected Script with Whitelist",
      code: `-- Protected scripts check player ID automatically
-- The server validates if the player is whitelisted
local success, result = pcall(function()
    return loadstring(game:HttpService():GetAsync(
        "${baseUrl}/get-paste/your-protected-slug?roblox_id=" .. game.Players.LocalPlayer.UserId
    ))()
end)

if not success then
    warn("Script access denied: " .. tostring(result))
end`
    },
    {
      title: "Key System Integration",
      code: `-- Validate a key before executing
local HttpService = game:GetService("HttpService")
local key = "USER_KEY_HERE"

local response = HttpService:RequestAsync({
    Url = "${baseUrl}/validate-key",
    Method = "POST",
    Headers = {
        ["Content-Type"] = "application/json"
    },
    Body = HttpService:JSONEncode({
        key = key,
        roblox_id = game.Players.LocalPlayer.UserId
    })
})

if response.Success then
    local data = HttpService:JSONDecode(response.Body)
    if data.valid then
        -- Key is valid, load the script
        loadstring(data.script)()
    end
end`
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Code className="h-8 w-8" />
            API Documentation
          </h1>
          <p className="text-muted-foreground">
            Integrate ULT LUA into your scripts and applications
          </p>
        </div>

        {/* Quick Start */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Quick Start
            </CardTitle>
            <CardDescription>
              Get started with ULT LUA in under a minute
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted rounded-lg p-4 font-mono text-sm relative">
              <pre>{`-- Simplest way to use ULT LUA
loadstring(game:HttpService():GetAsync("${baseUrl}/get-paste/YOUR_SLUG"))()`}</pre>
              <Button 
                size="sm" 
                variant="ghost" 
                className="absolute top-2 right-2"
                onClick={() => copyCode(`loadstring(game:HttpService():GetAsync("${baseUrl}/get-paste/YOUR_SLUG"))()`)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Replace <code className="bg-muted px-1 rounded">YOUR_SLUG</code> with your paste slug from the Pastebin page.
            </p>
          </CardContent>
        </Card>

        <Tabs defaultValue="endpoints" className="space-y-4">
          <TabsList>
            <TabsTrigger value="endpoints">API Endpoints</TabsTrigger>
            <TabsTrigger value="lua">Lua Examples</TabsTrigger>
            <TabsTrigger value="auth">Authentication</TabsTrigger>
          </TabsList>

          <TabsContent value="endpoints" className="space-y-4">
            {endpoints.map((endpoint, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Badge variant={endpoint.method === "GET" ? "default" : "secondary"}>
                      {endpoint.method}
                    </Badge>
                    <code className="text-sm font-mono">{endpoint.path}</code>
                  </CardTitle>
                  <CardDescription>{endpoint.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Lock className="h-4 w-4" />
                    <span>Auth: {endpoint.auth}</span>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium mb-2">Request Example:</h4>
                    <div className="bg-muted rounded-lg p-4 font-mono text-xs relative overflow-x-auto">
                      <pre>{endpoint.example}</pre>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="absolute top-2 right-2"
                        onClick={() => copyCode(endpoint.example)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium mb-2">Response:</h4>
                    <div className="bg-muted rounded-lg p-4 font-mono text-xs overflow-x-auto">
                      <pre>{endpoint.response}</pre>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="lua" className="space-y-4">
            {luaExamples.map((example, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileCode className="h-5 w-5" />
                    {example.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted rounded-lg p-4 font-mono text-sm relative overflow-x-auto">
                    <pre>{example.code}</pre>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="absolute top-2 right-2"
                      onClick={() => copyCode(example.code)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="auth" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Authentication
                </CardTitle>
                <CardDescription>
                  How to authenticate with the ULT LUA API
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Public Endpoints</h4>
                  <p className="text-sm text-muted-foreground">
                    The <code className="bg-muted px-1 rounded">/get-paste</code> endpoint is public and requires no authentication.
                    This allows you to use loadstring directly from Roblox executors.
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Authenticated Endpoints</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    For protected endpoints, include your JWT token in the Authorization header:
                  </p>
                  <div className="bg-muted rounded-lg p-4 font-mono text-sm">
                    <pre>{`Authorization: Bearer YOUR_JWT_TOKEN`}</pre>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Getting Your Token</h4>
                  <p className="text-sm text-muted-foreground">
                    Your JWT token is generated when you log in to the ULT LUA dashboard.
                    For programmatic access, contact support for API key access.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ApiDocs;
