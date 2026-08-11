import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { getProfile } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, LogIn } from 'lucide-react';

const LoginPage: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) { toast.error('Please fill all fields'); return; }
    setLoading(true);

    const looksLikeEmail = identifier.includes('@');
    let data: Awaited<ReturnType<typeof supabase.auth.getUser>>['data'] | null = null;
    let loginError: string | null = null;

    if (looksLikeEmail) {
      // Already an email — sign in directly, same as before.
      const res = await supabase.auth.signInWithPassword({ email: identifier.trim(), password });
      if (res.error) loginError = res.error.message;
      else data = { user: res.data.user };
    } else {
      // Username — resolve to the account's email server-side and sign in.
      try {
        const { data: fnData, error: fnError } = await supabase.functions.invoke('login-with-identifier', {
          body: { identifier: identifier.trim(), password },
        });
        if (fnError || fnData?.error) {
          loginError = fnData?.error || 'Invalid login credentials';
        } else if (fnData?.access_token && fnData?.refresh_token) {
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: fnData.access_token,
            refresh_token: fnData.refresh_token,
          });
          if (sessionError) loginError = sessionError.message;
          else data = { user: sessionData.user };
        } else {
          loginError = 'Invalid login credentials';
        }
      } catch {
        loginError = 'Username se login abhi available nahi hai, email se try karo';
      }
    }

    if (loginError) {
      setLoading(false);
      if (loginError.toLowerCase().includes('invalid')) {
        toast.error('Wrong username/email or password. If you don\'t have an account, please Sign Up first.');
      } else {
        toast.error(loginError);
      }
      return;
    }

    if (data?.user) {
      const profile = await getProfile(data.user.id);

      // Account deleted or permanently disabled — sign out and redirect
      if (!profile || profile.account_status === 'permanently_disabled') {
        await supabase.auth.signOut();
        setLoading(false);
        navigate('/account-deleted');
        return;
      }

      setLoading(false);
      toast.success('Login successful!');
      if (profile?.is_admin) {
        navigate('/admin');
      } else {
        navigate('/home');
      }
    } else {
      setLoading(false);
      navigate('/home');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm glass-card rounded-2xl p-8 space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold gradient-text">AR Pixelgram</h1>
          <p className="text-sm text-muted-foreground">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="identifier">Username or Email</Label>
            <Input
              id="identifier"
              type="text"
              placeholder="username or you@example.com"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              autoComplete="username"
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                className="h-11 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="text-right">
              <Link to="/forgot-password" className="text-xs text-primary font-medium hover:underline">Forgot Password?</Link>
            </div>
          </div>
          <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
            <LogIn className="w-4 h-4 mr-2" />
            {loading ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-primary font-medium hover:underline">Sign Up</Link>
        </p>

        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-primary">New here?</span> First{' '}
            <Link to="/register" className="text-primary font-semibold underline">Sign Up</Link>
            {' '}to create your account, then log in.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
