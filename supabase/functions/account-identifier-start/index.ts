// Account Center — step 1: ek naya email ya phone number add karne ke liye
// us email/number par 6-digit OTP bhejta hai.
//
// Body: { type: 'email' | 'phone', value: string }
// Email OTP  -> Resend  (RESEND_API_KEY, RESEND_FROM)
// Phone OTP  -> Twilio  (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const MAX_PER_TYPE = 5;
const OTP_TTL_MINUTES = 10;

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
  // Phone: kisi bhi desh ka number, E.164 format (+91..., +1...).
  const digits = value.replace(/[^\d+]/g, '');
  const e164 = digits.startsWith('+') ? digits : `+${digits}`;
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sendEmailOtp(to: string, code: string) {
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM') ?? 'AR Pixelgram <onboarding@resend.dev>';
  if (!key) throw new Error('email_provider_not_configured');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `${code} — AR Pixelgram verification code`,
      html: `<div style="font-family:sans-serif"><h2>AR Pixelgram</h2>
        <p>Aapka verification code:</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:6px">${code}</p>
        <p>Ye code ${OTP_TTL_MINUTES} minute me expire ho jayega. Agar aapne request nahi ki, is email ko ignore karein.</p></div>`,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error('resend error', detail);
    throw new Error(`email_send_failed: ${detail.slice(0, 300)}`);
  }
}

async function sendSmsOtp(to: string, code: string) {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_FROM_NUMBER');
  if (!sid || !token || !from) throw new Error('sms_provider_not_configured');
  const body = new URLSearchParams({
    To: to,
    From: from,
    Body: `${code} aapka AR Pixelgram verification code hai. ${OTP_TTL_MINUTES} minute me expire hoga.`,
  });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error('twilio error', detail);
    throw new Error(`sms_send_failed: ${detail.slice(0, 300)}`);
  }
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

    const { type, value: rawValue } = await req.json();
    if (type !== 'email' && type !== 'phone') return json({ error: 'invalid_type' }, 400);

    const value = normalize(type, rawValue);
    if (!value) {
      return json({ error: type === 'email' ? 'Sahi email address daalein' : 'Sahi number daalein, country code ke saath (jaise +91…)' }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Limit: 5 email + 5 phone.
    const { count } = await admin
      .from('account_identifiers')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', type);
    if ((count ?? 0) >= MAX_PER_TYPE) {
      return json({ error: `Ek account me sirf ${MAX_PER_TYPE} ${type === 'email' ? 'email' : 'number'} add ho sakte hain` }, 400);
    }

    // Pehle se kisi account se juda hua?
    const { data: existing } = await admin
      .from('account_identifiers')
      .select('user_id')
      .eq('type', type)
      .eq('value', value)
      .maybeSingle();
    if (existing) {
      return json({
        error: existing.user_id === userId
          ? 'Ye pehle se aapke account me add hai'
          : 'Ye kisi dusre account me pehle se use ho raha hai',
      }, 400);
    }

    // Simple rate limit: 10 min me max 5 OTP.
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: recent } = await admin
      .from('account_identifier_otps')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', since);
    if ((recent ?? 0) >= 5) {
      return json({ error: 'Bahut zyada requests. Thodi der baad try karein.' }, 429);
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await sha256(`${value}:${code}`);

    const { error: insertError } = await admin.from('account_identifier_otps').insert({
      user_id: userId,
      type,
      value,
      code_hash: codeHash,
      expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString(),
    });
    if (insertError) throw insertError;

    if (type === 'email') await sendEmailOtp(value, code);
    else await sendSmsOtp(value, code);

    return json({ ok: true, value });
  } catch (e) {
    const message = String((e as Error)?.message ?? e);
    console.error('account-identifier-start', message);
    if (message.includes('email_provider_not_configured')) {
      return json({ error: 'Email OTP service abhi setup nahi hai (RESEND_API_KEY missing).' }, 500);
    }
    if (message.includes('sms_provider_not_configured')) {
      return json({ error: 'SMS OTP service abhi setup nahi hai (Twilio keys missing).' }, 500);
    }
    if (message.includes('send_failed')) {
      return json({ error: `OTP bhejne me dikkat aayi: ${message.replace(/^.*send_failed:\s*/, '').slice(0, 300)}` }, 502);
    }
    return json({ error: 'Kuch galat ho gaya. Dobara try karein.' }, 500);
  }
});
