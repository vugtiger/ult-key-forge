import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RefreshCw, ExternalLink, Users, Server } from "lucide-react";

interface Guild {
  id: string;
  name: string;
  icon: string | null;
  member_count: number | null;
}

const DiscordServersTab = () => {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGuilds = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('discord-bot-guilds');
      if (error) throw error;
      setGuilds(data || []);
    } catch (e: any) {
      console.error('Failed to fetch guilds:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGuilds(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/10 bg-muted/5 rounded-t-xl">
        <div className="flex items-center gap-3">
          <Server className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-semibold tracking-wide">Discord Servers</h2>
            <p className="text-[11px] text-muted-foreground">{guilds.length} servers with ULT Bot</p>
          </div>
        </div>
        <Button onClick={fetchGuilds} variant="ghost" size="sm" className="text-xs text-muted-foreground">
          <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : guilds.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <div className="w-16 h-16 rounded-2xl bg-muted/10 flex items-center justify-center mb-4">
            <Server className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <p className="text-sm font-medium text-muted-foreground/60">No servers found</p>
          <p className="text-xs text-muted-foreground/40 mt-1">The bot isn't in any servers yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-6 pb-6">
          {guilds.map((guild, i) => (
            <div
              key={guild.id}
              className="group relative overflow-hidden rounded-xl border border-border/15 bg-card/30 backdrop-blur-sm p-4 transition-all duration-500 hover:border-primary/30 hover:bg-card/50 hover:shadow-lg hover:shadow-primary/5"
              style={{ 
                animationDelay: `${i * 80}ms`,
                animation: 'fade-in 0.5s ease-out forwards',
                opacity: 0,
              }}
            >
              {/* Futuristic glow line */}
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="flex items-center gap-3">
                {guild.icon ? (
                  <img 
                    src={guild.icon} 
                    alt={guild.name} 
                    className="w-12 h-12 rounded-xl object-cover border border-border/20 group-hover:border-primary/30 transition-all duration-300"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-muted/20 flex items-center justify-center border border-border/20 text-lg font-bold text-muted-foreground/40">
                    {guild.name.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors duration-300">{guild.name}</p>
                  {guild.member_count && (
                    <p className="text-[11px] text-muted-foreground/50 flex items-center gap-1 mt-0.5">
                      <Users className="h-3 w-3" />
                      {guild.member_count.toLocaleString()} members
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground/30 font-mono mt-0.5">{guild.id}</p>
                </div>
              </div>
              
              <div className="mt-3 flex gap-2">
                <a 
                  href={`https://discord.gg/${guild.id}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button variant="ghost" size="sm" className="w-full text-xs h-8 border border-border/20 hover:border-primary/30 hover:bg-primary/5 hover:text-primary gap-1.5 transition-all duration-300">
                    <ExternalLink className="h-3 w-3" />
                    Open in Discord
                  </Button>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DiscordServersTab;
