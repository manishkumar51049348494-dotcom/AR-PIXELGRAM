import { supabase } from '@/db/supabase';

export type OtpChannel = 'email' | 'whatsapp';

export interface ResetDestination {
  id: string;
  type: OtpChannel;
  masked: string;
}

export interface FoundAccount {
  userId: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  destinations: ResetDestination[];
}

export interface ResetStart {
  found: boolean;
  token?: string;
  masked?: string;
  channel?: OtpChannel;
  expiresInMinutes?: number;
}

/**
 * Edge function call — pehle SDK se, aur agar browser/SDK level par request
 * hi fail ho jaye ("Failed to send a request to the Edge Function") to seedha
 * functions URL par fetch kar ke dobara koshish karte hain. Isse CORS/preflight
 * ya SDK ki dikkat par bhi account finder kaam karta rehta hai.
 */
const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

async function directInvoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? ANON_KEY;
  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  let parsed: unknown = null;
  try { parsed = await res.json(); } catch { /* empty body */ }
  const errMsg = (parsed as { error?: string } | null)?.error;
  if (!res.ok || errMsg) {
    throw new Error(errMsg || 'Server se jawab nahi mila. Dobara try karein.');
  }
  return parsed as T;
}

async function invokeFn<T>(name: string, body: Record<string, unknown>): Promise<T> {
  try {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (error) {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.clone === 'function') {
        try {
          const parsed = await ctx.clone().json();
          if (parsed?.error) throw new Error(parsed.error);
        } catch (e) {
          if (e instanceof Error && e.message && !/json/i.test(e.message)) throw e;
        }
      }
      // Network / relay level failure — direct fetch se dobara koshish
      return await directInvoke<T>(name, body);
    }
    if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
    return data as T;
  } catch (e) {
    if (e instanceof Error && /failed to send|fetch|network|load failed/i.test(e.message)) {
      return await directInvoke<T>(name, body);
    }
    throw e;
  }
}

/**
 * Facebook jaisa "Find your account" — username / email / number se jude
 * accounts naam + profile photo ke saath.
 */
export async function findAccounts(identifier: string): Promise<FoundAccount[]> {
  const res = await invokeFn<{ accounts: FoundAccount[] }>('find-accounts', {
    identifier: identifier.trim(),
  });
  return res.accounts ?? [];
}

/** Chune gaye account ke chune gaye email/WhatsApp number par 6-digit OTP bhejta hai. */
export async function sendResetOtp(userId: string, destinationId: string): Promise<ResetStart> {
  return invokeFn<ResetStart>('password-reset-start', { userId, destinationId });
}

/** Purana flow — sirf identifier se account ke primary email par OTP. */
export async function startPasswordReset(identifier: string): Promise<ResetStart> {
  return invokeFn<ResetStart>('password-reset-start', { identifier: identifier.trim() });
}

/** OTP verify karke naya password set karta hai (expire/galat code server par check hota hai). */
export async function confirmPasswordReset(token: string, code: string, password: string): Promise<void> {
  await invokeFn<{ ok: boolean }>('password-reset-confirm', {
    token,
    code: code.trim(),
    password,
  });
}
