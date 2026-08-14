import { supabase } from '@/db/supabase';

/** Edge function ke error response se asli message nikalta hai. */
async function extractError(error: unknown, fallback: string): Promise<string> {
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = (await ctx.clone().json()) as { error?: string };
      if (body?.error) return body.error;
    } catch {
      /* ignore */
    }
  }
  const msg = (error as { message?: string } | null)?.message;
  return msg && !/non-2xx/i.test(msg) ? msg : fallback;
}

export interface ResetStart {
  found: boolean;
  token?: string;
  masked?: string;
}

/** Step 1 — account dhoondh kar uske email par 6-digit OTP bhejta hai (koi link nahi). */
export async function startPasswordReset(identifier: string): Promise<ResetStart> {
  const { data, error } = await supabase.functions.invoke('password-reset-start', {
    body: { identifier: identifier.trim() },
  });
  if (error) {
    throw new Error(
      (data as { error?: string } | null)?.error ||
        (await extractError(error, 'OTP bhejne me dikkat aayi. Dobara try karein.')),
    );
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as ResetStart;
}

/** Step 2 — OTP verify karke naya password set karta hai. */
export async function confirmPasswordReset(token: string, code: string, password: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('password-reset-confirm', {
    body: { token, code: code.trim(), password },
  });
  if (error) {
    throw new Error(
      (data as { error?: string } | null)?.error ||
        (await extractError(error, 'OTP verify nahi hua. Dobara try karein.')),
    );
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
}
