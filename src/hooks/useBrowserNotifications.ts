// Show browser notifications for new in-app notifications while the tab is open.
// User-selected scope: PWA / web-push comes later. For now we use the standard
// Web Notifications API so any modern browser (desktop or Android) can show a
// system notification when the app receives a new like/comment/follow/message.
import { useEffect } from 'react';
import { supabase } from '@/db/supabase';
import type { Notification } from '@/types/types';

const titleFor = (n: Notification, actorName?: string): string => {
  const who = actorName || 'Someone';
  switch (n.type) {
    case 'like':         return `${who} liked your post`;
    case 'reel_like':    return `${who} liked your reel`;
    case 'story_like':   return `${who} liked your story`;
    case 'comment':      return `${who} commented on your post`;
    case 'reel_comment': return `${who} commented on your reel`;
    case 'comment_reply':return `${who} replied to your comment`;
    case 'follow':       return `${who} started following you`;
    case 'follow_request': return `${who} sent a follow request`;
    case 'follow_accepted': return `${who} accepted your follow request`;
    case 'message':      return `New message from ${who}`;
    case 'broadcast':    return 'AR Pixelgram';
    default:             return 'AR Pixelgram';
  }
};

export function useBrowserNotifications(userId: string | undefined) {
  // Subscribe to new notifications and pop a system toast
  useEffect(() => {
    if (!userId) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    const channel = supabase
      .channel(`browser-notifs-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        async (payload) => {
          if (Notification.permission !== 'granted') return;
          if (document.visibilityState === 'visible') return; // don't spam while user is looking
          const n = payload.new as Notification;
          let actorName: string | undefined;
          if (n.actor_id) {
            const { data } = await supabase.from('profiles').select('username').eq('user_id', n.actor_id).maybeSingle();
            actorName = data?.username;
          }
          try {
            new Notification(titleFor(n, actorName), {
              body: n.message || '',
              icon: '/images/logo/logo-icon.svg',
              tag: n.id,
            });
          } catch { /* ignore */ }
        },
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [userId]);
}