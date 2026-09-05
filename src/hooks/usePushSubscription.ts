// Registers the /sw.js service worker and subscribes the current user to
// Web Push using our VAPID public key. Stores the subscription in
// public.push_subscriptions so the send-call-push edge function can reach
// this device even when the app is closed or the phone is locked.
import { useEffect } from 'react';
import { supabase } from '@/db/supabase';

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Subscribes to Web Push, self-healing if a stale subscription (created with
// an older/different VAPID key) is still sitting on the registration — this
// is what silently breaks "Enable Notifications" on some browsers, since
// pushManager.subscribe() throws instead of replacing it.
export async function ensurePushSubscription(
  reg: ServiceWorkerRegistration,
  vapidPublicKey: string,
): Promise<PushSubscription> {
  const keyBytes = urlBase64ToUint8Array(vapidPublicKey);
  const applicationServerKey = keyBytes.buffer.slice(
    keyBytes.byteOffset,
    keyBytes.byteOffset + keyBytes.byteLength,
  ) as ArrayBuffer;

  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    const existing = sub.options?.applicationServerKey;
    const matches = !!existing && new Uint8Array(existing).length === keyBytes.length
      && new Uint8Array(existing).every((b, i) => b === keyBytes[i]);
    if (!matches) {
      try { await sub.unsubscribe(); } catch { /* noop */ }
      sub = null;
    }
  }
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
    } catch {
      // A lingering subscription with a different key can still throw even
      // after getSubscription() returned null on some browsers — force one
      // more clean retry before giving up.
      const stale = await reg.pushManager.getSubscription();
      if (stale) { try { await stale.unsubscribe(); } catch { /* noop */ } }
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
    }
  }
  return sub as PushSubscription;
}

export function usePushSubscription(userId: string | undefined) {
  useEffect(() => {
    if (!userId || !VAPID_PUBLIC) return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    let cancelled = false;
    (async () => {
      try {
        // Browsers require permission prompts to follow a user gesture. The
        // Settings screen owns that prompt; this hook only restores/saves an
        // already granted subscription.
        if (Notification.permission !== 'granted') return;

        const reg = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        const sub = await ensurePushSubscription(reg, VAPID_PUBLIC);
        if (cancelled) return;

        const json = sub.toJSON();
        const p256dh = json.keys?.p256dh;
        const auth = json.keys?.auth;
        if (!json.endpoint || !p256dh || !auth) return;

        const { error: saveError } = await supabase.from('push_subscriptions').upsert({
          user_id: userId,
          endpoint: json.endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent,
        }, { onConflict: 'user_id,endpoint' });
        if (saveError) console.error('push subscription save failed', saveError);
      } catch (e) {
        console.warn('push subscribe failed', e);
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);
}