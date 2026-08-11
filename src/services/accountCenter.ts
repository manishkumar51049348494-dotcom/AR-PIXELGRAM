import { supabase } from '@/db/supabase';

export type IdentifierType = 'email' | 'phone';

export interface AccountIdentifier {
  id: string;
  user_id: string;
  type: IdentifierType;
  value: string;
  is_primary: boolean;
  created_at: string;
}

export const MAX_PER_TYPE = 5;

export async function listMyIdentifiers(): Promise<AccountIdentifier[]> {
  const { data, error } = await supabase
    .from('account_identifiers')
    .select('*')
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AccountIdentifier[];
}

/** OTP bhejta hai us email/number par jise add karna hai. */
export async function sendIdentifierOtp(type: IdentifierType, value: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('account-identifier-start', {
    body: { type, value },
  });
  if (error && !data?.error) throw new Error('OTP bhejne me dikkat aayi. Dobara try karein.');
  if (data?.error) throw new Error(data.error);
}

/** OTP verify karke email/number ko account se jodta hai. */
export async function confirmIdentifierOtp(type: IdentifierType, value: string, code: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('account-identifier-confirm', {
    body: { type, value, code },
  });
  if (error && !data?.error) throw new Error('Verify karne me dikkat aayi. Dobara try karein.');
  if (data?.error) throw new Error(data.error);
}

export async function removeIdentifier(id: string): Promise<void> {
  const { error } = await supabase.from('account_identifiers').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
