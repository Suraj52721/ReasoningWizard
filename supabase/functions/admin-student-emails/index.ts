// @ts-nocheck  — Deno edge function; VS Code TS errors here are false positives
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: adminProfile, error: adminProfileErr } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (adminProfileErr || !adminProfile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { user_ids } = await req.json();
    if (!Array.isArray(user_ids)) {
      return new Response(JSON.stringify({ error: 'user_ids must be an array' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const targetIds = [...new Set(user_ids.filter((id: any) => typeof id === 'string' && id.length > 0))];
    if (targetIds.length === 0) {
      return new Response(JSON.stringify({ emails: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const targetSet = new Set(targetIds);
    const found = new Map<string, string>();

    // Iterate auth users pages and capture only requested IDs.
    const perPage = 1000;
    for (let page = 1; page <= 50 && found.size < targetSet.size; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;

      const users = data?.users || [];
      users.forEach((u: any) => {
        if (targetSet.has(u.id) && u.email) {
          found.set(u.id, u.email);
        }
      });

      if (users.length < perPage) break;
    }

    const emails = targetIds.map((id) => ({ id, email: found.get(id) || '' }));

    return new Response(JSON.stringify({ emails }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
