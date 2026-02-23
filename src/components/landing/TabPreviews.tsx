import { Card } from "@/components/ui/card";
import {
  Database, Bot, MessageSquare, BarChart2, Settings, Download,
  Key, Shield, Code, Terminal, Zap, Users, Eye, Clock
} from "lucide-react";

const tabs = [
  {
    title: "Script Storage",
    description: "Save and manage your Roblox scripts in one secure cloud location. Edit, organize, and access them anywhere.",
    icon: Database,
    features: ["Cloud-synced scripts", "Edit & organize", "Instant access"],
    mockLines: [
      { name: "Anti-Cheat v3.lua", size: "4.2 KB", date: "2d ago" },
      { name: "Hub Loader.lua", size: "1.8 KB", date: "5h ago" },
      { name: "Admin Commands.lua", size: "6.1 KB", date: "1w ago" },
    ],
  },
  {
    title: "Pastebin / Protection",
    description: "Host protected scripts with whitelist, public protection, IP tracking, game restriction, and hide code features.",
    icon: Shield,
    features: ["Whitelist protection", "IP tracking", "Hide code", "Game lock"],
    mockLines: [
      { name: "my-hub", prot: "Whitelist", users: 24 },
      { name: "free-script", prot: "Public", users: 312 },
      { name: "private-loader", prot: "Hidden", users: 8 },
    ],
  },
  {
    title: "Discord Bot",
    description: "Create control panels with key redemption, role assignment, and script delivery — all managed from Discord.",
    icon: Bot,
    features: ["Key redemption", "Role assignment", "Console blacklist"],
    mockLines: [
      { cmd: "/redeem", desc: "Redeem a key" },
      { cmd: "/panel", desc: "View control panel" },
      { cmd: "/blacklist", desc: "Block a user" },
    ],
  },
  {
    title: "Analytics",
    description: "Track script executions, user activity, key usage, and access patterns with detailed charts and logs.",
    icon: BarChart2,
    features: ["Execution tracking", "User activity", "Access logs"],
    stats: [
      { label: "Executions", value: "2,847" },
      { label: "Unique Users", value: "412" },
      { label: "Peak Hour", value: "8 PM" },
    ],
  },
  {
    title: "Install / Loader",
    description: "Get your loader script with one click. Copy the loadstring URL and paste it into any executor.",
    icon: Download,
    features: ["One-click copy", "Auto-updating", "Executor compatible"],
    code: 'loadstring(game:HttpGet("https://..."))();',
  },
  {
    title: "Settings",
    description: "Customize your theme colors, manage your account, link Discord, enable 2FA, and configure preferences.",
    icon: Settings,
    features: ["Theme colors", "2FA security", "Discord link", "Language"],
    mockSettings: [
      { label: "Primary Color", value: "#00ff88" },
      { label: "2FA", value: "Enabled" },
      { label: "Discord", value: "Linked" },
    ],
  },
];

const TabPreviews = () => (
  <section className="max-w-6xl mx-auto mb-28">
    <div className="text-center mb-14">
      <div className="inline-flex items-center gap-2 px-3 py-1 bg-card/60 border border-border/30 rounded-full text-xs text-muted-foreground uppercase tracking-widest mb-4">
        <Eye size={12} />
        Platform Overview
      </div>
      <h2 className="text-3xl md:text-4xl font-bold mb-3">Everything Inside</h2>
      <p className="text-muted-foreground max-w-2xl mx-auto">
        A look at every tool available when you sign in
      </p>
    </div>

    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {tabs.map((tab, i) => (
        <Card
          key={i}
          className="p-5 bg-card/40 backdrop-blur-xl border-border/30 hover:border-border/60 transition-all duration-300 group relative overflow-hidden rounded-2xl"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-card border border-border/50 flex items-center justify-center group-hover:border-primary/30 transition-colors">
                <tab.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-base font-semibold">{tab.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{tab.description}</p>

            {/* Mini mock preview */}
            <div className="bg-background/40 border border-border/20 rounded-lg p-3 space-y-1.5">
              {"mockLines" in tab && Array.isArray(tab.mockLines) && tab.mockLines.map((line: any, j: number) => (
                <div key={j} className="flex items-center justify-between text-[11px]">
                  <span className="text-foreground font-mono truncate">
                    {line.name || line.cmd}
                  </span>
                  <span className="text-muted-foreground text-[10px] shrink-0 ml-2">
                    {line.size || line.prot || line.desc}
                  </span>
                </div>
              ))}
              {"stats" in tab && tab.stats?.map((s: any, j: number) => (
                <div key={j} className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="text-foreground font-bold">{s.value}</span>
                </div>
              ))}
              {"code" in tab && (
                <code className="text-[10px] text-primary font-mono break-all">{tab.code}</code>
              )}
              {"mockSettings" in tab && tab.mockSettings?.map((s: any, j: number) => (
                <div key={j} className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="text-foreground">{s.value}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {tab.features.map((f, j) => (
                <span key={j} className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                  {f}
                </span>
              ))}
            </div>
          </div>
        </Card>
      ))}
    </div>
  </section>
);

export default TabPreviews;
