import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  ArrowLeft, Loader2, KeyRound, ShieldCheck, Eye, EyeOff,
  Mail, MessageCircle, BadgeCheck, User as UserIcon, ChevronRight, Lock,
} from 'lucide-react';
import {
  findAccounts, sendResetOtp, confirmPasswordReset,
  type FoundAccount, type OtpChannel,
} from '@/services/passwordReset';

type Step = 'identify' | 'accounts' | 'method' | 'verify';

/**
 * Facebook jaisa account recovery:
 * 1) email / number / username daalo
 * 2) jitne account mile — photo + naam ke saath list
 * 3) us account ke saare email aur WhatsApp number — kahan code bhejna hai chuno
 *    (ya "password se login karo" par jao)
 * 4) OTP + naya password
 */
const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('identify');
  const [identifier, setIdentifier] = useState('');
  const [accounts, setAccounts] = useState<FoundAccount[]>([]);
  const [account, setAccount] = useState<FoundAccount | null>(null);
  const [destinationId, setDestinationId] = useState('');
  const [token, setToken] = useState('');
  const [masked, setMasked] = useState('');
  const [channel, setChannel] = useState<OtpChannel>('email');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) { toast.error('Email, number ya username daalein'); return; }
    setLoading(true);
    try {
      const found = await findAccounts(identifier);
      if (found.length === 0) {
        toast.error('Is email/number/username se koi account nahi mila');
        return;
      }
      setAccounts(found);
      if (found.length === 1) {
        setAccount(found[0]);
        setStep('method');
      } else {
        setStep('accounts');
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async (destId: string, silent = false) => {
    if (!account) return;
    setLoading(true);
    try {
      const res = await sendResetOtp(account.userId, destId);
      if (!res.found || !res.token) {
        toast.error('Code nahi bheja ja saka. Dusra tarika chunein.');
        return;
      }
      setDestinationId(destId);
      setToken(res.token);
      setMasked(res.masked ?? '');
      setChannel(res.channel ?? 'email');
      setCode('');
      setStep('verify');
      toast.success(
        silent
          ? 'Naya code bhej diya'
          : res.channel === 'whatsapp' ? 'WhatsApp par code bhej diya' : 'Email par code bhej diya',
      );
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 6) { toast.error('6-digit code daalein'); return; }
    if (password.length < 6) { toast.error('Password kam se kam 6 characters ka ho'); return; }
    if (password !== confirmPassword) { toast.error('Dono password same nahi hain'); return; }
    setLoading(true);
    try {
      await confirmPasswordReset(token, code, password);
      toast.success('Password reset ho gaya ✅ Ab login karein');
      navigate('/login');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (step === 'verify') setStep('method');
    else if (step === 'method') setStep(accounts.length > 1 ? 'accounts' : 'identify');
    else if (step === 'accounts') setStep('identify');
    else navigate('/login');
  };

  const AccountRow: React.FC<{ item: FoundAccount; onClick: () => void }> = ({ item, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/60 transition-colors text-left"
    >
      {item.avatarUrl ? (
        <img src={item.avatarUrl} alt={item.fullName} className="w-12 h-12 rounded-full object-cover" />
      ) : (
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <UserIcon className="w-6 h-6 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="font-semibold text-foreground truncate">{item.fullName}</span>
          {item.isVerified && <BadgeCheck className="w-4 h-4 text-primary shrink-0" />}
        </div>
        {item.username && <p className="text-sm text-muted-foreground truncate">@{item.username}</p>}
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background">
      <div className="w-full max-w-sm space-y-6">
        <button
          onClick={goBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> {step === 'identify' ? 'Back to Login' : 'Back'}
        </button>

        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
            {step === 'verify' ? <ShieldCheck className="w-6 h-6 text-primary" /> : <KeyRound className="w-6 h-6 text-primary" />}
          </div>
          <h1 className="text-xl font-bold text-foreground">
            {step === 'identify' && 'Apna account dhoondein'}
            {step === 'accounts' && 'Ye rahe aapke accounts'}
            {step === 'method' && 'Code kahan bhejein?'}
            {step === 'verify' && 'Code daalein'}
          </h1>
          <p className="text-sm text-muted-foreground text-pretty">
            {step === 'identify' && 'Apna email, phone number ya username daalein'}
            {step === 'accounts' && 'Jis account me jaana hai use chunein'}
            {step === 'method' && 'Aapke account se jude email aur WhatsApp number'}
            {step === 'verify' && `${masked} par 6-digit code bheja gaya hai`}
          </p>
        </div>

        {step === 'identify' && (
          <form onSubmit={search} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="identifier">Email, number ya username</Label>
              <Input
                id="identifier"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="you@example.com / +91… / username"
                className="h-11"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
            </Button>
          </form>
        )}

        {step === 'accounts' && (
          <div className="space-y-2">
            {accounts.map(item => (
              <AccountRow
                key={item.userId}
                item={item}
                onClick={() => { setAccount(item); setStep('method'); }}
              />
            ))}
          </div>
        )}

        {step === 'method' && account && (
          <div className="space-y-3">
            <div className="rounded-xl border border-border p-3">
              <AccountRow item={account} onClick={() => setStep(accounts.length > 1 ? 'accounts' : 'identify')} />
            </div>

            {account.destinations.map(dest => (
              <button
                key={dest.id}
                type="button"
                disabled={loading}
                onClick={() => void sendOtp(dest.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/60 transition-colors text-left disabled:opacity-60"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  {dest.type === 'whatsapp'
                    ? <MessageCircle className="w-5 h-5 text-primary" />
                    : <Mail className="w-5 h-5 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm">
                    {dest.type === 'whatsapp' ? 'WhatsApp par code bhejein' : 'Email par code bhejein'}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">{dest.masked}</p>
                </div>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </button>
            ))}

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/60 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground text-sm">Password se login karein</p>
                <p className="text-sm text-muted-foreground">Password yaad hai to seedhe login</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        )}

        {step === 'verify' && (
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="otp">6-digit code</Label>
              <Input
                id="otp"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                inputMode="numeric"
                className="h-12 text-center text-lg tracking-[0.5em] font-semibold"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                {channel === 'whatsapp' ? 'Code WhatsApp message me aaya hai' : 'Code aapke email me aaya hai'} · 10 minute me expire
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-pass">Naya password</Label>
              <div className="relative">
                <Input
                  id="new-pass"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Kam se kam 6 characters"
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
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-pass">Password dobara</Label>
              <Input
                id="confirm-pass"
                type={showPass ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Wahi password dobara"
                className="h-11"
              />
            </div>

            <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset password'}
            </Button>

            <button
              type="button"
              onClick={() => void sendOtp(destinationId, true)}
              disabled={loading}
              className="w-full text-sm text-primary font-semibold py-1"
            >
              Code nahi aaya ya expire ho gaya? Dobara bhejein
            </button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Yaad aa gaya? <Link to="/login" className="text-primary font-semibold">Log in</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
