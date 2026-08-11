import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '@/components/layouts/MobileLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Mail, Phone, Loader2, Plus, Trash2, ShieldCheck } from 'lucide-react';
import {
  listMyIdentifiers,
  sendIdentifierOtp,
  confirmIdentifierOtp,
  removeIdentifier,
  MAX_PER_TYPE,
  type AccountIdentifier,
  type IdentifierType,
} from '@/services/accountCenter';

/**
 * Account Center — Facebook jaisa: ek hi account me kai email aur phone number
 * add kiye ja sakte hain (max 5 + 5). Har naya email/number pehle OTP se verify
 * hota hai, uske baad usi password ke saath us email/number se login bhi ho jata hai.
 */
const AccountCenterPage: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<AccountIdentifier[]>([]);
  const [loading, setLoading] = useState(true);

  // Add flow state (email aur phone ke liye alag-alag).
  const [draft, setDraft] = useState<Record<IdentifierType, string>>({ email: '', phone: '' });
  const [pending, setPending] = useState<Record<IdentifierType, string | null>>({ email: null, phone: null });
  const [otp, setOtp] = useState<Record<IdentifierType, string>>({ email: '', phone: '' });
  const [busy, setBusy] = useState<IdentifierType | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await listMyIdentifiers());
    } catch (e) {
      console.error(e);
      toast.error('List load nahi ho paayi. Internet check karein.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const emails = items.filter(i => i.type === 'email');
  const phones = items.filter(i => i.type === 'phone');

  const handleSendOtp = async (type: IdentifierType) => {
    const value = draft[type].trim();
    if (!value) { toast.error(type === 'email' ? 'Email daalein' : 'Number daalein'); return; }
    setBusy(type);
    try {
      await sendIdentifierOtp(type, value);
      setPending(p => ({ ...p, [type]: value }));
      setOtp(o => ({ ...o, [type]: '' }));
      toast.success(type === 'email' ? 'OTP email par bhej diya' : 'OTP number par bhej diya');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleConfirm = async (type: IdentifierType) => {
    const value = pending[type];
    const code = otp[type].trim();
    if (!value) return;
    if (code.length < 4) { toast.error('OTP daalein'); return; }
    setBusy(type);
    try {
      await confirmIdentifierOtp(type, value, code);
      toast.success(type === 'email' ? 'Email add ho gaya ✅' : 'Number add ho gaya ✅');
      setPending(p => ({ ...p, [type]: null }));
      setDraft(d => ({ ...d, [type]: '' }));
      setOtp(o => ({ ...o, [type]: '' }));
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async (item: AccountIdentifier) => {
    try {
      await removeIdentifier(item.id);
      toast.success('Hata diya');
      await load();
    } catch {
      toast.error('Hataya nahi ja saka');
    }
  };

  const renderSection = (type: IdentifierType) => {
    const list = type === 'email' ? emails : phones;
    const Icon = type === 'email' ? Mail : Phone;
    const full = list.length >= MAX_PER_TYPE;
    const waiting = pending[type];

    return (
      <div className="glass-card rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary" />
          <p className="font-semibold text-foreground">
            {type === 'email' ? 'Email addresses' : 'Phone numbers'}
          </p>
          <span className="ml-auto text-xs text-muted-foreground">{list.length}/{MAX_PER_TYPE}</span>
        </div>

        <div className="space-y-2">
          {list.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {type === 'email' ? 'Koi email add nahi hai.' : 'Koi number add nahi hai.'}
            </p>
          )}
          {list.map(item => (
            <div key={item.id} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
              <ShieldCheck className="w-4 h-4 text-green-500 shrink-0" />
              <span className="text-sm text-foreground truncate flex-1">{item.value}</span>
              {item.is_primary ? (
                <span className="text-[10px] uppercase tracking-wide text-primary font-semibold shrink-0">Primary</span>
              ) : (
                <button onClick={() => handleRemove(item)} className="text-destructive shrink-0" aria-label="Remove">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {full ? (
          <p className="text-xs text-muted-foreground">
            Limit poori — ek account me max {MAX_PER_TYPE} {type === 'email' ? 'email' : 'number'} add ho sakte hain.
          </p>
        ) : waiting ? (
          <div className="space-y-2">
            <Label>{waiting} par bheja gaya OTP daalein</Label>
            <Input
              inputMode="numeric"
              placeholder="6-digit OTP"
              maxLength={6}
              value={otp[type]}
              onChange={e => setOtp(o => ({ ...o, [type]: e.target.value.replace(/\D/g, '') }))}
              className="h-11 tracking-[0.4em] text-center"
            />
            <div className="flex gap-2">
              <Button className="flex-1 h-11 font-semibold" onClick={() => handleConfirm(type)} disabled={busy === type}>
                {busy === type ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Confirm & Add
              </Button>
              <Button variant="outline" className="h-11" onClick={() => handleSendOtp(type)} disabled={busy === type}>
                Resend
              </Button>
            </div>
            <button
              className="text-xs text-muted-foreground underline"
              onClick={() => setPending(p => ({ ...p, [type]: null }))}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor={`add-${type}`}>
              {type === 'email' ? 'Naya email add karein' : 'Naya number add karein (kisi bhi desh ka)'}
            </Label>
            <div className="flex gap-2">
              <Input
                id={`add-${type}`}
                type={type === 'email' ? 'email' : 'tel'}
                placeholder={type === 'email' ? 'you@example.com' : '+91 98765 43210'}
                value={draft[type]}
                onChange={e => setDraft(d => ({ ...d, [type]: e.target.value }))}
                className="h-11"
              />
              <Button className="h-11 shrink-0" onClick={() => handleSendOtp(type)} disabled={busy === type}>
                {busy === type ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span className="ml-1">OTP</span>
              </Button>
            </div>
            {type === 'phone' && (
              <p className="text-xs text-muted-foreground">Country code zaroori hai, jaise +91, +1, +971.</p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <MobileLayout hideNav>
      <div className="p-4 page-transition space-y-4">
        <button onClick={() => navigate('/settings')} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
        </button>
        <div>
          <h2 className="text-xl font-bold text-foreground">Account Center</h2>
          <p className="text-sm text-muted-foreground text-pretty">
            Apne account me email aur phone number add karein. Verify hone ke baad
            unme se kisi se bhi, wahi password daal kar login kar sakte hain.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <>
            {renderSection('email')}
            {renderSection('phone')}
          </>
        )}
      </div>
    </MobileLayout>
  );
};

export default AccountCenterPage;
