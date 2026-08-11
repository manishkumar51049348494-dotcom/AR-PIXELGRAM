// Returns { user_id, email, last_sign_in_at, created_at, updated_at } for
// every account, for the admin panel's Visitors & Devices / User Management
// pages. `updated_at` is the closest thing Supabase Auth exposes to "last
// account change" (password changes update it, but so do a few other
// account-level changes) — there's no dedicated password-change timestamp.
//
// Only the caller's *email* and *last sign-in time* are exposed — never a
// password. Supabase Auth stores only a one-way bcrypt hash of the password
// (auth.users.encrypted_password); the original password is never
// recoverable by anyone, including us. Showing raw passwords in an admin
// panel isn't something any legitimate app does (Instagram/Facebook admins
// can't see user passwords either) — it would also mean this app fails to
// meet basic security/privacy standards.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const caller = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: authData, error: authError } = await caller.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Only admins may call this.
    const { data: callerProfile } = await admin
      .from('profiles').select('is_admin').eq('user_id', authData.user.id).maybeSingle();
    if (!callerProfile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: { user_id: string; email: string | null; last_sign_in_at: string | null; created_at: string; updated_at: string | null }[] = [];
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      for (const u of data.users) {
        results.push({
          user_id: u.id,
          email: u.email ?? null,
          last_sign_in_at: u.last_sign_in_at ?? null,
          created_at: u.created_at,
          updated_at: u.updated_at ?? null,
        });
      }
      if (data.users.length < perPage) break;
      page += 1;
      if (page > 20) break; // safety cap (20k users)
    }

    return new Response(JSON.stringify({ users: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
