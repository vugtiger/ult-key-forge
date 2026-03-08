import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { email, password, secret_key } = await req.json();

    // Simple secret to prevent random calls
    if (secret_key !== 'bootstrap-owner-2024-ult') {
      return new Response(JSON.stringify({ error: 'Invalid secret' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if an admin already exists
    const { data: existingAdmin } = await serviceClient
      .from('user_roles').select('id').eq('role', 'admin').limit(1);

    // Create the user
    const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) throw authError;

    const userId = authData.user.id;

    // Delete any existing admin roles (replace old admin)
    if (existingAdmin && existingAdmin.length > 0) {
      await serviceClient.from('user_roles').delete().eq('role', 'admin');
    }

    // Assign admin role
    const { error: roleError } = await serviceClient.from('user_roles').insert({
      user_id: userId,
      role: 'admin',
    });

    if (roleError) throw roleError;

    return new Response(JSON.stringify({ 
      success: true, 
      user_id: userId,
      message: 'Owner account created and admin role assigned'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Bootstrap error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
