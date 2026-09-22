import { createClient } from "npm:@supabase/supabase-js@2";
import { browserRedirectIfHtml } from "../_shared/browserBlock.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  const _blocked = browserRedirectIfHtml(req);
  if (_blocked) return _blocked;
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: 'Unauthorized' }, 401);

    const service = createClient(supabaseUrl, serviceKey);

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const action = String(body.action || 'list');

    // All the pastes this user owns
    const { data: userPastes } = await service
      .from('pastes')
      .select('id, title, slug')
      .eq('user_id', user.id);
    const pasteIds = (userPastes || []).map((p: any) => p.id);
    if (pasteIds.length === 0) return json({ devices: [] });

    // Every HWID seen on this owner's pastes (their scope of authority)
    const { data: locks } = await service
      .from('paste_hwid_locks')
      .select('id, paste_id, roblox_user_id, hwid, created_at, updated_at')
      .in('paste_id', pasteIds)
      .order('created_at', { ascending: false });

    const ownedHwids = new Set((locks || []).map((l: any) => l.hwid));

    if (action === 'block' || action === 'unblock') {
      const hwid = String(body.hwid || '').trim();
      if (hwid.length < 4) return json({ error: 'Invalid HWID' }, 400);
      if (!ownedHwids.has(hwid)) {
        return json({ error: 'This device has never been seen on your scripts' }, 403);
      }

      if (action === 'block') {
        const { error } = await service.from('global_bans').upsert({
          ban_type: 'hwid',
          ban_value: hwid,
          reason: String(body.reason || '').slice(0, 300) || `Device blocked by owner`,
          is_active: true,
          banned_by: user.id,
        }, { onConflict: 'ban_type,ban_value' });
        if (error) return json({ error: error.message }, 400);

        // Ban every account that has ever used this device on the owner's pastes
        const alts = [...new Set((locks || []).filter((l: any) => l.hwid === hwid).map((l: any) => l.roblox_user_id))];
        for (const alt of alts) {
          await service.from('global_bans').upsert({
            ban_type: 'roblox_id',
            ban_value: alt,
            reason: `Alt account on blocked device (${hwid.substring(0, 16)})`,
            is_active: true,
            banned_by: user.id,
          }, { onConflict: 'ban_type,ban_value' });
        }
        return json({ success: true, blocked: hwid, alts_banned: alts.length });
      }

      const { error } = await service
        .from('global_bans')
        .update({ is_active: false })
        .eq('ban_type', 'hwid')
        .eq('ban_value', hwid);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true, unblocked: hwid });
    }

    // list
    const { data: bans } = ownedHwids.size
      ? await service
          .from('global_bans')
          .select('ban_value, reason, banned_at')
          .eq('ban_type', 'hwid')
          .eq('is_active', true)
          .in('ban_value', [...ownedHwids])
      : { data: [] as any[] };

    const bannedMap = new Map((bans || []).map((b: any) => [b.ban_value, b]));
    const pasteMap = new Map((userPastes || []).map((p: any) => [p.id, p]));

    const devices = (locks || []).map((l: any) => ({
      ...l,
      paste_title: pasteMap.get(l.paste_id)?.title || pasteMap.get(l.paste_id)?.slug || null,
      is_blocked: bannedMap.has(l.hwid),
      ban_reason: bannedMap.get(l.hwid)?.reason || null,
      banned_at: bannedMap.get(l.hwid)?.banned_at || null,
    }));

    return json({ devices });
  } catch (e: any) {
    return json({ error: e?.message || 'Unexpected error' }, 500);
  }
});
