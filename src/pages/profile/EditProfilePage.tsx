import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '@/components/layouts/MobileLayout';
import { useAuth } from '@/contexts/AuthContext';
import { updateProfile, uploadImage, checkUsernameAvailable } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Camera, Loader2, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';

const EditProfilePage: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: '',
    username: '',
    bio: '',
    dob: '',
    is_private: false,
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        username: profile.username || '',
        bio: profile.bio || '',
        dob: profile.dob || '',
        is_private: profile.is_private,
      });
      if (profile.avatar_url) setAvatarPreview(profile.avatar_url);
    }
  }, [profile]);

  // Username uniqueness check with debounce
  useEffect(() => {
    const trimmed = form.username.trim().toLowerCase();
    if (!trimmed || trimmed === profile?.username) { setUsernameStatus('idle'); return; }
    if (!/^[a-z0-9._]{3,30}$/.test(trimmed)) { setUsernameStatus('invalid'); return; }
    setUsernameStatus('checking');
    const t = setTimeout(async () => {
      if (!user) return;
      const ok = await checkUsernameAvailable(trimmed, user.id);
      setUsernameStatus(ok ? 'available' : 'taken');
    }, 600);
    return () => clearTimeout(t);
  }, [form.username, profile?.username, user]);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Avatar must be under 2MB'); return; }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (usernameStatus === 'taken') { toast.error('यह username पहले से लिया जा चुका है'); return; }
    if (usernameStatus === 'invalid') { toast.error('Username 3-30 अक्षर, केवल a-z 0-9 . _'); return; }
    if (usernameStatus === 'checking') { toast.error('Username check हो रहा है, रुकें…'); return; }
    setLoading(true);
    try {
      let avatarUrl = profile?.avatar_url || '';
      if (avatarFile) {
        avatarUrl = await uploadImage('avatars', avatarFile, user.id);
      }
      await updateProfile(user.id, {
        ...form,
        username: form.username.trim().toLowerCase(),
        avatar_url: avatarUrl,
        dob: form.dob || null,
      } as Parameters<typeof updateProfile>[1]);
      await refreshProfile();
      toast.success('Profile update हो गया!');
      navigate('/profile');
    } catch {
      toast.error('Profile update नहीं हुआ, दोबारा कोशिश करें।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileLayout hideNav>
      <div className="p-4 page-transition">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 mb-5 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back</span>
        </button>

        <h2 className="text-xl font-bold text-foreground mb-6">Edit Profile</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="w-24 h-24 rounded-full object-cover ring-4 ring-primary/30" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-2xl">
                  {profile?.username?.[0]?.toUpperCase()}
                </div>
              )}
              <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center cursor-pointer shadow-lg hover:bg-primary/90 transition-colors">
                <Camera className="w-4 h-4 text-primary-foreground" />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">Tap to change photo (max 2MB)</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full Name</Label>
            <Input id="full_name" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Your full name" className="h-11" maxLength={50} />
          </div>

          {/* Username field with live uniqueness check */}
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">@</span>
              <Input
                id="username"
                value={form.username}
                onChange={e => setForm(p => ({ ...p, username: e.target.value.replace(/\s/g, '').toLowerCase() }))}
                placeholder="your_username"
                className="h-11 pl-7 pr-10"
                maxLength={30}
                autoCapitalize="none"
                spellCheck={false}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {usernameStatus === 'checking' && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                {usernameStatus === 'available' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                {(usernameStatus === 'taken' || usernameStatus === 'invalid') && <XCircle className="w-4 h-4 text-destructive" />}
              </div>
            </div>
            {usernameStatus === 'taken' && <p className="text-xs text-destructive">यह username पहले से लिया जा चुका है</p>}
            {usernameStatus === 'invalid' && <p className="text-xs text-destructive">3-30 अक्षर, केवल a-z, 0-9, _ और . allowed</p>}
            {usernameStatus === 'available' && <p className="text-xs text-green-500">Username available है!</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} placeholder="Tell something about yourself…" rows={3} maxLength={150} className="resize-none" />
            <p className="text-xs text-muted-foreground text-right">{form.bio.length}/150</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dob">Date of Birth</Label>
            <Input id="dob" type="date" value={form.dob} onChange={e => setForm(p => ({ ...p, dob: e.target.value }))} className="h-11" />
          </div>

          <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-card border border-border">
            <div>
              <p className="font-semibold text-sm text-foreground">Private Account</p>
              <p className="text-xs text-muted-foreground">Only approved followers can see your posts</p>
            </div>
            <Switch checked={form.is_private} onCheckedChange={v => setForm(p => ({ ...p, is_private: v }))} />
          </div>

          <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</> : 'Save Changes'}
          </Button>
        </form>
      </div>
    </MobileLayout>
  );
};

export default EditProfilePage;
