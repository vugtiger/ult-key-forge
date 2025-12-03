import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');

    if (!slug) {
      return new Response('Missing slug parameter', { 
        status: 400, 
        headers: { 'Content-Type': 'text/plain' } 
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: paste, error } = await supabase
      .from('pastes')
      .select('content')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      console.error('Error fetching paste:', error);
      return new Response('Error fetching paste', { 
        status: 500, 
        headers: { 'Content-Type': 'text/plain' } 
      });
    }

    if (!paste) {
      return new Response('Paste not found', { 
        status: 404, 
        headers: { 'Content-Type': 'text/plain' } 
      });
    }

    // Return plain text content - NOT HTML, NOT JSON
    // This is important for Roblox loadstring to work
    return new Response(paste.content, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error('Error in get-paste function:', error);
    return new Response('Internal server error', { 
      status: 500, 
      headers: { 'Content-Type': 'text/plain' } 
    });
  }
});
