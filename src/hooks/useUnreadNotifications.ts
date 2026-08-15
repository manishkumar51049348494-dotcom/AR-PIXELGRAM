import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/db/supabase';
import { getUnreadNotificationsCount } from '@/services/api';

export function useUnreadNotifications(userId: string | undefined) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setCount(0);
      return;
    }
    const next = await getUnreadNotificationsCount(userId);
    setCount(next);
  }, [userId]);

  useEffect(() => {
    void refresh();
    if (!userId) return;

    const channel = supabase
      .channel(`unread-notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => { void refresh(); },
      )
      .subscribe();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [userId, refresh]);

  return count;
}