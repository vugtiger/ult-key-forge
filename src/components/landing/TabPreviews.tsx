import { Card } from "@/components/ui/card";
import {
  Database, Bot, MessageSquare, BarChart2, Settings, Download,
  Key, Shield, Code, Terminal, Zap, Users, Eye, Clock
} from "lucide-react";

const tabs = [
  {
    title: "Script Storage",
    description: "Save and manage your Roblox scripts in one secure cloud location.",
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
    description: "Host protected scripts with whitelist, IP tracking, game restriction, and hide code.",
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
    description: "Key redemption, role assignment, and script delivery managed from Discord.",
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
    description: "Track executions, user activity, and access patterns with detailed logs.",
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
    description: "Get your loader script with one click. Copy and paste into any executor.",
    icon: Download,
    features: ["One-click copy", "Auto-updating", "Executor compatible"],
    code: 'loadstring(game:HttpGet("https://..."))();',
  },
  {
    title: "Settings",
    description: "Customize your theme, manage your account, link Discord, and configure preferences.",
    icon: Settings,
    features: ["Theme colors", "2FA security", "Discord link", "Language"],
    mockSettings: [
      { label: "Primary Color", value: "#ffffff" },
      { label: "2FA", value: "Enabled" },
      { label: "Discord", value: "Linked" },
    ],
  },
];

const TabPreviews = () => (
  <section className="max-w-6xl mx-auto mb-28">
    <div className="text-center mb-14">
      <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-3">Platform Overview</p>
      <h2 className="text-3xl md:text-4xl font-bold mb-3">Everything Inside</h2>
      <p className="text-muted-foreground max-w-2xl mx-auto text-sm">
        Every tool available when you sign in
      </p>
    </div>

    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {tabs.map((tab, i) => (
        <div
          key={i}
          className="glass-card p-5 rounded-2xl transition-all duration-300 group hover:-translate-y-0.5"
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-foreground/5 border border-border flex items-center justify-center">
                <tab.icon className="w-5 h-5 text-foreground" />
              </div>
              <h3 className="text-base font-semibold">{tab.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{tab.description}</p>

            <div className="bg-background/40 border border-border rounded-lg p-3 space-y-1.5">
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
                <code className="text-[10px] text-foreground/80 font-mono break-all">{tab.code}</code>
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
                <span key={j} className="text-[10px] px-2 py-0.5 bg-foreground/5 text-foreground/70 rounded-full border border-border">
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  </section>
);

export default TabPreviews;
