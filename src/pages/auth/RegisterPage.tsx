import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { uploadImage, updateProfile } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import AvatarCropper from '@/components/common/AvatarCropper';
import {
  ArrowLeft, Loader2, Eye, EyeOff, Camera, Mail, Phone, Check, User as UserIcon,
} from 'lucide-react';

type Step = 'name' | 'username' | 'dob' | 'contact' | 'password' | 'photo' | 'terms' | 'code' | 'welcome';

const BASE_STEPS: Step[] = ['name', 'username', 'dob', 'contact', 'password', 'photo', 'terms'];

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('name');
  const [loading, setLoading] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [dob, setDob] = useState('');
  const [contactType, setContactType] = useState<'email' | 'phone' | null>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+91');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [rawPhoto, setRawPhoto] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [resending, setResending] = useState(false);

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
  // Mobile number wale signup me terms ke baad SMS code verify hota hai.
  const STEPS: Step[] = contactType === 'phone' ? [...BASE_STEPS, 'code'] : BASE_STEPS;
  const stepIndex = STEPS.indexOf(step);

  const goBack = () => {
    if (step === 'welcome') return;
    if (stepIndex <= 0) { navigate('/login'); return; }
    setStep(STEPS[stepIndex - 1]);
  };

  const next = () => setStep(STEPS[Math.min(stepIndex + 1, STEPS.length - 1)]);

  // ---- step validations -------------------------------------------------
  const submitName = () => {
    if (!firstName.trim() || !lastName.trim()) { toast.error('First name aur last name dono daalein'); return; }
    next();
  };

  const submitUsername = async () => {
    const value = username.toLowerCase().trim();
    if (!/^[a-z0-9_.]{3,20}$/.test(value)) {
      toast.error('Username 3-20 characters ka ho (letters, numbers, _ aur . allowed)');
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase.from('profiles').select('user_id').eq('username', value).maybeSingle();
      if (data) { toast.error('Ye username pehle se le liya gaya hai'); return; }
      setUsername(value);
      next();
    } finally {
      setLoading(false);
    }
  };

  const submitDob = () => {
    if (!dob) { toast.error('Apni date of birth select karein'); return; }
    const age = (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(age) || age < 0) { toast.error('Sahi date of birth select karein'); return; }
    if (age < 13) { toast.error('Account banane ke liye kam se kam 13 saal ki umar zaroori hai'); return; }
    next();
  };

  const submitContact = () => {
    if (contactType === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) { toast.error('Sahi email address daalein'); return; }
    } else if (contactType === 'phone') {
      const value = phone.replace(/[^\d+]/g, '');
      if (!value.startsWith('+')) { toast.error('Country code ke saath number daalein, jaise +91…'); return; }
      if (!/^\+[1-9]\d{7,14}$/.test(value)) { toast.error('Country code ke saath poora mobile number daalein'); return; }
      setPhone(value);
    } else {
      toast.error('Email ya mobile number me se ek chunein');
      return;
    }
    next();
  };

  const submitPassword = () => {
    if (password.length < 6) { toast.error('Password kam se kam 6 characters ka ho'); return; }
    if (password !== confirmPassword) { toast.error('Dono password same nahi hain'); return; }
    next();
  };

  const handlePickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Sirf image file select karein'); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error('Photo 8MB se chhoti honi chahiye'); return; }
    setRawPhoto(file);
  };

  // ---- account creation --------------------------------------------------
  const e164Phone = (() => {
    const digits = phone.replace(/[^\d+]/g, '');
    return digits.startsWith('+') ? digits : `+${digits}`;
  })();

  const finishProfile = async (userId: string) => {
    let avatarUrl: string | undefined;
    if (photoFile) {
      try {
        avatarUrl = await uploadImage('avatars', photoFile, userId);
      } catch {
        toast.error('Photo upload nahi ho paayi — baad me Edit Profile se laga sakte hain');
      }
    }
    try {
      await updateProfile(userId, {
        full_name: fullName,
        dob: dob || null,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      });
    } catch {
      /* profile trigger thoda late ho sakta hai — login ke baad bhi set ho jayega */
    }
  };

  // Number wale signup me SMS par 6-digit code bhejte hain.
  const sendPhoneOtp = async (isResend = false) => {
    const { data, error } = await supabase.functions.invoke('signup-phone-start', {
      body: { phone: e164Phone },
    });
    if (error || data?.error) {
      toast.error(data?.error || 'Code bhejne me dikkat aayi. Dobara try karein.');
      return false;
    }
    toast.success(isResend ? 'Naya code bhej diya gaya' : `Code bhej diya gaya ${e164Phone} par`);
    return true;
  };

  const resendPhoneOtp = async () => {
    setResending(true);
    try { await sendPhoneOtp(true); } finally { setResending(false); }
  };

  const verifyPhoneAndCreate = async () => {
    if (!/^\d{6}$/.test(otp.trim())) { toast.error('SMS me aaya 6-digit code daalein'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('signup-phone-confirm', {
        body: {
          phone: e164Phone,
          code: otp.trim(),
          password,
          username,
          full_name: fullName,
        },
      });
      if (error || data?.error || !data?.ok) {
        toast.error(data?.error || 'Code verify nahi hua. Dobara try karein.');
        return;
      }
      if (data.access_token && data.refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        if (!sessionError) {
          if (data.user_id) await finishProfile(data.user_id);
          setStep('welcome');
          setTimeout(() => navigate('/home'), 2000);
          return;
        }
      }
      toast.success('Account ban gaya! Ab apne number se log in karein.');
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const createAccount = async () => {
    setLoading(true);
    try {
      // Number wala signup: pehle SMS code, phir account.
      if (contactType === 'phone') {
        const sent = await sendPhoneOtp();
        if (sent) { setOtp(''); setStep('code'); }
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { username, full_name: fullName } },
      });
      if (error) { toast.error(error.message); return; }

      const userId = data.user?.id;
      if (!data.session) {
        toast.success('Account ban gaya! Email me confirmation link check karein.');
        navigate('/login');
        return;
      }

      if (userId) await finishProfile(userId);

      setStep('welcome');
      setTimeout(() => navigate('/home'), 2000);
    } finally {
      setLoading(false);
    }
  };

  // ---- welcome screen ----------------------------------------------------
  if (step === 'welcome') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <div className="space-y-5 page-transition">
          {photoPreview ? (
            <img src={photoPreview} alt={fullName} className="w-28 h-28 rounded-full object-cover mx-auto ring-4 ring-primary/30" />
          ) : (
            <div className="w-28 h-28 rounded-full bg-primary/20 flex items-center justify-center mx-auto text-primary text-3xl font-bold">
              {(firstName[0] || username[0] || '?').toUpperCase()}
            </div>
          )}
          <div className="space-y-1">
            <h1 className="text-2xl font-bold gradient-text">Welcome to AR Pixelgram</h1>
            <p className="text-lg font-semibold text-foreground">{fullName}</p>
            <p className="text-sm text-muted-foreground">@{username}</p>
          </div>
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header + progress */}
      <div className="p-4 space-y-3">
        <button onClick={goBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>

      <div className="flex-1 px-6 pb-10 flex flex-col justify-center">
        <div className="w-full max-w-sm mx-auto space-y-6">
          {step === 'name' && (
            <form onSubmit={e => { e.preventDefault(); submitName(); }} className="space-y-5">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold text-foreground">What's your name?</h1>
                <p className="text-sm text-muted-foreground">Apna asli naam daalein taki log aapko pehchaan saken.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="First name" value={firstName} onChange={e => setFirstName(e.target.value)} className="h-12" autoFocus maxLength={30} />
                <Input placeholder="Last name" value={lastName} onChange={e => setLastName(e.target.value)} className="h-12" maxLength={30} />
              </div>
              <Button type="submit" className="w-full h-12 font-semibold">Continue</Button>
            </form>
          )}

          {step === 'username' && (
            <form onSubmit={e => { e.preventDefault(); void submitUsername(); }} className="space-y-5">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold text-foreground">Choose a username</h1>
                <p className="text-sm text-muted-foreground">Ye aapke profile ka unique naam hoga.</p>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">@</span>
                <Input
                  value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                  placeholder="your_username"
                  className="h-12 pl-8"
                  autoFocus
                  maxLength={20}
                />
              </div>
              <Button type="submit" className="w-full h-12 font-semibold" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'}
              </Button>
            </form>
          )}

          {step === 'dob' && (
            <form onSubmit={e => { e.preventDefault(); submitDob(); }} className="space-y-5">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold text-foreground">Select date of birth</h1>
                <p className="text-sm text-muted-foreground">Ye sirf aapke account ke liye hai, profile par sabko nahi dikhta.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dob">Date of birth</Label>
                <Input id="dob" type="date" value={dob} max={new Date().toISOString().slice(0, 10)} onChange={e => setDob(e.target.value)} className="h-12" />
              </div>
              <Button type="submit" className="w-full h-12 font-semibold">Continue</Button>
            </form>
          )}

          {step === 'contact' && (
            <form onSubmit={e => { e.preventDefault(); submitContact(); }} className="space-y-5">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold text-foreground">Enter email or phone number</h1>
                <p className="text-sm text-muted-foreground">Isi se aap apna account recover kar payenge.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setContactType('email')}
                  className={`h-12 rounded-xl border flex items-center justify-center gap-2 text-sm font-medium transition-colors ${contactType === 'email' ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground'}`}
                >
                  <Mail className="w-4 h-4" /> Email
                </button>
                <button
                  type="button"
                  onClick={() => setContactType('phone')}
                  className={`h-12 rounded-xl border flex items-center justify-center gap-2 text-sm font-medium transition-colors ${contactType === 'phone' ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground'}`}
                >
                  <Phone className="w-4 h-4" /> Mobile number
                </button>
              </div>

              {contactType === 'email' && (
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email address</Label>
                  <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="h-12" autoFocus />
                </div>
              )}

              {contactType === 'phone' && (
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Mobile number (country code ke saath)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/[^\d+]/g, ''))}
                    placeholder="+919876543210"
                    className="h-12"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">Country code zaroori hai — jaise India ke liye +91.</p>
                </div>
              )}

              <Button type="submit" className="w-full h-12 font-semibold" disabled={!contactType}>Continue</Button>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={e => { e.preventDefault(); submitPassword(); }} className="space-y-5">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold text-foreground">Create a password</h1>
                <p className="text-sm text-muted-foreground">Kam se kam 6 characters ka password rakhein.</p>
              </div>
              <div className="relative">
                <Input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  className="h-12 pr-10"
                  autoFocus
                />
                <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Input
                type={showPass ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Password dobara"
                className="h-12"
              />
              <Button type="submit" className="w-full h-12 font-semibold">Continue</Button>
            </form>
          )}

          {step === 'photo' && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold text-foreground">Select profile photo</h1>
                <p className="text-sm text-muted-foreground">Photo lagane se log aapko aasani se pehchante hain.</p>
              </div>

              {rawPhoto ? (
                <AvatarCropper
                  file={rawPhoto}
                  onCancel={() => setRawPhoto(null)}
                  onDone={(file, preview) => { setPhotoFile(file); setPhotoPreview(preview); setRawPhoto(null); }}
                />
              ) : (
                <>
                  <div className="flex justify-center">
                    <div className="relative">
                      {photoPreview ? (
                        <img src={photoPreview} alt="Profile" className="w-32 h-32 rounded-full object-cover ring-4 ring-primary/30" />
                      ) : (
                        <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center">
                          <UserIcon className="w-16 h-16 text-muted-foreground" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        aria-label="Select photo"
                        className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg"
                      >
                        <Camera className="w-5 h-5 text-primary-foreground" />
                      </button>
                      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePickPhoto} />
                    </div>
                  </div>
                  <Button type="button" className="w-full h-12 font-semibold" onClick={next}>Continue</Button>
                  <button type="button" onClick={next} className="w-full text-sm text-muted-foreground py-1">Skip for now</button>
                </>
              )}
            </div>
          )}

          {step === 'terms' && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold text-foreground">Terms &amp; Policies</h1>
                <p className="text-sm text-muted-foreground">Account banane se pehle inhe padh lein.</p>
              </div>
              <div className="glass-card rounded-xl p-4 max-h-72 overflow-y-auto text-sm text-muted-foreground space-y-3">
                <p><strong className="text-foreground">1. Aapka account</strong> — Aap sahi jankari denge aur apna password kisi ke saath share nahi karenge. Ek vyakti ek hi asli account rakhega.</p>
                <p><strong className="text-foreground">2. Content</strong> — Aap sirf wahi photo, video ya text post karenge jiska aapko haq hai. Hinsa, nafrat, spam, nudity ya kisi ki nakal karna mana hai.</p>
                <p><strong className="text-foreground">3. Doosron ka samman</strong> — Kisi ko harass karna, dhamki dena ya uski private jankari share karna prohibited hai.</p>
                <p><strong className="text-foreground">4. Data &amp; privacy</strong> — Aapka naam, username, date of birth, email/number aur photo account chalane ke liye store hote hain. Aap kabhi bhi Settings se data delete kar sakte hain.</p>
                <p><strong className="text-foreground">5. Verification</strong> — Blue badge sirf request review ke baad milta hai. Galat jankari dene par badge hata liya jayega.</p>
                <p><strong className="text-foreground">6. Enforcement</strong> — Rules todne par account suspend ya permanently disable ho sakta hai. Aap appeal kar sakte hain.</p>
                <p>“I Agree” dabane ka matlab hai ki aap AR Pixelgram ki Terms of Service, Privacy Policy aur Cookies Policy se sehmat hain.</p>
              </div>
              <Button type="button" className="w-full h-12 font-semibold" onClick={() => void createAccount()} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-2" /> I Agree</>}
              </Button>
            </div>
          )}

          {step === 'code' && (
            <form onSubmit={e => { e.preventDefault(); void verifyPhoneAndCreate(); }} className="space-y-5">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold text-foreground">Enter the code</h1>
                <p className="text-sm text-muted-foreground">
                  Humne <span className="text-foreground font-medium">{e164Phone}</span> par 6-digit code SMS kiya hai.
                </p>
              </div>
              <Input
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={6}
                className="h-14 text-center text-2xl tracking-[0.5em] font-semibold"
                autoFocus
              />
              <Button type="submit" className="w-full h-12 font-semibold" disabled={loading || otp.length !== 6}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & create account'}
              </Button>
              <button
                type="button"
                onClick={() => void resendPhoneOtp()}
                disabled={resending || loading}
                className="w-full text-sm text-primary font-medium py-1 disabled:opacity-50"
              >
                {resending ? 'Bhej rahe hain…' : 'Code dobara bhejein'}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-muted-foreground">
            Already have an account? <Link to="/login" className="text-primary font-semibold">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
