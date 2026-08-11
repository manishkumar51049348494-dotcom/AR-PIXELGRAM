import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { logVisit } from '@/services/visitorTracking';

/** Logs every visit (country, state, device, time) for the admin panel. */
export function useVisitTracker() {
  const { profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    logVisit(profile?.user_id ?? null, profile?.username ?? null);
  }, [loading, profile?.user_id, profile?.username]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        logVisit(profile?.user_id ?? null, profile?.username ?? null);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [profile?.user_id, profile?.username]);
}
