// Password reset — step 1 (Facebook jaisa).
//
// Do tarike se call ho sakta hai:
//  A) { identifier }             -> purana behaviour: account ke primary email par OTP
//  B) { userId, destinationId }  -> find-accounts se chuna gaya email ya WhatsApp number
//
// Email OTP    -> Resend (RESEND_API_KEY, RESEND_FROM)
// WhatsApp OTP -> Meta WhatsApp Cloud API
//                 (WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
//                  WHATSAPP_TEMPLATE_NAME optional, WHATSAPP_TEMPLATE_LANG optional)
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
  const visible = name.length <= 2
    ? `${name.slice(0, 1)}*`
    : `${name.slice(0, 1)}${'*'.repeat(Math.max(1, name.length - 2))}${name.slice(-1)}`;
  return `${visible}@${domain}`;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  const last = digits.slice(-2);
  const cc = phone.startsWith('+') ? `+${digits.slice(0, Math.max(1, digits.length - 8))}` : '';
  return `${cc} ${'*'.repeat(6)}${last}`.trim();
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

// OTP WhatsApp par jaata hai (SMS par nahi). Approved template ho to wahi use
// hota hai, warna plain text message.
async function sendWhatsappOtp(to: string, code: string) {
  const token = Deno.env.get('WHATSAPP_TOKEN');
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  if (!token || !phoneNumberId) throw new Error('whatsapp_provider_not_configured');

  const template = Deno.env.get('WHATSAPP_TEMPLATE_NAME');
  const lang = Deno.env.get('WHATSAPP_TEMPLATE_LANG') ?? 'en_US';
  const recipient = to.replace(/[^\d]/g, '');

  const payload = template
    ? {
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'template',
        template: {
          name: template,
          language: { code: lang },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: code }] },
            { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
          ],
        },
      }
    : {
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'text',
        text: {
          body: `${code} aapka AR Pixelgram password reset code hai. Ye ${OTP_TTL_MINUTES} minute me expire ho jayega. Kisi ke saath share na karein.`,
        },
      };

  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error('whatsapp error', detail);
    throw new Error(`whatsapp_send_failed: ${detail.slice(0, 300)}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json();
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let userId: string | null = null;
    let channel: 'email' | 'whatsapp' = 'email';
    let destination: string | null = null;

    if (body?.userId && body?.destinationId) {
      userId = String(body.userId);
      const destinationId = String(body.destinationId);

      if (destinationId.startsWith('auth:')) {
        const { data: userData } = await admin.auth.admin.getUserById(userId);
        destination = userData?.user?.email ?? null;
        channel = 'email';
      } else {
        const { data: row } = await admin
          .from('account_identifiers')
          .select('type, value, user_id')
          .eq('id', destinationId)
          .maybeSingle();
        if (!row || row.user_id !== userId) return json({ found: false });
        destination = row.value;
        channel = row.type === 'phone' ? 'whatsapp' : 'email';
      }
    } else {
      const identifier = String(body?.identifier ?? '').trim();
      if (!identifier) return json({ error: 'Username, email ya number daalein' }, 400);

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

      const { data: userData } = await admin.auth.admin.getUserById(userId);
      destination = userData?.user?.email ?? null;
      if (!destination || destination.endsWith('@phone.arpixelgram.app')) {
        const { data: ident } = await admin
          .from('account_identifiers')
          .select('value').eq('user_id', userId).eq('type', 'email')
          .order('created_at', { ascending: true }).limit(1).maybeSingle();
        destination = ident?.value ?? destination;
      }
      channel = 'email';
    }

    if (!userId || !destination) return json({ found: false });

    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await admin
      .from('password_reset_otps')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId).gte('created_at', since);
    if ((count ?? 0) >= 5) return json({ error: 'Bahut zyada requests. Thodi der baad try karein.' }, 429);

    // Purane un-used code invalid — sirf latest OTP chalega.
    await admin.from('password_reset_otps')
      .update({ consumed_at: new Date().toISOString() })
      .eq('user_id', userId).is('consumed_at', null);

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await sha256(`${destination}:${code}`);
    const { data: inserted, error: insertError } = await admin
      .from('password_reset_otps')
      .insert({
        user_id: userId,
        email: destination, // email ya E.164 number — dono yahin store hote hain
        code_hash: codeHash,
        expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString(),
      })
      .select('id').single();
    if (insertError) throw insertError;

    if (channel === 'whatsapp') await sendWhatsappOtp(destination, code);
    else await sendEmailOtp(destination, code);

    return json({
      found: true,
      token: inserted.id,
      channel,
      masked: channel === 'whatsapp' ? maskPhone(destination) : maskEmail(destination),
      expiresInMinutes: OTP_TTL_MINUTES,
    });
  } catch (e) {
    const message = String((e as Error)?.message ?? e);
    console.error('password-reset-start', message);
    if (message.includes('email_provider_not_configured')) {
      return json({ error: 'Email OTP service abhi setup nahi hai (RESEND_API_KEY missing).' }, 500);
    }
    if (message.includes('whatsapp_provider_not_configured')) {
      return json({ error: 'WhatsApp OTP service abhi setup nahi hai (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID missing).' }, 500);
    }
    if (message.includes('send_failed')) {
      return json({ error: `OTP bhejne me dikkat aayi: ${message.replace(/^.*send_failed:\s*/, '').slice(0, 300)}` }, 502);
    }
    return json({ error: `Kuch galat ho gaya: ${message}` }, 500);
  }
});
