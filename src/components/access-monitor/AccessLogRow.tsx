import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Clock, Globe, Trash2, User, MessageCircle, Calendar, ExternalLink } from "lucide-react";
import type { AccessLog } from "./types";
import { formatTime, isActiveNow, isBrowserRequest, formatDiscordDate } from "./utils";

type Props = {
  log: AccessLog;
  onDelete: (log: AccessLog) => void;
  deleting?: boolean;
};

export default function AccessLogRow({ log, onDelete, deleting }: Props) {
  const active = isActiveNow(log.last_seen_at);
  const fromBrowser = isBrowserRequest(log.user_agent);

  // If not active, always show as offline (muted). If active, color depends on request type.
  const dotClass = !active ? "bg-muted-foreground" : fromBrowser ? "bg-destructive" : "bg-primary";
  const pingClass = fromBrowser ? "bg-destructive" : "bg-primary";

  const cardClass = active
    ? fromBrowser
      ? "border-destructive/50 bg-destructive/10 shadow-lg shadow-destructive/20"
      : "border-primary/50 bg-primary/10 shadow-lg shadow-primary/20"
    : "border-border/30 bg-background/50";

  const discordAvatarUrl = log.discord_user_id && log.discord_avatar
    ? `https://cdn.discordapp.com/avatars/${log.discord_user_id}/${log.discord_avatar}.png?size=128`
    : null;

  return (
    <div key={log.id} className={`p-3 rounded-lg border transition-all ${cardClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className={`h-3 w-3 rounded-full ${dotClass}`} />
            {active && <div className={`absolute inset-0 h-3 w-3 rounded-full animate-ping ${pingClass}`} />}
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="font-mono text-sm font-medium truncate">{log.ip_address}</span>
              {fromBrowser && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">
                  BROWSER
                </Badge>
              )}
              {!active && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                  OFFLINE
                </Badge>
              )}
            </div>

            {log.roblox_user_id && (
              <div className="flex items-center gap-2">
                <User className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Roblox ID: {log.roblox_user_id}</span>
              </div>
            )}

            {/* Discord Info */}
            {log.discord_user_id && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <Avatar className="h-5 w-5">
                      {discordAvatarUrl && <AvatarImage src={discordAvatarUrl} alt={log.discord_username || "Discord"} />}
                      <AvatarFallback className="text-[8px] bg-[#5865F2]">
                        <MessageCircle className="h-3 w-3 text-white" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-[#5865F2] font-medium">
                      {log.discord_username || log.discord_user_id}
                    </span>
                    <Badge className="text-[8px] px-1 py-0 bg-[#5865F2]/20 text-[#5865F2] border-[#5865F2]/30">
                      DISCORD
                    </Badge>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="start">
                  <div className="bg-gradient-to-b from-[#5865F2] to-[#5865F2]/80 h-16 rounded-t-lg" />
                  <div className="px-4 pb-4">
                    <div className="flex items-end gap-3 -mt-8">
                      <Avatar className="h-16 w-16 border-4 border-background">
                        {discordAvatarUrl && <AvatarImage src={discordAvatarUrl} alt={log.discord_username || "Discord"} />}
                        <AvatarFallback className="bg-[#5865F2] text-white">
                          <MessageCircle className="h-6 w-6" />
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div>
                        <h4 className="font-bold text-foreground">{log.discord_username || "Unknown"}</h4>
                        <p className="text-xs text-muted-foreground font-mono">{log.discord_user_id}</p>
                      </div>
                      {log.discord_created_at && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>Created {formatDiscordDate(log.discord_created_at)}</span>
                        </div>
                      )}
                      <a
                        href={`https://discord.com/users/${log.discord_user_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-[#5865F2] hover:underline mt-2"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View Discord Profile
                      </a>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatTime(log.last_seen_at)}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(log)}
            disabled={deleting}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Delete access log"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
