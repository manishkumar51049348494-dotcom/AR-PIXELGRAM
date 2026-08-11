import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/db/supabase';
import type { Profile } from '@/types/types';
import { getProfile } from '@/services/api';
import { usePushSubscription } from '@/hooks/usePushSubscription';

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
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      const p = await getProfile(currentUser.id);
      setProfile(p);
    }
  }, []);

  // Retry getProfile until the DB trigger creates the row (handles new user race condition)
  const getProfileWithRetry = useCallback(async (userId: string, retries = 5, delayMs = 600): Promise<Profile | null> => {
    for (let i = 0; i < retries; i++) {
      const p = await getProfile(userId);
      if (p) return p;
      if (i < retries - 1) await new Promise(res => setTimeout(res, delayMs));
    }
    return null;
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const p = await getProfileWithRetry(session.user.id);
        setProfile(p);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        // Retry handles race condition: DB trigger may not have created the profile row yet
        const p = await getProfileWithRetry(session.user.id, 5, 500);
        setProfile(p);
      } else {
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
