import React, { useCallback, useEffect, useState } from 'react';
import MobileLayout from '@/components/layouts/MobileLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ArrowLeft, Bell, BellOff, BellRing, CheckCircle2, XCircle, Loader2, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ensurePushSubscription } from '@/hooks/usePushSubscription';

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

type Perm = 'default' | 'granted' | 'denied' | 'unsupported';

const NotificationSettingsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [perm, setPerm] = useState<Perm>('default');
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const secureContext = typeof window !== 'undefined' && window.isSecureContext;
  const supported =
    typeof window !== 'undefined' &&
    secureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  const refresh = useCallback(async () => {
    if (!supported) { setPerm('unsupported'); setSubscribed(false); return; }
    setPerm(Notification.permission as Perm);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      setSubscribed(!!sub);
      if (sub && user) {
        const { count } = await supabase
          .from('push_subscriptions')
          .select('endpoint', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('endpoint', sub.endpoint);
        setSaved((count ?? 0) > 0);
      } else {
        setSaved(false);
      }
    } catch {
      setSubscribed(false);
    }
  }, [supported, user]);

  useEffect(() => { refresh(); }, [refresh]);

  const enable = async () => {
    if (!supported) { toast.error('Is browser me push support nahi hai'); return; }
    if (!VAPID_PUBLIC) { toast.error('Push key missing'); return; }
    if (!user) return;
    setBusy(true);
    try {
      // Step 1: browser permission (same OS prompt as "Site settings → Notifications → Allow")
      const p = await Notification.requestPermission();
      setPerm(p as Perm);
      if (p !== 'granted') {
        toast.error(p === 'denied'
          ? 'Notifications block hai — phone/browser Settings → App info → Notifications me jaake Allow karo, phir yahan wapas aao'
          : 'Notification permission allow karo');
        return;
      }

      // Step 2: register the service worker + subscribe this device (auto
      // recovers from a stale/mismatched subscription instead of failing)
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      let sub: PushSubscription;
      try {
        sub = await ensurePushSubscription(reg, VAPID_PUBLIC);
      } catch (e) {
        console.warn('device subscribe failed', e);
        toast.error('Is device ko subscribe nahi kar paye, dobara try karo');
        return;
      }
      const json = sub.toJSON();
      const p256dh = json.keys?.p256dh;
      const auth = json.keys?.auth;
      if (!json.endpoint || !p256dh || !auth) {
        toast.error('Device subscription invalid nikla, dobara try karo');
        return;
      }

      // Step 3: save the subscription on the server
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: json.endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent,
      }, { onConflict: 'user_id,endpoint' });
      if (error) {
        console.warn('save on server failed', error);
        toast.error('Server par save nahi ho paya, dobara try karo');
        return;
      }

      toast.success('Notifications enabled — is device pe calls/messages aayenge');
      await refresh();
    } catch (e) {
      console.warn(e);
      toast.error('Enable nahi ho paya, dobara try karo');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await supabase.from('push_subscriptions').delete()
          .eq('user_id', user.id).eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      toast.success('Is device pe push off ho gaya');
      await refresh();
    } catch {
      toast.error('Off karne me problem hui');
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    if (perm !== 'granted') { toast.error('Pehle permission allow karo'); return; }
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (reg) {
      reg.showNotification('AR Pixelgram', { body: 'Test notification ✅', icon: '/images/logo/logo-icon.svg' });
    } else {
      new Notification('AR Pixelgram', { body: 'Test notification ✅' });
    }
  };

  const isOn = perm === 'granted' && subscribed === true;

  return (
    <MobileLayout hideNav>
      <div className="p-4 page-transition space-y-5">
        <button onClick={() => navigate('/settings')} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" /><span className="text-sm font-medium">Back</span>
        </button>

        <div className="flex flex-col items-center text-center pt-4">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${isOn ? 'bg-primary/15' : 'bg-muted'}`}>
            {isOn ? <BellRing className="w-9 h-9 text-primary" /> : <BellOff className="w-9 h-9 text-muted-foreground" />}
          </div>
          <h1 className="text-xl font-bold text-foreground">Enable Notifications</h1>
          <p className="text-sm text-muted-foreground mt-2 text-pretty max-w-xs">
            Calls, messages aur likes ke alerts phone lock hone par bhi milenge.
          </p>
        </div>

        <div className="glass-card rounded-xl divide-y divide-border">
          <Row
            icon={<Bell className="w-5 h-5 text-primary" />}
            label="Browser permission"
            value={perm === 'unsupported' ? 'Not supported' : perm === 'granted' ? 'Allowed' : perm === 'denied' ? 'Blocked' : 'Not asked'}
            ok={perm === 'granted'}
          />
          <Row
            icon={<Smartphone className="w-5 h-5 text-primary" />}
            label="This device"
            value={subscribed === null ? 'Checking…' : subscribed ? 'Subscribed' : 'Not subscribed'}
            ok={!!subscribed}
          />
          <Row
            icon={<Bell className="w-5 h-5 text-primary" />}
            label="Saved on server"
            value={saved ? 'Yes' : 'No'}
            ok={saved}
          />
        </div>

        {perm === 'denied' && (
          <p className="text-xs text-destructive text-pretty">
            Browser me notifications block hai. Site settings → Notifications → Allow karke page reload karo.
          </p>
        )}

        {!secureContext && (
          <p className="text-xs text-destructive text-pretty">
            Push notifications sirf secure HTTPS app par chalti hain. Published website/app open karke enable karein.
          </p>
        )}

        <div className="space-y-3">
          {!isOn ? (
            <Button className="w-full h-11 font-semibold" onClick={enable} disabled={busy || perm === 'denied' || perm === 'unsupported'}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <BellRing className="w-4 h-4 mr-2" />}
              Enable Notifications
            </Button>
          ) : (
            <>
              <Button variant="outline" className="w-full h-11 font-semibold" onClick={test} disabled={busy}>
                Send test notification
              </Button>
              <Button variant="outline" className="w-full h-11 font-semibold text-destructive" onClick={disable} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <BellOff className="w-4 h-4 mr-2" />}
                Turn off on this device
              </Button>
            </>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-pretty">
          iPhone pe lock-screen notifications ke liye Safari se "Add to Home Screen" karke app install karna zaroori hai.
        </p>
      </div>
    </MobileLayout>
  );
};

const Row: React.FC<{ icon: React.ReactNode; label: string; value: string; ok: boolean }> = ({ icon, label, value, ok }) => (
  <div className="flex items-center gap-3 px-4 py-3.5">
    {icon}
    <p className="flex-1 text-sm font-medium text-foreground">{label}</p>
    <span className={`text-xs font-semibold ${ok ? 'text-primary' : 'text-muted-foreground'}`}>{value}</span>
    {ok ? <CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> : <XCircle className="w-4 h-4 text-muted-foreground shrink-0" />}
  </div>
);

export default NotificationSettingsPage;