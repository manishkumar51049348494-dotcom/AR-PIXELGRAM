import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, UserPlus } from 'lucide-react';

const RegisterPage: React.FC = () => {
  const [form, setForm] = useState({ email: '', username: '', fullName: '', password: '', confirmPassword: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.username || !form.password) { toast.error('Please fill all required fields'); return; }
    if (form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(form.username)) { toast.error('Username must be 3-20 characters (letters, numbers, underscore only)'); return; }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          username: form.username.toLowerCase(),
          full_name: form.fullName,
        }
      }
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Account created! You are now logged in.');
    navigate('/home');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm glass-card rounded-2xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold gradient-text">AR Pixelgram</h1>
          <p className="text-sm text-muted-foreground">Create your account</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" type="email" placeholder="you@example.com" value={form.email} onChange={handleChange('email')} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="username">Username *</Label>
            <Input id="username" type="text" placeholder="your_username" value={form.username} onChange={handleChange('username')} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" type="text" placeholder="Your Full Name" value={form.fullName} onChange={handleChange('fullName')} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password *</Label>
            <div className="relative">
              <Input id="password" type={showPass ? 'text' : 'password'} placeholder="Min 6 characters" value={form.password} onChange={handleChange('password')} className="h-11 pr-10" />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm Password *</Label>
            <Input id="confirmPassword" type="password" placeholder="Repeat your password" value={form.confirmPassword} onChange={handleChange('confirmPassword')} className="h-11" />
          </div>
          <Button type="submit" className="w-full h-11 font-semibold mt-2" disabled={loading}>
            <UserPlus className="w-4 h-4 mr-2" />
            {loading ? 'Creating account…' : 'Create Account'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-medium hover:underline">Sign In</Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
