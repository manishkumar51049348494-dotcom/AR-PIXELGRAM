import React, { useState } from 'react';
import { KeyRound, Loader2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { startPasswordReset, confirmPasswordReset } from '@/services/passwordReset';

/**
 * Account Center → Password reset (Facebook jaisa).
 * Email par 6-digit OTP jata hai, wahi daal kar naya password set hota hai.
 * Koi reset link nahi.
 */
const PasswordResetSection: React.FC = () => {
  const { user, profile } = useAuth();
  const [stage, setStage] = useState<'idle' | 'verify'>('idle');
  const [token, setToken] = useState('');
  const [masked, setMasked] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);

  const accountEmail = user?.email || '';
  const identifier = accountEmail || profile?.username || '';

  // Account ka email masked form me — user ko pehle hi dikh jaye ki code kahan jayega.
  const maskEmail = (email: string) => {
    const [name, domain] = email.split('@');
    if (!domain) return email;
    const visible = name.length <= 2 ? name[0] : `${name.slice(0, 1)}${'*'.repeat(Math.max(1, name.length - 2))}${name.slice(-1)}`;
    return `${visible}@${domain}`;
  };

  const sendCode = async () => {
    if (!identifier) { toast.error('Account load nahi hua'); return; }
    setBusy(true);
    try {
      const res = await startPasswordReset(identifier);
      if (!res.found || !res.token) { toast.error('Account nahi mila'); return; }
      setToken(res.token);
      setMasked(res.masked ?? '');
      setCode('');
      setStage('verify');
      toast.success('OTP email par bhej diya');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (code.trim().length < 6) { toast.error('6-digit OTP daalein'); return; }
    if (password.length < 6) { toast.error('Password kam se kam 6 characters ka ho'); return; }
    if (password !== confirm) { toast.error('Dono password same nahi hain'); return; }
    setBusy(true);
    try {
      await confirmPasswordReset(token, code, password);
      toast.success('Password badal gaya ✅');
      setStage('idle');
      setPassword(''); setConfirm(''); setCode('');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="w-5 h-5 text-primary" />
        <p className="font-semibold text-foreground">Password</p>
      </div>

      {stage === 'idle' ? (
        <>
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
            <p className="text-xs text-muted-foreground">Is account ka email</p>
            <p className="text-sm font-semibold text-foreground break-all">
              {accountEmail ? maskEmail(accountEmail) : 'Email add nahi hai'}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Isi email par 6-digit code bhejenge. Code daal kar naya password set kar sakte hain.
          </p>
          <Button onClick={() => void sendCode()} disabled={busy || !identifier} className="w-full h-10 font-semibold">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send code'}
          </Button>
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-primary" /> {masked} par code bheja gaya
          </p>
          <Input
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6-digit OTP"
            inputMode="numeric"
            className="h-11 text-center tracking-[0.4em] font-semibold"
          />
          <div className="relative">
            <Input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Naya password"
              className="h-11 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPass(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Input
            type={showPass ? 'text' : 'password'}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Password dobara"
            className="h-11"
          />
          <div className="flex gap-2">
            <Button onClick={() => void submit()} disabled={busy} className="flex-1 h-10 font-semibold">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset password'}
            </Button>
            <Button variant="outline" onClick={() => void sendCode()} disabled={busy} className="h-10">
              Resend
            </Button>
          </div>
          <button onClick={() => setStage('idle')} className="w-full text-xs text-muted-foreground py-1">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default PasswordResetSection;
