import { getDiscordGuilds } from './invites.ts';

async function scenario(status: number, privateChannel = false) {
  const original = globalThis.fetch;
  let inviteCalls = 0;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/users/@me/guilds')) return Response.json([{ id: '100', name: 'Exact server', icon: null }]);
    if (url.endsWith('/roles')) return Response.json([{ id: '100', permissions: '1024' }]);
    if (url.endsWith('/channels')) return Response.json([{ id: '200', type: 0, permission_overwrites: privateChannel ? [{ id: '100', type: 0, deny: '1024' }] : [] }]);
    if (url.endsWith('/invites')) {
      inviteCalls++;
      const body = JSON.parse(String(init?.body));
      if (body.unique !== false || body.max_age !== 0) throw new Error('Invites must be reusable');
      return Response.json({ code: 'real-invite', guild: { id: '100' } }, { status });
    }
    return Response.json({ approximate_member_count: 42 });
  }) as typeof fetch;
  try { return { guilds: await getDiscordGuilds('test-token'), inviteCalls }; }
  finally { globalThis.fetch = original; }
}

Deno.test('joins the exact bot server using the returned invite code, never the guild ID', async () => {
  const { guilds } = await scenario(200);
  if (guilds[0]?.invite_url !== 'https://discord.gg/real-invite' || guilds[0]?.id !== '100') throw new Error('Wrong invite destination');
});
Deno.test('missing invite permission never fabricates a join link', async () => {
  const { guilds } = await scenario(403);
  if (guilds[0]?.invite_url !== null) throw new Error('Must not invent invites');
});
Deno.test('never creates public invites into private channels', async () => {
  const { guilds, inviteCalls } = await scenario(200, true);
  if (guilds[0]?.invite_url !== null || inviteCalls !== 0) throw new Error('Private channel exposed');
});