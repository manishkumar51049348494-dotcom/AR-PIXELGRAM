// Lets users sign in with either their username OR their email + password.
// Supabase Auth's password grant only accepts an email, so when the person
// types a username we resolve it to the matching account's email here
// (server-side, via the service role) and then perform the sign-in
// ourselves, returning the session tokens to the client.
//
// Both "no such username" and "wrong password" return the same generic
// error message — this prevents the endpoint being used to enumerate which
// usernames exist.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const GENERIC_ERROR = 'Invalid login credentials';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { identifier, password } = await req.json();
    if (!identifier || !password) {
      return new Response(JSON.stringify({ error: 'identifier and password required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let email: string | null = null;
    if (identifier.includes('@')) {
      email = identifier.trim();
    } else {
      // Username → find the owning account, then look up its email.
      const { data: profile } = await admin
        .from('profiles')
        .select('user_id')
        .ilike('username', identifier.trim())
        .maybeSingle();
      if (profile?.user_id) {
        const { data: userData } = await admin.auth.admin.getUserById(profile.user_id);
        email = userData?.user?.email ?? null;
      }
    }

    if (!email) {
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Perform the actual password sign-in against GoTrue directly, using the
    // resolved email, and hand the resulting session back to the client.
    const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(tokenJson), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
