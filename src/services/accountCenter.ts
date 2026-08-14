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

/** Edge function ka asli error message nikalta hai (warna sirf generic error milta hai). */
async function invokeFn(name: string, body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // supabase-js non-2xx par error deta hai aur body error.context (Response) me hota hai.
    const ctx = (error as any)?.context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const parsed = await ctx.clone().json();
        if (parsed?.error) throw new Error(parsed.error);
      } catch (e) {
        if (e instanceof Error && e.message && !/json/i.test(e.message)) throw e;
      }
    }
    throw new Error(error.message || 'Server se jawab nahi mila. Dobara try karein.');
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

/** OTP bhejta hai us email/number par jise add karna hai. */
export async function sendIdentifierOtp(type: IdentifierType, value: string): Promise<void> {
  await invokeFn('account-identifier-start', { type, value });
}

/** OTP verify karke email/number ko account se jodta hai. */
export async function confirmIdentifierOtp(type: IdentifierType, value: string, code: string): Promise<void> {
  await invokeFn('account-identifier-confirm', { type, value, code });
}

export async function removeIdentifier(id: string): Promise<void> {
  const { error } = await supabase.from('account_identifiers').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
