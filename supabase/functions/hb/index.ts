const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get('slug') ?? '';
  const id = url.searchParams.get('id') ?? '';

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const heartbeatUrl = `${supabaseUrl}/functions/v1/paste-heartbeat?id=${encodeURIComponent(id)}&slug=${encodeURIComponent(slug)}`;

  // Minimal HTML: black background, no visible content, runs heartbeat script
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title></title>
  <style>*{margin:0;padding:0}html,body{height:100%;background:#000}</style>
</head>
<body>
<script>
(function(){
  var u="${heartbeatUrl}";
  function p(){
    fetch(u+"&t="+Date.now(),{method:"GET",mode:"cors",cache:"no-store",keepalive:true}).catch(function(){});
  }
  p();
  setInterval(p,25000);
  document.addEventListener("visibilitychange",function(){if(!document.hidden)p();});
  window.addEventListener("pagehide",function(){
    try{navigator.sendBeacon&&navigator.sendBeacon(u+"&t="+Date.now(),"");}catch(e){}
  });
})();
</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  });
});
