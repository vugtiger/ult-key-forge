import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Bot, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Guild {
  id: string;
  name: string;
  icon: string | null;
  member_count: number | null;
}

const DiscordServerShowcase = () => {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGuilds = async () => {
    setLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${baseUrl}/functions/v1/discord-bot-guilds`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setGuilds(data);
    } catch (err) {
      console.error('Failed to fetch guilds:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuilds();
    // Refresh every 30 seconds for real-time feel
    const interval = setInterval(fetchGuilds, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="max-w-6xl mx-auto mb-24">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-card/60 border border-border/30 rounded-full text-xs text-muted-foreground uppercase tracking-widest mb-4">
          <Bot className="w-3 h-3" />
          Live Servers
        </div>
        <h2 className="text-3xl md:text-4xl font-bold mb-3">Discord Servers Using ULT</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Real-time list of Discord servers running the ULT bot — {guilds.length} servers and counting
        </p>
      </div>

      {loading && guilds.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : guilds.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No servers found</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {guilds.map((guild) => (
            <Card
              key={guild.id}
              className="p-4 bg-card/40 backdrop-blur-xl border-border/30 hover:border-border/60 transition-all duration-300 flex flex-col items-center gap-3 rounded-2xl group"
            >
              {guild.icon ? (
                <img
                  src={guild.icon}
                  alt={guild.name}
                  className="w-14 h-14 rounded-full bg-muted object-cover group-hover:scale-105 transition-transform"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-xl font-bold text-muted-foreground">
                  {guild.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="text-center min-w-0 w-full">
                <p className="text-sm font-medium truncate">{guild.name}</p>
                {guild.member_count && (
                  <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
                    <Users className="h-3 w-3" />
                    {guild.member_count.toLocaleString()}
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
};

export default DiscordServerShowcase;
