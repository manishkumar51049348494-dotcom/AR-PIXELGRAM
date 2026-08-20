// Facebook jaisa "Find your account" — username / email / phone daalne par us
// identifier se jude accounts (naam + profile photo ke saath) lautata hai, aur
// har account ke email/number MASKED form me, taaki user chun sake ki OTP kahan
// bheja jaye. Asli email/number kabhi client ko nahi jaate.
//
// Body: { identifier: string }
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { identifier: rawIdentifier } = await req.json();
    const identifier = String(rawIdentifier ?? '').trim();
    if (!identifier) return json({ error: 'Username, email ya number daalein' }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const userIds = new Set<string>();
    const looksLikeEmail = identifier.includes('@');
    const digitsOnly = identifier.replace(/[^\d+]/g, '');
    const looksLikePhone = !looksLikeEmail && /^\+?\d{7,15}$/.test(digitsOnly);

    if (looksLikeEmail) {
      const email = identifier.toLowerCase();
      const { data: byRpc } = await admin.rpc('get_user_id_by_email', { _email: email });
      if (byRpc) userIds.add(byRpc as string);
      const { data: rows } = await admin
        .from('account_identifiers').select('user_id').eq('type', 'email').eq('value', email);
      (rows ?? []).forEach((r: { user_id: string }) => userIds.add(r.user_id));
    } else if (looksLikePhone) {
      const e164 = digitsOnly.startsWith('+') ? digitsOnly : `+${digitsOnly}`;
      const { data: rows } = await admin
        .from('account_identifiers').select('user_id').eq('type', 'phone').eq('value', e164);
      (rows ?? []).forEach((r: { user_id: string }) => userIds.add(r.user_id));
    } else {
      const { data: exact } = await admin
        .from('profiles').select('user_id').ilike('username', identifier).limit(5);
      (exact ?? []).forEach((r: { user_id: string }) => userIds.add(r.user_id));
      if (userIds.size === 0) {
        const { data: byName } = await admin
          .from('profiles').select('user_id').ilike('full_name', `%${identifier}%`).limit(5);
        (byName ?? []).forEach((r: { user_id: string }) => userIds.add(r.user_id));
      }
    }

    if (userIds.size === 0) return json({ accounts: [] });

    const ids = Array.from(userIds).slice(0, 5);
    const { data: profiles } = await admin
      .from('profiles')
      .select('user_id, username, full_name, avatar_url, is_verified')
      .in('user_id', ids);

    const { data: identifiers } = await admin
      .from('account_identifiers')
      .select('id, user_id, type, value, is_primary')
      .in('user_id', ids)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });

    const accounts = [];
    for (const id of ids) {
      const profile = (profiles ?? []).find((p: { user_id: string }) => p.user_id === id);
      const destinations: Array<{ id: string; type: 'email' | 'whatsapp'; masked: string }> = [];

      for (const row of (identifiers ?? []) as Array<{ id: string; user_id: string; type: string; value: string }>) {
        if (row.user_id !== id) continue;
        destinations.push({
          id: row.id,
          type: row.type === 'phone' ? 'whatsapp' : 'email',
          masked: row.type === 'phone' ? maskPhone(row.value) : maskEmail(row.value),
        });
      }

      const { data: userData } = await admin.auth.admin.getUserById(id);
      const authEmail = userData?.user?.email ?? null;
      if (authEmail && !authEmail.endsWith('@phone.arpixelgram.app')) {
        const already = (identifiers ?? []).some(
          (r: { user_id: string; type: string; value: string }) =>
            r.user_id === id && r.type === 'email' && r.value === authEmail.toLowerCase(),
        );
        if (!already) {
          destinations.unshift({ id: `auth:${id}`, type: 'email', masked: maskEmail(authEmail) });
        }
      }

      if (destinations.length === 0) continue;
      accounts.push({
        userId: id,
        username: profile?.username ?? '',
        fullName: profile?.full_name ?? profile?.username ?? 'AR Pixelgram user',
        avatarUrl: profile?.avatar_url ?? null,
        isVerified: Boolean(profile?.is_verified),
        destinations,
      });
    }

    return json({ accounts });
  } catch (e) {
    console.error('find-accounts', e);
    return json({ error: 'Account dhoondhne me dikkat aayi. Dobara try karein.' }, 500);
  }
});
