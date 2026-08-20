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

/** Edge function ka asli error message nikalta hai (warna sirf generic error milta hai). */
async function invokeFn<T>(name: string, body: Record<string, unknown>): Promise<T> {
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
    throw new Error(error.message || 'Server se jawab nahi mila. Dobara try karein.');
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
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
