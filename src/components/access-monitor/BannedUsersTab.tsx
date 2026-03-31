import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { ExternalLink, Calendar, Shield, User, Globe, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";

interface BannedUser {
  roblox_user_id: string | null;
  roblox_username: string | null;
  roblox_display_name: string | null;
  roblox_avatar_url: string | null;
  roblox_created_at: string | null;
  roblox_is_banned: boolean | null;
  discord_user_id: string | null;
  discord_username: string | null;
  discord_avatar: string | null;
  discord_created_at: string | null;
  ip_address: string | null;
  last_seen_at: string | null;
  ban_reason: string;
  banned_at: string | null;
}

interface BannedUsersTabProps {
  users: BannedUser[];
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

export default function BannedUsersTab({ users, loading }: BannedUsersTabProps) {
  const [search, setSearch] = useState("");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  const filtered = users.filter((user) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (user.roblox_user_id && user.roblox_user_id.includes(s)) ||
      (user.roblox_username && user.roblox_username.toLowerCase().includes(s)) ||
      (user.roblox_display_name && user.roblox_display_name.toLowerCase().includes(s)) ||
      (user.ban_reason && user.ban_reason.toLowerCase().includes(s))
    );
  });

  if (users.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Shield className="h-10 w-10 mb-3 opacity-50" />
          <p className="text-sm font-medium">No banned Roblox users</p>
          <p className="text-xs mt-1">Roblox users who try to bypass your scripts will appear here</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by Roblox ID, username, or reason..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-background/50"
        />
      </div>
      <Badge variant="outline" className="text-xs">{filtered.length} banned Roblox users</Badge>
      <ScrollArea className="h-[500px]">
        <div className="space-y-3">
          {filtered.map((user, i) => (
            <Card key={`${user.roblox_user_id || i}`} className="border-destructive/40 bg-destructive/5 shadow-md shadow-destructive/10">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12 border-2 border-destructive/50">
                    {user.roblox_avatar_url ? (
                      <AvatarImage src={user.roblox_avatar_url} />
                    ) : null}
                    <AvatarFallback className="bg-destructive/20 text-destructive">
                      <User className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">
                        {user.roblox_display_name || user.roblox_username || `Roblox ID: ${user.roblox_user_id || 'Unknown'}`}
                      </span>
                      {user.roblox_username && user.roblox_display_name && (
                        <span className="text-xs text-muted-foreground">@{user.roblox_username}</span>
                      )}
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">BANNED</Badge>
                      {user.roblox_is_banned && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-destructive/50 text-destructive">
                          ROBLOX BANNED
                        </Badge>
                      )}
                    </div>

                    {user.roblox_user_id && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>Roblox ID: {user.roblox_user_id}</span>
                        {user.roblox_created_at && (
                          <>
                            <span className="mx-1">•</span>
                            <Calendar className="h-3 w-3" />
                            <span>Created: {formatDate(user.roblox_created_at)}</span>
                          </>
                        )}
                      </div>
                    )}

                    {user.discord_user_id && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="flex items-center gap-2 hover:bg-background/50 rounded px-1 -mx-1 transition-colors">
                            <Avatar className="h-5 w-5 border border-[#5865F2]">
                              <AvatarImage src={getDiscordAvatarUrl(user.discord_user_id, user.discord_avatar) || undefined} />
                              <AvatarFallback className="bg-[#5865F2] text-white text-[10px]">D</AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-[#5865F2]">
                              {user.discord_username || user.discord_user_id}
                            </span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-0" align="start">
                          <div className="p-4 space-y-3 bg-gradient-to-b from-[#5865F2]/20 to-transparent">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-12 w-12 border-2 border-[#5865F2]">
                                <AvatarImage src={getDiscordAvatarUrl(user.discord_user_id, user.discord_avatar) || undefined} />
                                <AvatarFallback className="bg-[#5865F2] text-white">D</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold truncate">{user.discord_username || "Unknown"}</h4>
                                <p className="text-xs text-muted-foreground">ID: {user.discord_user_id}</p>
                              </div>
                            </div>
                            {user.discord_created_at && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                <span>Account created: {formatDate(user.discord_created_at)}</span>
                              </div>
                            )}
                            <Button variant="outline" size="sm" className="w-full border-[#5865F2]/50 hover:bg-[#5865F2]/10" asChild>
                              <a href={`https://discord.com/users/${user.discord_user_id}`} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                View on Discord
                              </a>
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}

                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {user.ip_address && (
                        <div className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          <span className="font-mono">{user.ip_address}</span>
                        </div>
                      )}
                      {user.banned_at && (
                        <div className="flex items-center gap-1">
                          <Shield className="h-3 w-3 text-destructive" />
                          <span>Banned: {formatDate(user.banned_at)}</span>
                        </div>
                      )}
                      <span className="text-destructive/70">{user.ban_reason}</span>
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
