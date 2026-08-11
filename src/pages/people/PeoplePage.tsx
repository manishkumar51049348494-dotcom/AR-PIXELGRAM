// लोग/डिस्कवर पेज — सभी यूज़र्स दिखाएं, फॉलो करें
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '@/components/layouts/MobileLayout';
import { useAuth } from '@/contexts/AuthContext';
import { getAllProfiles, getFollowStatus, followUser, unfollowUser, createNotification } from '@/services/api';
import type { Profile } from '@/types/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BadgeCheck, Search, Loader2, UserPlus, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

const PeoplePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [filtered, setFiltered] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [followMap, setFollowMap] = useState<Record<string, 'accepted' | 'pending' | null>>({});
  const [followLoading, setFollowLoading] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const all = await getAllProfiles(0, 50);
    const others = all.filter(p => p.user_id !== user?.id);
    setProfiles(others);
    setFiltered(others);
    // fetch follow status for all
    if (user) {
      const statusEntries = await Promise.all(
        others.map(async p => [p.user_id, await getFollowStatus(user.id, p.user_id)] as [string, 'accepted' | 'pending' | null])
      );
      setFollowMap(Object.fromEntries(statusEntries));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!search.trim()) { setFiltered(profiles); return; }
    const q = search.toLowerCase();
    setFiltered(profiles.filter(p =>
      p.username.toLowerCase().includes(q) || (p.full_name || '').toLowerCase().includes(q)
    ));
  }, [search, profiles]);

  const handleFollow = async (profile: Profile) => {
    if (!user) return;
    setFollowLoading(prev => ({ ...prev, [profile.user_id]: true }));
    const status = followMap[profile.user_id];
    if (status === 'accepted' || status === 'pending') {
      await unfollowUser(profile.user_id, user.id);
      setFollowMap(prev => ({ ...prev, [profile.user_id]: null }));
      toast.success(`${profile.username} को अनफॉलो किया`);
    } else {
      await followUser(profile.user_id, profile.is_private);
      if (profile.is_private) {
        setFollowMap(prev => ({ ...prev, [profile.user_id]: 'pending' }));
        await createNotification(profile.user_id, 'follow_request', user.id);
        toast.success('फॉलो रिक्वेस्ट भेजी गई');
      } else {
        setFollowMap(prev => ({ ...prev, [profile.user_id]: 'accepted' }));
        await createNotification(profile.user_id, 'follow', user.id);
        toast.success(`${profile.username} को फॉलो किया`);
      }
    }
    setFollowLoading(prev => ({ ...prev, [profile.user_id]: false }));
  };

  return (
    <MobileLayout>
      <div className="page-transition">
        <div className="px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-xl font-bold text-foreground mb-3">लोग खोजें</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="नाम या username से खोजें…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <span className="text-5xl mb-4">🔍</span>
            <p className="text-muted-foreground text-sm">कोई यूज़र नहीं मिला</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map(profile => {
              const status = followMap[profile.user_id];
              return (
                <div key={profile.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors">
                  {/* अवतार — क्लिक पर प्रोफाइल */}
                  <button onClick={() => navigate(`/profile/${profile.user_id}`)} className="shrink-0">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt={profile.username} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-primary font-bold text-lg">{profile.username[0]?.toUpperCase()}</span>
                      </div>
                    )}
                  </button>

                  {/* जानकारी */}
                  <button className="flex-1 min-w-0 text-left" onClick={() => navigate(`/profile/${profile.user_id}`)}>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-sm text-foreground truncate">{profile.username}</span>
                      {profile.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </div>
                    {profile.full_name && <p className="text-xs text-muted-foreground truncate">{profile.full_name}</p>}
                    {profile.bio && <p className="text-xs text-muted-foreground truncate">{profile.bio}</p>}
                  </button>

                  {/* फॉलो बटन */}
                  <Button
                    size="sm"
                    variant={status === 'accepted' ? 'secondary' : 'default'}
                    className="shrink-0 h-8 px-3 text-xs font-bold rounded-lg"
                    style={status !== 'accepted' ? { background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))', border: 'none', color: 'white' } : {}}
                    onClick={() => handleFollow(profile)}
                    disabled={followLoading[profile.user_id]}
                  >
                    {followLoading[profile.user_id] ? <Loader2 className="w-3 h-3 animate-spin" /> :
                      status === 'accepted' ? <><UserCheck className="w-3 h-3 mr-1" />Following</> :
                      status === 'pending' ? 'Requested' :
                      <><UserPlus className="w-3 h-3 mr-1" />Follow</>}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default PeoplePage;
