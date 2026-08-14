import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, KeyRound, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { startPasswordReset, confirmPasswordReset } from '@/services/passwordReset';

/**
 * Facebook jaisa password reset — koi email link nahi.
 * Step 1: username/email/number daalo → account ke email par 6-digit OTP.
 * Step 2: OTP + naya password → password turant reset.
 */
const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'identify' | 'verify'>('identify');
  const [identifier, setIdentifier] = useState('');
  const [token, setToken] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const sendOtp = async (silent = false) => {
    if (!identifier.trim()) { toast.error('Username, email ya number daalein'); return; }
    setLoading(true);
    try {
      const res = await startPasswordReset(identifier);
      if (!res.found || !res.token) {
        toast.error('Ye account nahi mila. Username/email check karein.');
        return;
      }
      setToken(res.token);
      setMaskedEmail(res.masked ?? '');
      setStep('verify');
      setCode('');
      toast.success(silent ? 'Naya code bhej diya' : 'OTP bhej diya gaya');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 6) { toast.error('6-digit OTP daalein'); return; }
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background">
      <div className="w-full max-w-sm space-y-6">
        <button
          onClick={() => (step === 'verify' ? setStep('identify') : navigate('/login'))}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> {step === 'verify' ? 'Back' : 'Back to Login'}
        </button>

        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
            {step === 'verify' ? <ShieldCheck className="w-6 h-6 text-primary" /> : <KeyRound className="w-6 h-6 text-primary" />}
          </div>
          <h1 className="text-xl font-bold text-foreground">Password reset</h1>
          <p className="text-sm text-muted-foreground">
            {step === 'verify'
              ? `${maskedEmail} par 6-digit code bheja gaya hai`
              : 'Apna username, email ya number daalein — hum code bhej denge'}
          </p>
        </div>

        {step === 'identify' ? (
          <form
            onSubmit={(e) => { e.preventDefault(); void sendOtp(); }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="identifier">Username, email ya number</Label>
              <Input
                id="identifier"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="username / you@example.com"
                className="h-11"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send code'}
            </Button>
          </form>
        ) : (
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
              onClick={() => void sendOtp(true)}
              disabled={loading}
              className="w-full text-sm text-primary font-semibold py-1"
            >
              Code nahi aaya? Dobara bhejein
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
