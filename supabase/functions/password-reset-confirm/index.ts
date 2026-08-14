// Password reset — step 2: OTP verify karke naya password set karta hai.
// Body: { token: string, code: string, password: string }
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const MAX_ATTEMPTS = 5;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { token, code, password } = await req.json();
    if (!token || !code) return json({ error: 'OTP daalein' }, 400);
    if (!password || String(password).length < 6) {
      return json({ error: 'Password kam se kam 6 characters ka ho' }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: otp } = await admin
      .from('password_reset_otps')
      .select('*')
      .eq('id', token)
      .is('consumed_at', null)
      .maybeSingle();

    if (!otp) return json({ error: 'Ye code ab valid nahi hai. Naya code bhejein.' }, 400);
    if (new Date(otp.expires_at).getTime() < Date.now()) {
      return json({ error: 'Code expire ho gaya. Naya code bhejein.' }, 400);
    }
    if ((otp.attempts ?? 0) >= MAX_ATTEMPTS) {
      return json({ error: 'Bahut galat attempts. Naya code bhejein.' }, 400);
    }

    const expected = await sha256(`${otp.email}:${String(code).trim()}`);
    if (expected !== otp.code_hash) {
      await admin.from('password_reset_otps')
        .update({ attempts: (otp.attempts ?? 0) + 1 }).eq('id', otp.id);
      return json({ error: 'Galat OTP. Dobara try karein.' }, 400);
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(otp.user_id, {
      password: String(password),
    });
    if (updateError) return json({ error: updateError.message }, 400);

    await admin.from('password_reset_otps')
      .update({ consumed_at: new Date().toISOString() }).eq('id', otp.id);

    return json({ ok: true });
  } catch (e) {
    console.error('password-reset-confirm', e);
    return json({ error: 'Kuch galat ho gaya. Dobara try karein.' }, 500);
  }
});
