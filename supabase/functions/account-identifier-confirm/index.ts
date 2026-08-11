// Account Center — step 2: OTP verify karke email/phone ko account se jodta hai.
// Body: { type: 'email' | 'phone', value: string, code: string }
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const MAX_ATTEMPTS = 5;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function normalize(type: string, raw: string): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  if (type === 'email') {
    const email = value.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
  }
  const digits = value.replace(/[^\d+]/g, '');
  const e164 = digits.startsWith('+') ? digits : `+${digits}`;
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await caller.auth.getUser();
    if (authError || !authData.user) return json({ error: 'Unauthorized' }, 401);
    const userId = authData.user.id;

    const { type, value: rawValue, code } = await req.json();
    if (type !== 'email' && type !== 'phone') return json({ error: 'invalid_type' }, 400);
    const value = normalize(type, rawValue);
    if (!value || !code) return json({ error: 'OTP aur value dono chahiye' }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: otp } = await admin
      .from('account_identifier_otps')
      .select('*')
      .eq('user_id', userId)
      .eq('type', type)
      .eq('value', value)
      .is('consumed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otp) return json({ error: 'OTP nahi mila. Naya OTP bhejein.' }, 400);
    if (new Date(otp.expires_at).getTime() < Date.now()) {
      return json({ error: 'OTP expire ho gaya. Naya OTP bhejein.' }, 400);
    }
    if (otp.attempts >= MAX_ATTEMPTS) {
      return json({ error: 'Bahut zyada galat try. Naya OTP bhejein.' }, 429);
    }

    const codeHash = await sha256(`${value}:${String(code).trim()}`);
    if (codeHash !== otp.code_hash) {
      await admin
        .from('account_identifier_otps')
        .update({ attempts: otp.attempts + 1 })
        .eq('id', otp.id);
      return json({ error: 'Galat OTP' }, 400);
    }

    const { error: insertError } = await admin.from('account_identifiers').insert({
      user_id: userId,
      type,
      value,
      is_primary: false,
    });
    if (insertError) {
      const msg = String(insertError.message ?? '');
      if (msg.includes('identifier_limit_reached')) {
        return json({ error: 'Ek account me sirf 5 email aur 5 number add ho sakte hain' }, 400);
      }
      if (msg.includes('duplicate') || insertError.code === '23505') {
        return json({ error: 'Ye pehle se kisi account me use ho raha hai' }, 400);
      }
      throw insertError;
    }

    await admin
      .from('account_identifier_otps')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', otp.id);

    return json({ ok: true });
  } catch (e) {
    console.error('account-identifier-confirm', e);
    return json({ error: 'Kuch galat ho gaya. Dobara try karein.' }, 500);
  }
});
