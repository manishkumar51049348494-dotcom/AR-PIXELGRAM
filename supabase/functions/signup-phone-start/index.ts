// Signup step 1 (logged out): mobile number par 6-digit SMS code bhejta hai.
// Body: { phone: string }
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const OTP_TTL_MINUTES = 10;

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

async function sendSms(to: string, code: string) {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_FROM_NUMBER');
  if (!sid || !token || !from) throw new Error('sms_provider_not_configured');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      To: to,
      From: from,
      Body: `${code} aapka AR Pixelgram verification code hai. Ye ${OTP_TTL_MINUTES} minute me expire ho jayega.`,
    }),
  });
  if (!res.ok) {
    console.error('twilio error', await res.text());
    throw new Error('sms_send_failed');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { phone } = await req.json();
    const e164 = normalizePhone(phone ?? '');
    if (!e164) return json({ error: 'Country code ke saath poora mobile number daalein.' }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Number pehle se kisi account par to nahi?
    const { data: existing } = await admin
      .from('account_identifiers')
      .select('user_id')
      .eq('type', 'phone')
      .eq('value', e164)
      .maybeSingle();
    if (existing?.user_id) {
      return json({ error: 'Ye number pehle se kisi account par hai. Log in karein.' }, 400);
    }

    // Rate limit: 10 minute me max 5 code.
    const since = new Date(Date.now() - OTP_TTL_MINUTES * 60_000).toISOString();
    const { count } = await admin
      .from('signup_phone_otps')
      .select('id', { count: 'exact', head: true })
      .eq('phone', e164)
      .gte('created_at', since);
    if ((count ?? 0) >= 5) {
      return json({ error: 'Bahut zyada try ho gaye. 10 minute baad dobara koshish karein.' }, 429);
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const code_hash = await sha256(`${e164}:${code}`);

    const { error: insertError } = await admin.from('signup_phone_otps').insert({
      phone: e164,
      code_hash,
      expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString(),
    });
    if (insertError) {
      console.error(insertError);
      return json({ error: 'Code save nahi ho paaya. Dobara try karein.' }, 500);
    }

    try {
      await sendSms(e164, code);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === 'sms_provider_not_configured') {
        return json({ error: 'SMS service abhi setup nahi hai (Twilio keys missing).' }, 500);
      }
      return json({ error: 'SMS bhejne me dikkat aayi. Number check karke dobara try karein.' }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: 'Kuch galat ho gaya. Dobara try karein.' }, 500);
  }
});
