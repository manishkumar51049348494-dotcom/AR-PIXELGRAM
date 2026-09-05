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

    // Identifier email / phone / username — teeno ho sakta hai. Account Center
    // me add kiye gaye extra email/number bhi yahin resolve hote hain, taaki
    // unse bhi wahi password daal kar login ho jaye.
    const raw = String(identifier).trim();
    let email: string | null = null;
    let ownerId: string | null = null;

    const looksLikeEmail = raw.includes('@');
    const digitsOnly = raw.replace(/[^\d+]/g, '');
    const looksLikePhone = !looksLikeEmail && /^\+?\d{8,15}$/.test(digitsOnly);

    if (looksLikeEmail) {
      const normalized = raw.toLowerCase();
      const { data: idRow } = await admin
        .from('account_identifiers')
        .select('user_id')
        .eq('type', 'email')
        .eq('value', normalized)
        .maybeSingle();
      if (idRow?.user_id) ownerId = idRow.user_id;
      else email = normalized; // purane accounts jinka identifier row nahi bana
    } else if (looksLikePhone) {
      const e164 = digitsOnly.startsWith('+') ? digitsOnly : `+${digitsOnly}`;
      const { data: idRow } = await admin
        .from('account_identifiers')
        .select('user_id')
        .eq('type', 'phone')
        .eq('value', e164)
        .maybeSingle();
      if (idRow?.user_id) ownerId = idRow.user_id;
    } else {
      const { data: profile } = await admin
        .from('profiles')
        .select('user_id')
        .ilike('username', raw)
        .maybeSingle();
      if (profile?.user_id) ownerId = profile.user_id;
    }

    // Phone-only accounts (jinme email hai hi nahi) ke liye phone se login karte hain.
    let phoneLogin: string | null = null;
    if (!email && ownerId) {
      const { data: userData } = await admin.auth.admin.getUserById(ownerId);
      email = userData?.user?.email ?? null;
      if (!email) phoneLogin = userData?.user?.phone
        ? (userData.user.phone.startsWith('+') ? userData.user.phone : `+${userData.user.phone}`)
        : null;
    }

    if (!email && !phoneLogin) {
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Perform the actual password sign-in against GoTrue directly, using the
    // resolved email, and hand the resulting session back to the client.
    const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify(email ? { email, password } : { phone: phoneLogin, password }),
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
