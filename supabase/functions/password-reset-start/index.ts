// Password reset — step 1 (Facebook jaisa): username/email/phone se account
// dhoondh kar us account ke email par 6-digit OTP bhejta hai. Koi reset LINK nahi.
// Body: { identifier: string }
// Response: { found: boolean, token?: string, masked?: string }
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

function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!domain) return email;
  const visible = name.length <= 2 ? name[0] : name.slice(0, 1) + '*'.repeat(Math.max(1, name.length - 2)) + name.slice(-1);
  return `${visible}@${domain}`;
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
      subject: `${code} — AR Pixelgram password reset code`,
      html: `<div style="font-family:sans-serif"><h2>AR Pixelgram</h2>
        <p>Password reset karne ke liye aapka code:</p>
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { identifier: rawIdentifier } = await req.json();
    const identifier = String(rawIdentifier ?? '').trim();
    if (!identifier) return json({ error: 'Username, email ya number daalein' }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1) identifier -> user_id
    let userId: string | null = null;
    if (identifier.includes('@')) {
      const { data } = await admin.rpc('get_user_id_by_email', { _email: identifier.toLowerCase() });
      userId = (data as string | null) ?? null;
      if (!userId) {
        const { data: ident } = await admin
          .from('account_identifiers')
          .select('user_id').eq('type', 'email').eq('value', identifier.toLowerCase()).maybeSingle();
        userId = ident?.user_id ?? null;
      }
    } else if (/^\+?\d[\d\s-]{6,}$/.test(identifier)) {
      const digits = identifier.replace(/[^\d+]/g, '');
      const e164 = digits.startsWith('+') ? digits : `+${digits}`;
      const { data: ident } = await admin
        .from('account_identifiers')
        .select('user_id').eq('type', 'phone').eq('value', e164).maybeSingle();
      userId = ident?.user_id ?? null;
    } else {
      const { data: profile } = await admin
        .from('profiles').select('user_id').ilike('username', identifier).maybeSingle();
      userId = profile?.user_id ?? null;
    }

    if (!userId) return json({ found: false });

    // 2) us account ka email
    const { data: userData } = await admin.auth.admin.getUserById(userId);
    let email = userData?.user?.email ?? null;
    if (!email) {
      const { data: ident } = await admin
        .from('account_identifiers')
        .select('value').eq('user_id', userId).eq('type', 'email')
        .order('created_at', { ascending: true }).limit(1).maybeSingle();
      email = ident?.value ?? null;
    }
    if (!email) return json({ found: false });

    // 3) rate limit: 10 min me max 5 OTP
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await admin
      .from('password_reset_otps')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId).gte('created_at', since);
    if ((count ?? 0) >= 5) return json({ error: 'Bahut zyada requests. Thodi der baad try karein.' }, 429);

    // 4) OTP banao aur bhejo
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await sha256(`${email}:${code}`);
    const { data: inserted, error: insertError } = await admin
      .from('password_reset_otps')
      .insert({
        user_id: userId,
        email,
        code_hash: codeHash,
        expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString(),
      })
      .select('id').single();
    if (insertError) throw insertError;

    await sendEmailOtp(email, code);

    return json({ found: true, token: inserted.id, masked: maskEmail(email) });
  } catch (e) {
    const message = String((e as Error)?.message ?? e);
    console.error('password-reset-start', message);
    if (message.includes('email_provider_not_configured')) {
      return json({ error: 'Email OTP service abhi setup nahi hai.' }, 500);
    }
    if (message.includes('send_failed')) {
      return json({ error: 'OTP bhejne me dikkat aayi. Thodi der baad try karein.' }, 502);
    }
    return json({ error: 'Kuch galat ho gaya. Dobara try karein.' }, 500);
  }
});
