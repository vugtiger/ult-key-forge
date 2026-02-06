import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const logId = url.searchParams.get('id') ?? url.searchParams.get('log_id');
    const slug = url.searchParams.get('slug');

    if (!logId || !uuidRe.test(logId) || !slug) {
      return new Response('Bad Request', {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('cf-connecting-ip') ||
      'unknown';

    const userAgent = req.headers.get('user-agent') || null;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: paste } = await supabase
      .from('pastes')
      .select('id, ip_tracking_enabled')
      .eq('slug', slug)
      .maybeSingle();

    // Tracking disabled or paste missing: do nothing.
    if (!paste || paste.ip_tracking_enabled === false) {
      return new Response('', { status: 204, headers: corsHeaders });
    }

    await supabase
      .from('paste_access_logs')
      .update({
        last_seen_at: new Date().toISOString(),
        is_active: true,
        user_agent: userAgent,
      })
      .eq('id', logId)
      .eq('paste_id', paste.id)
      .eq('ip_address', clientIp)
      .eq('access_type', 'browser');

    return new Response('', { status: 204, headers: corsHeaders });
  } catch (error) {
    console.error('paste-heartbeat error:', error);
    return new Response('Internal error', { status: 500, headers: corsHeaders });
  }
});
