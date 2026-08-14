import { supabase } from '@/db/supabase';

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
    const message = (data as { error?: string } | null)?.error;
    throw new Error(message || 'OTP bhejne me dikkat aayi. Dobara try karein.');
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
    const message = (data as { error?: string } | null)?.error;
    throw new Error(message || 'OTP verify nahi hua. Dobara try karein.');
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
}
