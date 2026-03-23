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
    { icon: <Key className="w-4 h-4" />, title: "Key System Generation", description: "Generate custom key systems with unlimited keys directly from Discord" },
    { icon: <FileText className="w-4 h-4" />, title: "Paste Management", description: "Create, manage, and protect your pastes with script protection" },
    { icon: <Users className="w-4 h-4" />, title: "Whitelist/Blacklist Control", description: "Manage user access with Roblox user ID whitelisting and blacklisting" },
    { icon: <Shield className="w-4 h-4" />, title: "Control Panels", description: "Create interactive buyer panels with key redemption and role assignment" },
    { icon: <Clock className="w-4 h-4" />, title: "Expiration Management", description: "Set custom expiration times for keys (minutes, hours, days)" },
    { icon: <Ban className="w-4 h-4" />, title: "Console Blacklist", description: "Block specific Discord users from using your control panels" },
    { icon: <RefreshCw className="w-4 h-4" />, title: "Force Expire", description: "Manually expire user access and remove them from whitelists" },
    { icon: <Globe className="w-4 h-4" />, title: "Public Protection", description: "Free-for-all execution without whitelist, blacklist still works" },
    { icon: <EyeOff className="w-4 h-4" />, title: "Hide Code", description: "Hide code from raw URL - shows blank but loadstring works", isNew: true },
    { icon: <Zap className="w-4 h-4" />, title: "AI Assistant", description: "Chat with an AI assistant for Roblox scripting help" },
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
    { name: "/help", description: "Show all commands", category: "Other" },
  ];

  const categories = Array.from(new Set(commands.map(c => c.category)));

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/12 mb-4">
            <Bot className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Discord Bot</h1>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto mb-4">
            Manage your key systems, pastes, and control panels directly from Discord
          </p>
          <div className="flex items-center justify-center gap-2 mb-4">
            <Badge variant="outline" className="px-3 py-1 text-xs border-primary/20 bg-primary/8">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mr-1.5 animate-pulse"></span>
              Bot Online
            </Badge>
            <Badge variant="outline" className="px-3 py-1 text-xs border-primary/20 bg-primary/8">
              <Sparkles className="w-3 h-3 mr-1" /> New Features
            </Badge>
          </div>
          <Button size="sm" className="gap-1.5 rounded-lg h-9 text-xs" onClick={() => window.open(inviteUrl, '_blank')}>
            <Bot className="w-4 h-4" /> Invite Bot to Server <ExternalLink className="w-3 h-3" />
          </Button>
        </div>

        <TabHelpSection {...discordBotHelp} />

        {/* Features Grid */}
        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" /> Features
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {features.map((feature, i) => (
              <div key={i} className="rounded-xl border border-primary/10 bg-card/20 p-3.5 backdrop-blur-xl hover:border-primary/20 transition-colors">
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-primary/12 text-primary shrink-0">{feature.icon}</div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-semibold flex items-center gap-1">
                      <span className="truncate">{feature.title}</span>
                      {feature.isNew && <Badge variant="default" className="text-[8px] px-1 py-0 h-3.5 bg-primary">NEW</Badge>}
                    </h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className="rounded-xl border border-primary/10 bg-card/20 p-5 backdrop-blur-xl">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Command className="w-4 h-4 text-primary" /> How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { step: "1", title: "Invite the Bot", desc: "Click the invite button above to add the bot to your Discord server" },
              { step: "2", title: "Link Your Account", desc: "Use /register or /login to connect your Discord to your ULT LUA account" },
              { step: "3", title: "Start Using Commands", desc: "Create key systems, manage pastes, and set up control panels" },
            ].map(item => (
              <div key={item.step} className="text-center">
                <div className="w-9 h-9 rounded-full bg-primary/12 flex items-center justify-center mx-auto mb-2">
                  <span className="text-sm font-bold text-primary">{item.step}</span>
                </div>
                <h3 className="text-xs font-semibold mb-1">{item.title}</h3>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Control Panel Flow */}
        <div className="rounded-xl border border-primary/10 bg-card/20 p-5 backdrop-blur-xl">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Control Panel System
          </h2>
          <div className="space-y-3">
            {[
              { title: "Create a Panel", desc: <>Use <code className="px-1 py-0.5 bg-muted/30 rounded text-[10px]">/panel</code> to create an interactive control panel with buttons</> },
              { title: "Generate Keys with Expiration", desc: <>Use <code className="px-1 py-0.5 bg-muted/30 rounded text-[10px]">/genkeys panel:MyPanel amount:10 hours:24</code> to generate keys that expire in 24 hours</> },
              { title: "Buyers Redeem Keys", desc: "Buyers click 'Redeem Key', enter their key and Roblox User ID. They get auto-whitelisted!" },
              { title: "Automatic Expiration", desc: "When keys expire, users lose access to Get Script & Get Role buttons, and their role is removed." },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-primary" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold">{i + 1}. {item.title}</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Commands */}
        <div className="rounded-xl border border-primary/10 bg-card/20 p-5 backdrop-blur-xl">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Command className="w-4 h-4 text-primary" /> All Commands
          </h2>
          <div className="space-y-5">
            {categories.map((category) => (
              <div key={category}>
                <h3 className="text-xs font-semibold mb-2 text-primary">{category}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  {commands.filter(cmd => cmd.category === category).map((cmd, i) => (
                    <div key={i} className="flex items-center gap-2 p-1.5 rounded-lg bg-background/20 hover:bg-background/30 transition-colors">
                      <code className="px-1.5 py-0.5 bg-primary/12 text-primary rounded text-[10px] font-mono shrink-0">{cmd.name}</code>
                      <span className="text-[10px] text-muted-foreground flex-1 truncate">{cmd.description}</span>
                      {cmd.isNew && <Badge variant="default" className="text-[8px] px-1 py-0 h-3.5 bg-primary shrink-0">NEW</Badge>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center py-4">
          <Button size="sm" className="gap-1.5 rounded-lg h-9 text-xs" onClick={() => window.open(inviteUrl, '_blank')}>
            <Bot className="w-4 h-4" /> Add Bot to Your Server <ExternalLink className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DiscordBot;
