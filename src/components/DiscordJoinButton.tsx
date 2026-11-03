import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2 } from 'lucide-react';

export default function DiscordJoinButton({ guildId, name, inviteUrl }: { guildId: string; name: string; inviteUrl: string | null }) {
  const [url, setUrl] = useState(inviteUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const resolve = async () => {
    setLoading(true);
    setError('');
    // Open synchronously so mobile browsers do not block the eventual Discord tab.
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discord-bot-guilds?guild_id=${encodeURIComponent(guildId)}`);
      const data = await response.json();
      if (!response.ok || !data?.invite_url) throw new Error(data?.error || data?.invite_status || 'Invite unavailable');
      const destination = new URL(data.invite_url);
      if (destination.protocol !== 'https:' || destination.hostname !== 'discord.gg') throw new Error('Invalid Discord invite');
      setUrl(destination.href);
      if (tab) tab.location.href = destination.href;
    } catch (e) {
      tab?.close();
      setError(e instanceof Error ? e.message : 'Invite unavailable');
    } finally { setLoading(false); }
  };
  return <div className="w-full mt-auto">
    {url ? <Button asChild variant="outline" size="sm" className="w-full text-xs">
      <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Join ${name}`}><ExternalLink /><span>Join server</span></a>
    </Button> : <Button onClick={resolve} disabled={loading} variant="outline" size="sm" className="w-full text-xs" aria-label={`Join ${name}`}>
      {loading ? <Loader2 className="animate-spin" /> : <ExternalLink />}<span>{loading ? 'Getting invite' : 'Join server'}</span>
    </Button>}
    {error && <p role="alert" className="text-xs text-destructive mt-2">{error}</p>}
  </div>;
}