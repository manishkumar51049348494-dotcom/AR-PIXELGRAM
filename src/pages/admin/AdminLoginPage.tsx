// Admin Login पेज — /admin-login
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LayoutDashboard, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) { toast.error('Email और Password भरें'); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) {
      toast.error('Login failed। Email/Password गलत है।');
      setLoading(false);
      return;
    }
    // Check admin status
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if (!profileRow?.is_admin) {
      await supabase.auth.signOut();
      toast.error('यह account Admin नहीं है।');
      setLoading(false);
      return;
    }
    // Refresh global auth profile then navigate
    await refreshProfile();
    toast.success('Admin Panel में स्वागत है! 🎉');
    navigate('/admin', { replace: true });
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-xl"
          style={{ background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))' }}>
          <ShieldCheck className="w-10 h-10 text-white" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-black text-foreground">AR Pixelgram</h1>
          <p className="text-sm text-muted-foreground font-medium">Admin Panel Login</p>
        </div>
      </div>

      {/* Form card */}
      <div className="w-full max-w-sm glass-card rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex items-center gap-2 border-b border-border pb-4">
          <LayoutDashboard className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-foreground">Admin Login</h2>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email / Username</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@pixelgram.app"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="h-11"
              autoComplete="username"
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
                className="h-11 pr-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPass(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-12 font-bold rounded-xl text-base mt-2"
            style={{ background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))', border: 'none', color: 'white' }}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ShieldCheck className="w-5 h-5 mr-2" />}
            Admin Login
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          केवल authorized admins के लिए। <br />
          <button onClick={() => navigate('/login')} className="text-primary hover:underline">User Login →</button>
        </p>
      </div>
    </div>
  );
};

export default AdminLoginPage;
