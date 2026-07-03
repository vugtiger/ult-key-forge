import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');
  if (!slug || !/^[A-Za-z0-9_-]{1,64}$/.test(slug)) {
    return new Response(JSON.stringify({ error: 'bad slug' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data, error } = await supabase
    .from('pastes')
    .select('slug, title, created_at, updated_at, protection_enabled, hide_code')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !data) {
    return new Response(JSON.stringify({ error: 'not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ...data, online: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
