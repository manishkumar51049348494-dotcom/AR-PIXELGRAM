import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, KeyRound, MailCheck } from 'lucide-react';

const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) { toast.error('Username ya email daalo'); return; }
    setLoading(true);
    try {
      // Resolve username → the account's real email (server-side; we never
      // ask the user to type their email separately).
      let email = identifier.trim();
      let masked = email;
      if (!email.includes('@')) {
        const { data, error } = await supabase.functions.invoke('resolve-account-email', {
          body: { identifier: email },
        });
        if (error || !data?.found) {
          toast.error('Ye account nahi mila. Username/email check karo.');
          return;
        }
        email = data.email;
        masked = data.masked;
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) { toast.error(resetError.message); return; }

      setMaskedEmail(masked);
      setSent(true);
      toast.success('Reset link bhej diya gaya');
    } catch {
      toast.error('Kuch gadbad hui, dobara try karo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background">
      <div className="w-full max-w-sm space-y-6">
        <button onClick={() => navigate('/login')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Login
        </button>

        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
            {sent ? <MailCheck className="w-6 h-6 text-primary" /> : <KeyRound className="w-6 h-6 text-primary" />}
          </div>
          <h1 className="text-xl font-bold text-foreground">Forgot Password</h1>
          <p className="text-sm text-muted-foreground">
            {sent ? `${maskedEmail} pe ek reset link bheja gaya hai` : 'Apna username ya email daalo, hum reset link bhej denge'}
          </p>
        </div>

        {!sent ? (
          <form onSubmit={handleSendLink} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="identifier">Username or Email</Label>
              <Input
                id="identifier"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="username or you@example.com"
                className="h-11"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Reset Link'}
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
              Apna email check karo aur us link pe tap karo — wahan se naya password set kar paoge. Email na dikhe to spam/junk folder bhi check kar lena.
            </div>
            <Button onClick={handleSendLink} variant="outline" className="w-full h-11 font-semibold" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Resend Link'}
            </Button>
          </div>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Remembered it? <Link to="/login" className="text-primary font-semibold">Log in</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
