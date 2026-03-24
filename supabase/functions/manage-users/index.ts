import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Verify caller is admin
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
  if (!caller) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { data: callerRole } = await supabaseAdmin.rpc('get_user_role', { _user_id: caller.id });
  if (callerRole !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const body = await req.json();
  const { action } = body;

  try {
    if (action === 'create') {
      const { email, password, display_name, role, community_id } = body;
      
      // Create auth user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name },
      });
      if (createError) throw createError;

      // Update profile with community
      if (community_id) {
        await supabaseAdmin.from('profiles').update({ community_id }).eq('user_id', newUser.user.id);
      }

      // Assign role
      if (role) {
        await supabaseAdmin.from('user_roles').insert({ user_id: newUser.user.id, role });
      }

      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'update_role') {
      const { user_id, role } = body;
      // Delete existing role
      await supabaseAdmin.from('user_roles').delete().eq('user_id', user_id);
      // Insert new role
      if (role) {
        await supabaseAdmin.from('user_roles').insert({ user_id, role });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'update_community') {
      const { user_id, community_id } = body;
      await supabaseAdmin.from('profiles').update({ community_id: community_id || null }).eq('user_id', user_id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'delete') {
      const { user_id } = body;
      await supabaseAdmin.from('user_roles').delete().eq('user_id', user_id);
      await supabaseAdmin.from('profiles').delete().eq('user_id', user_id);
      await supabaseAdmin.auth.admin.deleteUser(user_id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
