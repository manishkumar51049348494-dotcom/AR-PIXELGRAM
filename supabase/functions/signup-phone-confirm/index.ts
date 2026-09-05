// Signup step 2 (logged out): SMS code verify karke phone-based account banata hai.
// Body: { phone, code, password, username, full_name }
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

function normalizePhone(raw: string): string | null {
  const digits = (raw ?? '').replace(/[^\d+]/g, '');
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
    const body = await req.json();
    const e164 = normalizePhone(body?.phone ?? '');
    const code = String(body?.code ?? '').trim();
    const password = String(body?.password ?? '');
    const username = String(body?.username ?? '').toLowerCase().trim();
    const fullName = String(body?.full_name ?? '').trim();

    if (!e164) return json({ error: 'Sahi mobile number daalein.' }, 400);
    if (!/^\d{6}$/.test(code)) return json({ error: 'SMS me aaya 6-digit code daalein.' }, 400);
    if (password.length < 6) return json({ error: 'Password kam se kam 6 characters ka ho.' }, 400);
    if (!/^[a-z0-9_.]{3,20}$/.test(username)) return json({ error: 'Username sahi nahi hai.' }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: otpRow } = await admin
      .from('signup_phone_otps')
      .select('id, code_hash, attempts, expires_at, consumed_at')
      .eq('phone', e164)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpRow || otpRow.consumed_at) {
      return json({ error: 'Code milā nahi. Naya code bhejein.' }, 400);
    }
    if (new Date(otpRow.expires_at).getTime() < Date.now()) {
      return json({ error: 'Code expire ho gaya. Naya code bhejein.' }, 400);
    }
    if ((otpRow.attempts ?? 0) >= MAX_ATTEMPTS) {
      return json({ error: 'Bahut zyada galat try. Naya code bhejein.' }, 429);
    }

    const expected = await sha256(`${e164}:${code}`);
    if (expected !== otpRow.code_hash) {
      await admin
        .from('signup_phone_otps')
        .update({ attempts: (otpRow.attempts ?? 0) + 1 })
        .eq('id', otpRow.id);
      return json({ error: 'Code galat hai. Dobara check karein.' }, 400);
    }

    // Username / number dobara check.
    const { data: taken } = await admin
      .from('profiles')
      .select('user_id')
      .eq('username', username)
      .maybeSingle();
    if (taken) return json({ error: 'Ye username pehle se le liya gaya hai.' }, 400);

    const { data: existing } = await admin
      .from('account_identifiers')
      .select('user_id')
      .eq('type', 'phone')
      .eq('value', e164)
      .maybeSingle();
    if (existing?.user_id) return json({ error: 'Ye number pehle se kisi account par hai.' }, 400);

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      phone: e164,
      password,
      phone_confirm: true,
      user_metadata: { username, full_name: fullName },
    });
    if (createError || !created?.user) {
      console.error(createError);
      return json({ error: createError?.message || 'Account nahi ban paaya. Dobara try karein.' }, 400);
    }

    await admin.from('signup_phone_otps').update({ consumed_at: new Date().toISOString() }).eq('id', otpRow.id);

    await admin.from('account_identifiers').insert({
      user_id: created.user.id,
      type: 'phone',
      value: e164,
      is_primary: true,
    });

    // Session banao taki user turant logged in ho jaye.
    const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ phone: e164, password }),
    });
    const tokenJson = await tokenRes.json().catch(() => ({}));

    return json({
      ok: true,
      user_id: created.user.id,
      access_token: tokenRes.ok ? tokenJson.access_token : null,
      refresh_token: tokenRes.ok ? tokenJson.refresh_token : null,
    });
  } catch (e) {
    console.error(e);
    return json({ error: 'Kuch galat ho gaya. Dobara try karein.' }, 500);
  }
});
