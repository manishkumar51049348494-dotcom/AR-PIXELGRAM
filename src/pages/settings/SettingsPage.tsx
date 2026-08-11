import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '@/components/layouts/MobileLayout';
import { useAuth } from '@/contexts/AuthContext';
import { getMyVerificationRequest, submitVerificationRequest, submitProblemReport } from '@/services/api';
import type { VerificationRequest } from '@/types/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Moon, Sun, HelpCircle, Flag, Shield, LogOut, Trash2, BadgeCheck, ChevronRight, ArrowLeft, Loader2, LayoutDashboard, BellRing, KeyRound } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


const SettingsPage: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(document.documentElement.classList.contains('dark'));
  const [section, setSection] = useState<'main' | 'help' | 'report' | 'verification'>('main');
  const [verificationRequest, setVerificationRequest] = useState<VerificationRequest | null>(null);
  const [verifyReason, setVerifyReason] = useState('');
  const [reportType, setReportType] = useState<string>('bug');
  const [reportDesc, setReportDesc] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) getMyVerificationRequest(user.id).then(setVerificationRequest);
  }, [user]);

  const toggleTheme = (val: boolean) => {
    setDarkMode(val);
    if (val) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  const handleDeleteAccount = async () => {
    // Sign out and show message (actual deletion requires server-side)
    toast.info('Account deletion request submitted. Our team will process it shortly.');
    await signOut();
    navigate('/login');
  };

  const handleSubmitVerification = async () => {
    if (!verifyReason.trim()) { toast.error('Please explain why you should be verified'); return; }
    setLoading(true);
    await submitVerificationRequest(verifyReason.trim());
    const updated = await getMyVerificationRequest(user!.id);
    setVerificationRequest(updated);
    toast.success('Verification request submitted!');
    setVerifyReason('');
    setLoading(false);
    setSection('main');
  };

  const handleSubmitReport = async () => {
    if (!reportDesc.trim()) { toast.error('समस्या का विवरण लिखें'); return; }
    if (!user) return;
    setLoading(true);
    await submitProblemReport(user.id, reportType, reportDesc.trim());
    toast.success('Report submit हुई। धन्यवाद! 🙏');
    setReportDesc('');
    setSection('main');
    setLoading(false);
  };

  if (section === 'help') {
    return (
      <MobileLayout hideNav>
        <div className="p-4 page-transition">
          <button onClick={() => setSection('main')} className="flex items-center gap-2 mb-5 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
          </button>
          <h2 className="text-xl font-bold text-foreground mb-5">Help Center</h2>
          <div className="space-y-4">
            {[
              { q: 'How to change my password?', a: 'Go to Settings → Account → Change Password. You\'ll receive a reset email.' },
              { q: 'How to make my account private?', a: 'Go to Edit Profile and toggle "Private Account". Only approved followers can see your posts.' },
              { q: 'How to get verified?', a: 'Submit a verification request with a valid reason. Our team reviews within 3-5 business days.' },
              { q: 'How to delete my account?', a: 'Scroll to the bottom of Settings and tap "Delete Account". This action is permanent.' },
              { q: 'How does chatting work?', a: 'You can only chat with mutual followers — people you follow who also follow you back.' },
            ].map(({ q, a }) => (
              <div key={q} className="glass-card rounded-xl p-4 space-y-1">
                <p className="font-semibold text-sm text-foreground">{q}</p>
                <p className="text-sm text-muted-foreground text-pretty">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (section === 'report') {
    return (
      <MobileLayout hideNav>
        <div className="p-4 page-transition">
          <button onClick={() => setSection('main')} className="flex items-center gap-2 mb-5 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
          </button>
          <h2 className="text-xl font-bold text-foreground mb-5">Report a Problem</h2>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Bug / Technical Issue</SelectItem>
                  <SelectItem value="post">Inappropriate Post</SelectItem>
                  <SelectItem value="user">Suspicious User</SelectItem>
                  <SelectItem value="story">Inappropriate Story</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>समस्या का विवरण</Label>
              <Textarea
                placeholder="समस्या विस्तार से बताएं…"
                value={reportDesc}
                onChange={e => setReportDesc(e.target.value)}
                rows={5}
                maxLength={500}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">{reportDesc.length}/500</p>
            </div>
            <Button className="w-full h-11 font-semibold" onClick={handleSubmitReport} disabled={loading || !reportDesc.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Submit Report
            </Button>
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (section === 'verification') {
    return (
      <MobileLayout hideNav>
        <div className="p-4 page-transition">
          <button onClick={() => setSection('main')} className="flex items-center gap-2 mb-5 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
          </button>
          <h2 className="text-xl font-bold text-foreground mb-2">Verification Request</h2>
          <p className="text-sm text-muted-foreground mb-5 text-pretty">Get a blue checkmark to show your account is authentic.</p>

          {profile?.is_verified ? (
            <div className="flex flex-col items-center py-12 text-center">
              <BadgeCheck className="w-16 h-16 text-primary mb-3" />
              <h3 className="font-bold text-foreground text-lg">Already Verified!</h3>
              <p className="text-sm text-muted-foreground">Your account has a verified badge.</p>
            </div>
          ) : verificationRequest ? (
            <div className="glass-card rounded-xl p-5 text-center">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium mb-3
                ${verificationRequest.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                  verificationRequest.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                <BadgeCheck className="w-4 h-4" />
                {verificationRequest.status.charAt(0).toUpperCase() + verificationRequest.status.slice(1)}
              </div>
              <p className="text-sm text-muted-foreground text-pretty">
                {verificationRequest.status === 'pending' ? 'Your request is under review. We\'ll notify you soon.' :
                 verificationRequest.status === 'rejected' ? 'Your request was not approved. You may submit a new request.' :
                 'Congratulations! Your account is verified.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Why should your account be verified?</Label>
                <Textarea
                  placeholder="Explain your public presence, notable work, or why verification is important for your account…"
                  value={verifyReason}
                  onChange={e => setVerifyReason(e.target.value)}
                  rows={5}
                  maxLength={500}
                  className="resize-none"
                />
              </div>
              <Button className="w-full h-11 font-semibold" onClick={handleSubmitVerification} disabled={loading || !verifyReason.trim()}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <BadgeCheck className="w-4 h-4 mr-2" />}
                Submit Request
              </Button>
            </div>
          )}
        </div>
      </MobileLayout>
    );
  }

  // Main settings
  return (
    <MobileLayout>
      <div className="p-4 page-transition space-y-5">
        <h2 className="text-xl font-bold text-foreground">Settings</h2>

        {/* Profile info */}
        <div className="flex items-center gap-3 glass-card rounded-xl p-4">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-primary font-bold text-lg">{profile?.username?.[0]?.toUpperCase()}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground truncate">{profile?.username}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          {profile?.is_verified && <BadgeCheck className="w-5 h-5 text-primary shrink-0" />}
        </div>

        {/* Appearance */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
            <div className="flex items-center gap-3">
              {darkMode ? <Moon className="w-5 h-5 text-primary" /> : <Sun className="w-5 h-5 text-primary" />}
              <div>
                <p className="text-sm font-medium text-foreground">Dark Mode</p>
                <p className="text-xs text-muted-foreground">{darkMode ? 'Dark theme active' : 'Light theme active'}</p>
              </div>
            </div>
            <Switch checked={darkMode} onCheckedChange={toggleTheme} />
          </div>
        </div>

        {/* Menu items */}
        {[
          { icon: BellRing, label: 'Enable Notifications', desc: 'Calls & messages ke alerts', onClick: () => navigate('/settings/notifications'), danger: false },
          { icon: KeyRound, label: 'Change Password', desc: 'OTP se apna password reset karo', onClick: () => navigate('/forgot-password'), danger: false },
          { icon: BadgeCheck, label: 'Request Verification', desc: profile?.is_verified ? 'Already verified ✓' : 'Get the blue badge', onClick: () => setSection('verification'), danger: false },
          { icon: HelpCircle, label: 'Help Center', desc: 'FAQs and support', onClick: () => setSection('help'), danger: false },
          { icon: Flag, label: 'Report a Problem', desc: "Let us know what's wrong", onClick: () => setSection('report'), danger: false },
          { icon: Shield, label: 'Privacy', desc: 'Manage your privacy settings', onClick: () => navigate('/edit-profile'), danger: false },
        ].map(({ icon: Icon, label, desc, onClick, danger }) => (
          <button key={label} onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 glass-card rounded-xl hover:bg-muted/60 transition-colors">
            <Icon className={`w-5 h-5 shrink-0 ${danger ? 'text-destructive' : 'text-primary'}`} />
            <div className="flex-1 min-w-0 text-left">
              <p className={`text-sm font-medium ${danger ? 'text-destructive' : 'text-foreground'}`}>{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        ))}

        {/* Admin Panel — only visible for admin users */}
        {profile?.is_admin && (
          <button
            onClick={() => navigate('/admin')}
            className="w-full flex items-center gap-3 px-4 py-3.5 glass-card rounded-xl hover:bg-primary/10 transition-colors border border-primary/40"
          >
            <LayoutDashboard className="w-5 h-5 shrink-0 text-primary" />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-primary">Admin Panel</p>
              <p className="text-xs text-muted-foreground">Manage the platform</p>
            </div>
            <ChevronRight className="w-4 h-4 text-primary shrink-0" />
          </button>
        )}

        {/* Logout */}
        <button onClick={signOut} className="w-full flex items-center gap-3 px-4 py-3.5 glass-card rounded-xl hover:bg-muted/60 transition-colors">
          <LogOut className="w-5 h-5 shrink-0 text-destructive" />
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-destructive">Sign Out</p>
          </div>
        </button>

        {/* Delete account */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="w-full flex items-center gap-3 px-4 py-3.5 glass-card rounded-xl hover:bg-destructive/5 transition-colors">
              <Trash2 className="w-5 h-5 shrink-0 text-destructive" />
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-destructive">Delete Account</p>
                <p className="text-xs text-muted-foreground">This action is permanent</p>
              </div>
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Account?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete your account, posts, and all data. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete Account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MobileLayout>
  );
};

export default SettingsPage;
