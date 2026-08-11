// Resolves a username (or email) to the account's email address, masked,
// for the Forgot Password screen — the user only has to type their
// username, never their email, and we still don't fully expose it on
// screen (e.g. "r***l@gmail.com").
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!domain) return email;
  const visible = name.length <= 2 ? name[0] : name.slice(0, 1) + '*'.repeat(Math.max(1, name.length - 2)) + name.slice(-1);
  return `${visible}@${domain}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { identifier } = await req.json();
    if (!identifier) {
      return new Response(JSON.stringify({ error: 'identifier required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let email: string | null = null;
    if (identifier.includes('@')) {
      email = identifier.trim();
    } else {
      const { data: profile } = await admin
        .from('profiles').select('user_id').ilike('username', identifier.trim()).maybeSingle();
      if (profile?.user_id) {
        const { data: userData } = await admin.auth.admin.getUserById(profile.user_id);
        email = userData?.user?.email ?? null;
      }
    }

    if (!email) {
      // Same response shape whether or not the account exists — avoids
      // confirming/denying which usernames are registered.
      return new Response(JSON.stringify({ found: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ found: true, email, masked: maskEmail(email) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ found: false }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
