// Android APK (Capacitor WebView) me Web Push kaam nahi karta. Isliye yahan
// hum Supabase realtime se `notifications` table sunte hain aur har nayi
// notification par phone ka apna notification (Local Notification) dikhate
// hain — bilkul Instagram/WhatsApp jaisa: message, like, comment, follow
// aur incoming call sab ka notification phone me aata hai.
import { useEffect } from 'react';
import { supabase } from '@/db/supabase';

type Row = {
  id: string;
  type: string;
  actor_id: string | null;
  post_id: string | null;
  message: string | null;
};

function isNative(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

async function getPlugin() {
  const mod = await import('@capacitor/local-notifications');
  return mod.LocalNotifications;
}

function titleFor(type: string, who: string): string {
  switch (type) {
    case 'like': return `${who} ne aapki post like ki`;
    case 'reel_like': return `${who} ne aapka reel like kiya`;
    case 'story_like': return `${who} ne aapki story like ki`;
    case 'story_reply': return `${who} ne aapki story par reply kiya`;
    case 'comment': return `${who} ne aapki post par comment kiya`;
    case 'reel_comment': return `${who} ne aapke reel par comment kiya`;
    case 'comment_reply': return `${who} ne aapke comment ka jawab diya`;
    case 'follow': return `${who} ne aapko follow kiya`;
    case 'follow_request': return `${who} ne follow request bheji`;
    case 'follow_accepted': return `${who} ne aapki follow request accept ki`;
    case 'message': return `${who}`;
    case 'new_story': return `${who} ne nayi story daali`;
    default: return 'AR Pixelgram';
  }
}

function urlFor(row: Row): string {
  if (row.type === 'message' && row.actor_id) return `/chat/${row.actor_id}`;
  if (row.type === 'new_story' && row.actor_id) return `/stories?u=${row.actor_id}`;
  if (row.type.startsWith('reel_') || row.type === 'comment_reply') {
    return row.post_id ? `/reels?r=${row.post_id}` : '/reels';
  }
  return '/notifications';
}

export function useNativeNotifications(userId: string | undefined) {
  useEffect(() => {
    if (!userId || typeof window === 'undefined' || !isNative()) return;

    let cancelled = false;
    let counter = 1;

    const run = async () => {
      const LocalNotifications = await getPlugin();
      try {
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display !== 'granted') await LocalNotifications.requestPermissions();
      } catch { /* noop */ }

      // Notification tap karte hi sahi screen khul jaye.
      try {
        await LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
          const url = (e.notification.extra as { url?: string } | undefined)?.url;
          if (url) window.location.href = url;
        });
      } catch { /* noop */ }

      const channel = supabase
        .channel(`native-notifs-${userId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          async (payload) => {
            if (cancelled) return;
            const row = payload.new as Row;
            let who = 'Kisi ne';
            if (row.actor_id) {
              const { data } = await supabase
                .from('profiles').select('username, full_name')
                .eq('user_id', row.actor_id).maybeSingle();
              who = data?.username || data?.full_name || who;
            }
            const isCall = !!row.message && (row.message.startsWith('📞') || row.message.startsWith('📵'));
            const title = isCall
              ? `${who} — ${row.message?.startsWith('📞') ? 'Incoming call' : 'Missed call'}`
              : titleFor(row.type, who);
            const body = row.message || (row.type === 'message' ? 'Naya message' : 'AR Pixelgram');

            try {
              await LocalNotifications.schedule({
                notifications: [{
                  id: (Date.now() % 100000) + counter++,
                  title,
                  body,
                  smallIcon: 'ic_launcher',
                  extra: { url: isCall ? '/chat' : urlFor(row) },
                }],
              });
            } catch { /* noop */ }
          },
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    };

    const cleanupPromise = run();
    return () => {
      cancelled = true;
      cleanupPromise.then((fn) => fn?.()).catch(() => {});
    };
  }, [userId]);
}
