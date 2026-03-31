import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { ExternalLink, Calendar, Shield, MessageCircle, Search } from "lucide-react";
import { useState } from "react";

interface BannedDiscord {
  discord_user_id: string;
  discord_username: string | null;
  discord_avatar: string | null;
  discord_created_at: string | null;
  ip_address: string | null;
  last_seen_at: string | null;
  ban_reason: string;
  banned_at: string | null;
  roblox_user_id: string | null;
  roblox_username: string | null;
}

interface BannedDiscordTabProps {
  users: BannedDiscord[];
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

export default function BannedDiscordTab({ users, loading }: BannedDiscordTabProps) {
  const [search, setSearch] = useState("");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  const filtered = users.filter((u) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (u.discord_user_id && u.discord_user_id.includes(s)) ||
      (u.discord_username && u.discord_username.toLowerCase().includes(s)) ||
      (u.ban_reason && u.ban_reason.toLowerCase().includes(s))
    );
  });

  if (users.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <MessageCircle className="h-10 w-10 mb-3 opacity-50" />
          <p className="text-sm font-medium">No banned Discord users</p>
          <p className="text-xs mt-1">Discord users who try to bypass your scripts will appear here</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by Discord ID, username, or reason..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-background/50"
        />
      </div>
      <Badge variant="outline" className="text-xs">{filtered.length} banned Discord users</Badge>
      <ScrollArea className="h-[500px]">
        <div className="space-y-3">
          {filtered.map((user, i) => (
            <Card key={`${user.discord_user_id}-${i}`} className="border-[#5865F2]/40 bg-[#5865F2]/5 shadow-md shadow-[#5865F2]/10">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12 border-2 border-[#5865F2]/50">
                    <AvatarImage src={getDiscordAvatarUrl(user.discord_user_id, user.discord_avatar) || undefined} />
                    <AvatarFallback className="bg-[#5865F2]/20 text-[#5865F2]">
                      <MessageCircle className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">
                        {user.discord_username || `Discord ID: ${user.discord_user_id}`}
                      </span>
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">BANNED</Badge>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MessageCircle className="h-3 w-3" />
                      <span>Discord ID: {user.discord_user_id}</span>
                      {user.discord_created_at && (
                        <>
                          <span className="mx-1">•</span>
                          <Calendar className="h-3 w-3" />
                          <span>Created: {formatDate(user.discord_created_at)}</span>
                        </>
                      )}
                    </div>

                    {user.roblox_user_id && (
                      <div className="text-xs text-muted-foreground">
                        Linked Roblox: {user.roblox_username || user.roblox_user_id}
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {user.banned_at && (
                        <div className="flex items-center gap-1">
                          <Shield className="h-3 w-3 text-destructive" />
                          <span>Banned: {formatDate(user.banned_at)}</span>
                        </div>
                      )}
                      {user.last_seen_at && <span>Last seen: {formatDate(user.last_seen_at)}</span>}
                      <span className="text-destructive/70">{user.ban_reason}</span>
                    </div>

                    <Button variant="outline" size="sm" className="border-[#5865F2]/50 hover:bg-[#5865F2]/10" asChild>
                      <a href={`https://discord.com/users/${user.discord_user_id}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View on Discord
                      </a>
                    </Button>
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
