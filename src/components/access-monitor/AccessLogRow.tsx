import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Globe, Trash2, User } from "lucide-react";
import type { AccessLog } from "./types";
import { formatTime, isActiveNow, isBrowserRequest } from "./utils";

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
