import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/DashboardLayout";
import TabHelpSection from "@/components/onboarding/TabHelpSection";
import { discordBotHelp } from "@/components/onboarding/helpContent";
import { Bot, Check, Shield, Key, FileText, Users, Zap, ExternalLink, Command, Clock, Ban, RefreshCw, Globe, Sparkles, EyeOff } from "lucide-react";

const DiscordBot = () => {
  const inviteUrl = "https://discord.com/oauth2/authorize?client_id=1407376197771595816&permissions=8&integration_type=0&scope=bot";

  const features = [
    {
      icon: <Key className="w-5 h-5" />,
      title: "Key System Generation",
      description: "Generate custom key systems with unlimited keys directly from Discord"
    },
    {
      icon: <FileText className="w-5 h-5" />,
      title: "Paste Management",
      description: "Create, manage, and protect your pastes with script protection"
    },
    {
      icon: <Users className="w-5 h-5" />,
      title: "Whitelist/Blacklist Control",
      description: "Manage user access with Roblox user ID whitelisting and blacklisting"
    },
    {
      icon: <Shield className="w-5 h-5" />,
      title: "Control Panels",
      description: "Create interactive buyer panels with key redemption and role assignment"
    },
    {
      icon: <Clock className="w-5 h-5" />,
      title: "Expiration Management",
      description: "Set custom expiration times for keys (minutes, hours, days)"
    },
    {
      icon: <Ban className="w-5 h-5" />,
      title: "Console Blacklist",
      description: "Block specific Discord users from using your control panels"
    },
    {
      icon: <RefreshCw className="w-5 h-5" />,
      title: "Force Expire",
      description: "Manually expire user access and remove them from whitelists"
    },
    {
      icon: <Globe className="w-5 h-5" />,
      title: "Public Protection",
      description: "Free-for-all execution without whitelist, blacklist still works"
    },
    {
      icon: <EyeOff className="w-5 h-5" />,
      title: "Hide Code",
      description: "Hide code from raw URL - shows blank but loadstring works",
      isNew: true
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: "AI Assistant",
      description: "Chat with an AI assistant for Roblox scripting help"
    }
  ];

  const commands = [
    { name: "/register", description: "Create a new account", category: "Account" },
    { name: "/login", description: "Link existing account to Discord", category: "Account" },
    { name: "/logout", description: "Unlink Discord from account", category: "Account" },
    { name: "/profile", description: "View your profile and stats", category: "Account" },
    { name: "/factoryreset", description: "Wipe all data (account stays)", category: "Account" },
    { name: "/savescript", description: "Save a script to account", category: "Scripts" },
    { name: "/scripts", description: "View saved scripts", category: "Scripts" },
    { name: "/deletescript", description: "Delete a saved script", category: "Scripts" },
    { name: "/paste", description: "Create a paste", category: "Pastebin" },
    { name: "/mypastes", description: "View your pastes", category: "Pastebin" },
    { name: "/deletepaste", description: "Delete a paste", category: "Pastebin" },
    { name: "/scriptprotection", description: "Toggle protection on paste", category: "Pastebin" },
    { name: "/publicprotection", description: "Protection without whitelist", category: "Pastebin" },
    { name: "/hidecode", description: "Hide code from raw URL", category: "Pastebin" },
    { name: "/whitelist", description: "Add user to whitelist", category: "Pastebin" },
    { name: "/blacklist", description: "Add user to blacklist", category: "Pastebin" },
    { name: "/removewhitelist", description: "Remove from whitelist", category: "Pastebin" },
    { name: "/removeblacklist", description: "Remove from blacklist", category: "Pastebin" },
    { name: "/setwhitelisttime", description: "Set whitelist expiration", category: "Pastebin" },
    { name: "/stats", description: "View paste statistics", category: "Pastebin" },
    { name: "/iptracking", description: "Toggle IP tracking", category: "Settings", isNew: true },
    { name: "/setgame", description: "Set game restriction + bind game", category: "Settings", isNew: true },
    { name: "/mygamelinkedpastes", description: "View game-bound pastes", category: "Settings", isNew: true },
    { name: "/consolefeedback", description: "Toggle loading bar + welcome msg", category: "Settings", isNew: true },
    { name: "/keysystemsetup", description: "Create key system for a paste", category: "Key Systems", isNew: true },
    { name: "/keygen", description: "Generate more keys", category: "Key Systems", isNew: true },
    { name: "/mykeysystemkeys", description: "View key stats for a paste", category: "Key Systems", isNew: true },
    { name: "/keysystemwhitelist", description: "Assign user ID to a key", category: "Key Systems", isNew: true },
    { name: "/deletekeysystem", description: "Delete key system from paste", category: "Key Systems", isNew: true },
    { name: "/panel", description: "Create control panel", category: "Control Panels" },
    { name: "/mypanels", description: "View your panels", category: "Control Panels" },
    { name: "/consoleblacklist", description: "Blacklist from panel", category: "Control Panels" },
    { name: "/unblacklist", description: "Remove from blacklist", category: "Control Panels" },
    { name: "/forceexpire", description: "Force expire access", category: "Control Panels" },
    { name: "/analytics", description: "View your account analytics", category: "Other", isNew: true },
    { name: "/invite", description: "Get bot invite link", category: "Other", isNew: true },
    { name: "/logs", description: "Set changelog notifications channel", category: "Other", isNew: true },
    { name: "/help", description: "Show all commands", category: "Other" }
  ];

  // Group commands by category
  const categories = Array.from(new Set(commands.map(c => c.category)));

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/20 mb-6">
            <Bot className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Discord Bot</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-6">
            Manage your key systems, pastes, and control panels directly from Discord with our powerful bot
          </p>
          
          {/* Status Badge */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <Badge variant="outline" className="px-4 py-2 text-sm border-primary/50 bg-primary/10">
              <span className="w-2 h-2 rounded-full bg-primary mr-2 animate-pulse"></span>
              Bot Online
            </Badge>
            <Badge variant="outline" className="px-4 py-2 text-sm border-primary/50 bg-primary/10">
              <Sparkles className="w-3 h-3 mr-1" />
              New Features
            </Badge>
          </div>

          {/* Invite Button */}
          <Button 
            size="lg" 
            className="gap-2"
            onClick={() => window.open(inviteUrl, '_blank')}
          >
            <Bot className="w-5 h-5" />
            Invite Bot to Server
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>

        <TabHelpSection {...discordBotHelp} />

        {/* Features Grid */}
        <div>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {features.map((feature, index) => (
              <Card key={index} className="p-4 cyber-border bg-card/50 backdrop-blur-xl hover:bg-card/70 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/20 text-primary shrink-0">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1 flex items-center gap-2">
                      {feature.title}
                      {feature.isNew && (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-primary">NEW</Badge>
                      )}
                    </h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <Card className="p-6 cyber-border bg-card/50 backdrop-blur-xl">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Command className="w-6 h-6 text-primary" />
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-primary">1</span>
              </div>
              <h3 className="font-semibold mb-2">Invite the Bot</h3>
              <p className="text-sm text-muted-foreground">
                Click the invite button above to add the bot to your Discord server
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-primary">2</span>
              </div>
              <h3 className="font-semibold mb-2">Link Your Account</h3>
              <p className="text-sm text-muted-foreground">
                Use /register or /login to connect your Discord to your ULT LUA account
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-primary">3</span>
              </div>
              <h3 className="font-semibold mb-2">Start Using Commands</h3>
              <p className="text-sm text-muted-foreground">
                Create key systems, manage pastes, and set up control panels
              </p>
            </div>
          </div>
        </Card>

        {/* Control Panel Flow */}
        <Card className="p-6 cyber-border bg-card/50 backdrop-blur-xl">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Control Panel System
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold">1. Create a Panel</h3>
                <p className="text-sm text-muted-foreground">
                  Use <code className="px-1 py-0.5 bg-muted rounded">/panel</code> to create an interactive control panel with buttons
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold">2. Generate Keys with Expiration</h3>
                <p className="text-sm text-muted-foreground">
                  Use <code className="px-1 py-0.5 bg-muted rounded">/genkeys panel:MyPanel amount:10 hours:24</code> to generate keys that expire in 24 hours
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold">3. Buyers Redeem Keys</h3>
                <p className="text-sm text-muted-foreground">
                  Buyers click "Redeem Key", enter their key and Roblox User ID. They get auto-whitelisted for the paste!
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold">4. Automatic Expiration</h3>
                <p className="text-sm text-muted-foreground">
                  When keys expire, users lose access to Get Script & Get Role buttons, and their role is removed. Whitelist entries are also removed.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Commands List by Category */}
        <Card className="p-6 cyber-border bg-card/50 backdrop-blur-xl">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Command className="w-6 h-6 text-primary" />
            All Commands
          </h2>
          <div className="space-y-6">
            {categories.map((category) => (
              <div key={category}>
                <h3 className="text-lg font-semibold mb-3 text-primary">{category}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {commands
                    .filter(cmd => cmd.category === category)
                    .map((cmd, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                        <code className="px-2 py-1 bg-primary/20 text-primary rounded font-mono text-sm shrink-0">
                          {cmd.name}
                        </code>
                        <span className="text-sm text-muted-foreground flex-1">{cmd.description}</span>
                        {cmd.isNew && (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-primary shrink-0">NEW</Badge>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Bottom CTA */}
        <div className="text-center py-8">
          <Button 
            size="lg" 
            className="gap-2"
            onClick={() => window.open(inviteUrl, '_blank')}
          >
            <Bot className="w-5 h-5" />
            Add Bot to Your Server
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DiscordBot;
