import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '@/components/layouts/MobileLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  ArrowLeft,
  AtSign,
  ChevronRight,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react';
import {
  listMyIdentifiers,
  sendIdentifierOtp,
  confirmIdentifierOtp,
  removeIdentifier,
  MAX_PER_TYPE,
  type AccountIdentifier,
  type IdentifierType,
} from '@/services/accountCenter';
import PasswordResetSection from '@/components/settings/PasswordResetSection';

type View = 'home' | 'personal' | 'contact' | 'password';

const AccountCenterPage: React.FC = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<View>('home');
  const [addingType, setAddingType] = useState<IdentifierType | null>(null);
  const [items, setItems] = useState<AccountIdentifier[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Record<IdentifierType, string>>({ email: '', phone: '' });
  const [pending, setPending] = useState<Record<IdentifierType, string | null>>({ email: null, phone: null });
  const [otp, setOtp] = useState<Record<IdentifierType, string>>({ email: '', phone: '' });
  const [busy, setBusy] = useState<IdentifierType | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await listMyIdentifiers());
    } catch (error) {
      console.error(error);
      toast.error('Details load nahi ho paayi. Internet check karein.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const emails = items.filter(item => item.type === 'email');
  const phones = items.filter(item => item.type === 'phone');

  const goBack = () => {
    if (addingType) {
      setAddingType(null);
      return;
    }
    if (view === 'contact') setView('personal');
    else if (view === 'personal' || view === 'password') setView('home');
    else navigate('/settings');
  };

  const handleSendOtp = async (type: IdentifierType) => {
    const value = draft[type].trim();
    if (!value) {
      toast.error(type === 'email' ? 'Email address daalein' : 'Mobile number daalein');
      return;
    }
    setBusy(type);
    try {
      await sendIdentifierOtp(type, value);
      setPending(current => ({ ...current, [type]: value }));
      setOtp(current => ({ ...current, [type]: '' }));
      toast.success(type === 'email' ? 'Email par code bhej diya' : 'Number par code bhej diya');
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleConfirm = async (type: IdentifierType) => {
    const value = pending[type];
    const code = otp[type].trim();
    if (!value) return;
    if (code.length < 4) {
      toast.error('Verification code daalein');
      return;
    }
    setBusy(type);
    try {
      await confirmIdentifierOtp(type, value, code);
      toast.success(type === 'email' ? 'Email add ho gaya' : 'Mobile number add ho gaya');
      setPending(current => ({ ...current, [type]: null }));
      setDraft(current => ({ ...current, [type]: '' }));
      setOtp(current => ({ ...current, [type]: '' }));
      setAddingType(null);
      await load();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async (item: AccountIdentifier) => {
    const label = item.type === 'email' ? 'email' : 'number';
    if (!window.confirm(`Kya aap ye ${label} hatana chahte hain?`)) return;
    try {
      await removeIdentifier(item.id);
      toast.success(`${item.type === 'email' ? 'Email' : 'Number'} hata diya`);
      await load();
    } catch {
      toast.error('Hataya nahi ja saka');
    }
  };

  const title = addingType
    ? addingType === 'email' ? 'Email address add karein' : 'Mobile number add karein'
    : view === 'personal' ? 'Personal details'
    : view === 'contact' ? 'Contact info'
    : view === 'password' ? 'Password and security'
    : 'Accounts Center';

  const renderAddForm = (type: IdentifierType) => {
    const full = (type === 'email' ? emails : phones).length >= MAX_PER_TYPE;
    const waiting = pending[type];

    return (
      <div className="space-y-5 px-4 pt-5">
        <div>
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">
            {type === 'email'
              ? 'Aisa email daalein jiska access aapke paas hai. Ye aapki public profile par nahi dikhega.'
              : 'Country code ke saath number daalein. Ye aapki public profile par nahi dikhega.'}
          </p>
        </div>

        {full ? (
          <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            Aap maximum {MAX_PER_TYPE} {type === 'email' ? 'email addresses' : 'mobile numbers'} add kar sakte hain.
          </p>
        ) : waiting ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor={`otp-${type}`}>Verification code</Label>
              <p className="mb-2 mt-1 text-xs text-muted-foreground">{waiting} par bheja gaya 6-digit code daalein.</p>
              <Input
                id={`otp-${type}`}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                value={otp[type]}
                onChange={event => setOtp(current => ({ ...current, [type]: event.target.value.replace(/\D/g, '') }))}
                className="h-12 text-center text-lg tracking-[0.35em]"
              />
            </div>
            <Button className="h-11 w-full font-semibold" onClick={() => handleConfirm(type)} disabled={busy === type}>
              {busy === type && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue
            </Button>
            <Button variant="ghost" className="h-10 w-full" onClick={() => handleSendOtp(type)} disabled={busy === type}>
              Code dobara bhejein
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor={`add-${type}`}>{type === 'email' ? 'Email address' : 'Mobile number'}</Label>
              <Input
                id={`add-${type}`}
                type={type === 'email' ? 'email' : 'tel'}
                autoComplete={type === 'email' ? 'email' : 'tel'}
                placeholder={type === 'email' ? 'name@example.com' : '+91 98765 43210'}
                value={draft[type]}
                onChange={event => setDraft(current => ({ ...current, [type]: event.target.value }))}
                className="mt-2 h-12"
              />
            </div>
            <Button className="h-11 w-full font-semibold" onClick={() => handleSendOtp(type)} disabled={busy === type}>
              {busy === type && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderContactInfo = () => (
    <div className="space-y-5 px-4 pt-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">Contact info</h2>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">
          Apne account par email addresses aur mobile numbers manage karein. Ye details public profile par nahi dikhengi.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {items.length === 0 ? (
            <p className="px-4 py-5 text-sm text-muted-foreground">Abhi koi contact detail add nahi hai.</p>
          ) : items.map((item, index) => {
            const Icon = item.type === 'email' ? Mail : Phone;
            return (
              <div key={item.id} className={`flex min-h-16 items-center gap-3 px-4 py-3 ${index ? 'border-t border-border' : ''}`}>
                <Icon className="h-5 w-5 shrink-0 text-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{item.value}</p>
                  <p className="text-xs text-muted-foreground">{item.is_primary ? 'Primary' : 'Verified'}</p>
                </div>
                {item.is_primary ? (
                  <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Primary contact" />
                ) : (
                  <Button variant="ghost" size="icon" onClick={() => handleRemove(item)} aria-label="Remove contact">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => setAddingType('email')}
            className="flex min-h-14 w-full items-center gap-3 border-t border-border px-4 text-left text-sm font-semibold text-primary"
          >
            <Plus className="h-5 w-5" /> Add email address
          </button>
          <button
            type="button"
            onClick={() => setAddingType('phone')}
            className="flex min-h-14 w-full items-center gap-3 border-t border-border px-4 text-left text-sm font-semibold text-primary"
          >
            <Plus className="h-5 w-5" /> Add mobile number
          </button>
        </div>
      )}
    </div>
  );

  return (
    <MobileLayout hideNav>
      <div className="min-h-screen bg-background pb-8 page-transition">
        <header className="sticky top-0 z-20 flex h-14 items-center border-b border-border bg-background/95 px-2 backdrop-blur">
          <Button variant="ghost" size="icon" onClick={goBack} aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="ml-2 text-base font-bold text-foreground">{title}</h1>
        </header>

        {addingType ? renderAddForm(addingType) : view === 'contact' ? renderContactInfo() : view === 'password' ? (
          <div className="px-4 pt-5"><PasswordResetSection /></div>
        ) : view === 'personal' ? (
          <div className="space-y-5 px-4 pt-5">
            <div>
              <h2 className="text-xl font-bold text-foreground">Personal details</h2>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">Aapki contact details aur account ownership ki information.</p>
            </div>
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <button type="button" onClick={() => setView('contact')} className="flex min-h-16 w-full items-center gap-3 px-4 text-left">
                <AtSign className="h-5 w-5 text-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Contact info</p>
                  <p className="text-xs text-muted-foreground">Email addresses and mobile numbers</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 px-4 pt-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
                <UserRound className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Accounts Center</h2>
                <p className="text-sm text-muted-foreground">Account settings ek jagah manage karein</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <button type="button" onClick={() => setView('personal')} className="flex min-h-[72px] w-full items-center gap-3 px-4 text-left">
                <UserRound className="h-5 w-5 text-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">Personal details</p>
                  <p className="text-xs text-muted-foreground">Contact info aur account ownership</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
              <button type="button" onClick={() => setView('password')} className="flex min-h-[72px] w-full items-center gap-3 border-t border-border px-4 text-left">
                <KeyRound className="h-5 w-5 text-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">Password and security</p>
                  <p className="text-xs text-muted-foreground">Apna password badlein</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <p className="px-1 text-xs leading-5 text-muted-foreground">
              Aapki email aur mobile number private hain. Ye kisi aur ko aapki profile par nahi dikhaye jayenge.
            </p>
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default AccountCenterPage;
