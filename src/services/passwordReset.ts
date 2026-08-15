import { supabase } from '@/db/supabase';

export interface ResetStart {
  found: boolean;
  token?: string;
  masked?: string;
}

function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!domain) return email;
  const visible = name.length <= 2
    ? name.slice(0, 1)
    : `${name.slice(0, 1)}${'*'.repeat(Math.max(1, name.length - 2))}${name.slice(-1)}`;
  return `${visible}@${domain}`;
}

/**
 * Sends the built-in recovery OTP directly. This avoids depending on the
 * separately deployed password-reset-start function.
 */
export async function startPasswordReset(identifier: string): Promise<ResetStart> {
  const email = identifier.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Password reset ke liye account ka email daalein');
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw new Error(error.message);

  return { found: true, token: email, masked: maskEmail(email) };
}

/** Verifies the email recovery OTP and updates the password. */
export async function confirmPasswordReset(token: string, code: string, password: string): Promise<void> {
  const { error: verifyError } = await supabase.auth.verifyOtp({
    email: token,
    token: code.trim(),
    type: 'recovery',
  });
  if (verifyError) throw new Error(verifyError.message);

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) throw new Error(updateError.message);
}
