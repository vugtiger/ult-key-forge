export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  member_count: number | null;
  invite_url: string | null;
  invite_status: string;
}

export class DiscordError extends Error {
  constructor(public status: number) {
    super(status === 401 ? 'Discord rejected the bot token.' : status === 429 ? 'Discord is rate limiting requests. Please try again later.' : `Discord request failed (${status}).`);
  }
}

export async function getDiscordGuilds(token: string, resolveInvites = true, targetGuild?: string): Promise<DiscordGuild[]> {
  const request = (path: string, init: RequestInit = {}) => fetch(`https://discord.com/api/v10/${path}`, {
    ...init, headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
  });
  const guilds: { id: string; name: string; icon: string | null }[] = [];
  let after = '';
  for (;;) {
    const response = await request(`users/@me/guilds?limit=200${after ? `&after=${after}` : ''}`);
    if (!response.ok) throw new DiscordError(response.status);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error('Discord returned an invalid server list.');
    guilds.push(...page);
    if (page.length < 200) break;
    after = page[page.length - 1]?.id;
    if (!after) break;
  }

  const result: DiscordGuild[] = [];
  let rateLimited = false;
  for (const guild of guilds) {
    const item: DiscordGuild = {
      id: guild.id, name: guild.name,
      icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${guild.icon.startsWith('a_') ? 'gif' : 'png'}?size=128` : null,
      member_count: null, invite_url: null, invite_status: resolveInvites ? 'Invite unavailable' : 'Available on request',
    };
    result.push(item);
    if (!resolveInvites || (targetGuild && targetGuild !== guild.id)) continue;
    if (rateLimited) { item.invite_status = 'Discord rate limited'; continue; }
    const [details, channels, roles] = await Promise.all([
      request(`guilds/${guild.id}?with_counts=true`), request(`guilds/${guild.id}/channels`), request(`guilds/${guild.id}/roles`),
    ]);
    if ([details, channels, roles].some(r => r.status === 401)) throw new DiscordError(401);
    if ([details, channels, roles].some(r => r.status === 429)) { rateLimited = true; item.invite_status = 'Discord rate limited'; continue; }
    if (details.ok) {
      const data = await details.json();
      item.member_count = data.approximate_member_count ?? null;
      if (data.vanity_url_code) {
        item.invite_url = `https://discord.gg/${encodeURIComponent(data.vanity_url_code)}`;
        item.invite_status = 'Ready';
        continue;
      }
    }
    if (!channels.ok || !roles.ok) { item.invite_status = 'Bot needs access to server channels'; continue; }
    const channelList = await channels.json();
    const roleList = await roles.json();
    if (!Array.isArray(channelList) || !Array.isArray(roleList)) continue;
    const everyone = roleList.find(r => r.id === guild.id);
    let base: bigint;
    try { base = BigInt(everyone?.permissions ?? '0'); } catch { continue; }
    // Never publish an invite into a channel hidden from @everyone.
    const publicChannels = channelList.filter(c => {
      if (c.type !== 0 && c.type !== 5) return false;
      const overwrite = c.permission_overwrites?.find((o: { id: string; type: number }) => o.id === guild.id && o.type === 0);
      try {
        const permissions = (base & ~BigInt(overwrite?.deny ?? '0')) | BigInt(overwrite?.allow ?? '0');
        return (permissions & 1024n) !== 0n;
      } catch { return false; }
    }).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    for (const channel of publicChannels) {
      const invite = await request(`channels/${channel.id}/invites`, {
        method: 'POST', body: JSON.stringify({ max_age: 0, max_uses: 0, temporary: false, unique: false }),
      });
      if (invite.status === 401) throw new DiscordError(401);
      if (invite.status === 429) { rateLimited = true; item.invite_status = 'Discord rate limited'; break; }
      if (invite.status === 403 || invite.status === 404) { item.invite_status = 'Bot needs Create Invite permission'; continue; }
      if (!invite.ok) break;
      const data = await invite.json();
      if (typeof data.code === 'string' && data.code && (!data.guild?.id || data.guild.id === guild.id)) {
        item.invite_url = `https://discord.gg/${encodeURIComponent(data.code)}`;
        item.invite_status = 'Ready';
        break;
      }
    }
    if (!publicChannels.length) item.invite_status = 'No public invite channel';
  }
  return result;
}