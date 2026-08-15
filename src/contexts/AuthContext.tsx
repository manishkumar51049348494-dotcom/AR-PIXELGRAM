import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/db/supabase';
import type { Profile } from '@/types/types';
import { getProfile } from '@/services/api';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { withTimeout } from '@/lib/withTimeout';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Register service worker + subscribe this device to Web Push so incoming
  // calls & messages can wake the phone even when the app is closed/locked.
  usePushSubscription(user?.id);

  const refreshProfile = useCallback(async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        const p = await withTimeout(getProfile(currentUser.id));
        // Network error par purana profile mat mitao
        if (p) setProfile(p);
      }
    } catch (e) {
      console.error('refreshProfile failed', e);
    }
  }, []);

  // Retry getProfile until the DB trigger creates the row (handles new user race condition)
  const getProfileWithRetry = useCallback(async (userId: string, retries = 5, delayMs = 600): Promise<Profile | null> => {
    for (let i = 0; i < retries; i++) {
      try {
        const p = await withTimeout(getProfile(userId), 15000);
        if (p) return p;
      } catch (e) {
        // network/timeout — agla retry
        console.error('getProfile failed', e);
      }
      if (i < retries - 1) await new Promise(res => setTimeout(res, delayMs));
    }
    return null;
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        const p = await getProfileWithRetry(session.user.id);
        if (p) setProfile(p);
      }
    }).catch((e) => {
      console.error('getSession failed', e);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Deploy/service-worker reload ke dauran transient null callbacks ko logout
      // mat samjho. User ko sirf Supabase ke explicit SIGNED_OUT event par hatao.
      if (session?.user) setUser(session.user);
      else if (event === 'SIGNED_OUT') setUser(null);
      if (session?.user) {
        const userId = session.user.id;
        // Supabase auth callback ke andar await karke koi database/auth request
        // chalane se auth lock deadlock ho sakta hai. Callback ko turant return
        // karne do aur profile request next task me chalao.
        setTimeout(() => {
          getProfileWithRetry(userId, 5, 500)
            .then((p) => {
              if (p) setProfile(p);
            })
            .catch((e) => console.error('auth profile refresh failed', e));
        }, 0);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
