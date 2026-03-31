import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { ExternalLink, Calendar, Shield, Globe, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface BannedIP {
  ip_address: string;
  roblox_user_id: string | null;
  roblox_username: string | null;
  roblox_avatar_url: string | null;
  discord_user_id: string | null;
  discord_username: string | null;
  discord_avatar: string | null;
  discord_created_at: string | null;
  last_seen_at: string | null;
  ban_reason: string;
  banned_at: string | null;
  access_type: string | null;
}

interface BannedIPsTabProps {
  ips: BannedIP[];
  loading: boolean;
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "Unknown";
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
};

const getDiscordAvatarUrl = (userId: string | null, avatar: string | null) => {
  if (!userId || !avatar) return null;
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=128`;
};

export default function BannedIPsTab({ ips, loading }: BannedIPsTabProps) {
  const [search, setSearch] = useState("");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  const filtered = ips.filter((entry) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      entry.ip_address.includes(s) ||
      (entry.roblox_username && entry.roblox_username.toLowerCase().includes(s)) ||
      (entry.roblox_user_id && entry.roblox_user_id.includes(s)) ||
      (entry.discord_username && entry.discord_username.toLowerCase().includes(s)) ||
      (entry.ban_reason && entry.ban_reason.toLowerCase().includes(s))
    );
  });

  if (ips.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Globe className="h-10 w-10 mb-3 opacity-50" />
          <p className="text-sm font-medium">No banned IPs detected</p>
          <p className="text-xs mt-1">IPs that try to bypass your scripts will appear here</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by IP, username, or reason..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-background/50"
        />
      </div>
      <Badge variant="outline" className="text-xs">{filtered.length} banned IPs</Badge>
      <ScrollArea className="h-[500px]">
        <div className="space-y-3">
          {filtered.map((entry) => (
            <Card key={entry.ip_address} className="border-destructive/40 bg-destructive/5 shadow-md shadow-destructive/10">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="relative">
                        <div className="h-3 w-3 rounded-full bg-destructive" />
                        <div className="absolute inset-0 h-3 w-3 rounded-full bg-destructive animate-ping" />
                      </div>
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm font-semibold">{entry.ip_address}</span>
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">BANNED</Badge>
                    </div>

                    {entry.roblox_user_id && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {entry.roblox_avatar_url && (
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={entry.roblox_avatar_url} />
                          </Avatar>
                        )}
                        <span>Roblox: {entry.roblox_username || entry.roblox_user_id}</span>
                      </div>
                    )}

                    {entry.discord_user_id && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="flex items-center gap-2 hover:bg-background/50 rounded px-1 -mx-1 transition-colors">
                            <Avatar className="h-5 w-5 border border-[#5865F2]">
                              <AvatarImage src={getDiscordAvatarUrl(entry.discord_user_id, entry.discord_avatar) || undefined} />
                              <AvatarFallback className="bg-[#5865F2] text-white text-[10px]">D</AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-[#5865F2]">
                              {entry.discord_username || entry.discord_user_id}
                            </span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-0" align="start">
                          <div className="p-4 space-y-3 bg-gradient-to-b from-[#5865F2]/20 to-transparent">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-12 w-12 border-2 border-[#5865F2]">
                                <AvatarImage src={getDiscordAvatarUrl(entry.discord_user_id, entry.discord_avatar) || undefined} />
                                <AvatarFallback className="bg-[#5865F2] text-white">D</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold truncate">{entry.discord_username || "Unknown"}</h4>
                                <p className="text-xs text-muted-foreground">ID: {entry.discord_user_id}</p>
                              </div>
                            </div>
                            {entry.discord_created_at && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                <span>Account created: {formatDate(entry.discord_created_at)}</span>
                              </div>
                            )}
                            <Button variant="outline" size="sm" className="w-full border-[#5865F2]/50 hover:bg-[#5865F2]/10" asChild>
                              <a href={`https://discord.com/users/${entry.discord_user_id}`} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                View on Discord
                              </a>
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}

                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {entry.banned_at && (
                        <div className="flex items-center gap-1">
                          <Shield className="h-3 w-3 text-destructive" />
                          <span>Banned: {formatDate(entry.banned_at)}</span>
                        </div>
                      )}
                      {entry.last_seen_at && (
                        <span>Last seen: {formatDate(entry.last_seen_at)}</span>
                      )}
                      <span className="text-destructive/70">{entry.ban_reason}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
