// Followers / Following list — Instagram स्टाइल
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import MobileLayout from '@/components/layouts/MobileLayout';
import { getFollowers, getFollowing, followUser, unfollowUser, getFollowStatus } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Profile } from '@/types/types';
import { BadgeCheck, ArrowLeft, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// प्रत्येक username से unique gradient
function userGradient(username: string) {
  let h = 0;
  for (let i = 0; i < username.length; i++) h = (h * 31 + username.charCodeAt(i)) & 0xffffff;
  const hue1 = h % 360;
  const hue2 = (hue1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${hue1},70%,55%), hsl(${hue2},80%,45%))`;
}

const FollowListPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // pathname से type derive करो (/followers/... या /following/...)
  const type: 'followers' | 'following' = location.pathname.startsWith('/following') ? 'following' : 'followers';

  const [list, setList] = useState<Profile[]>([]);
  const [filtered, setFiltered] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      const data = type === 'followers'
        ? await getFollowers(userId)
        : await getFollowing(userId);
      setList(data);
      setFiltered(data);

      // अपने following status preload करें
      if (user) {
        const statuses = await Promise.all(
          data.map(p => getFollowStatus(user.id, p.user_id).then(s => ({ id: p.user_id, s }))
        ));
        const ids = new Set(statuses.filter(x => x.s === 'accepted').map(x => x.id));
        setFollowingIds(ids);
      }
      setLoading(false);
    })();
  }, [userId, type, user]);

  useEffect(() => {
    if (!search.trim()) { setFiltered(list); return; }
    const q = search.toLowerCase();
    setFiltered(list.filter(p =>
      p.username.toLowerCase().includes(q) || (p.full_name || '').toLowerCase().includes(q)
    ));
  }, [search, list]);

  const handleToggleFollow = async (profile: Profile) => {
    if (!user) return;
    const isFollowing = followingIds.has(profile.user_id);
    if (isFollowing) {
      await unfollowUser(profile.user_id, user.id);
      setFollowingIds(prev => { const s = new Set(prev); s.delete(profile.user_id); return s; });
      toast.success(`${profile.username} को unfollow किया`);
    } else {
      await followUser(profile.user_id, profile.is_private);
      if (!profile.is_private) {
        setFollowingIds(prev => new Set([...prev, profile.user_id]));
        toast.success(`${profile.username} को follow किया`);
      } else {
        toast.success('Follow request भेजी गई');
      }
    }
  };

  const isOwnProfile = userId === user?.id;

  return (
    <MobileLayout>
      <div className="page-transition">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-10">
          <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h2 className="text-lg font-bold text-foreground flex-1">
            {type === 'followers' ? 'Followers' : 'Following'}
          </h2>
          <span className="text-sm text-muted-foreground">{list.length}</span>
        </div>

        {/* Search */}
        <div className="px-4 py-2.5 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 bg-muted/50 border-0 focus-visible:ring-1"
            />
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-0">
            {Array.from({length: 8}).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
                <div className="w-12 h-12 rounded-full bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-32 bg-muted animate-pulse rounded-full" />
                  <div className="h-3 w-24 bg-muted animate-pulse rounded-full" />
                </div>
                <div className="h-8 w-20 bg-muted animate-pulse rounded-xl shrink-0" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <p className="text-muted-foreground">
              {search ? 'कोई user नहीं मिला' : type === 'followers' ? 'अभी कोई follower नहीं' : 'कोई following नहीं'}
            </p>
          </div>
        ) : (
          <div>
            {filtered.map(profile => {
              const isMe = profile.user_id === user?.id;
              const isFollowing = followingIds.has(profile.user_id);
              return (
                <div key={profile.id} className="flex items-center gap-3 px-4 py-3 border-b border-border/40 hover:bg-muted/30 transition-colors">
                  {/* Avatar */}
                  <button onClick={() => navigate(`/profile/${profile.user_id}`)} className="shrink-0">
                    {profile.avatar_url ? (
                      <div className="p-0.5 rounded-full" style={{ background: userGradient(profile.username) }}>
                        <img src={profile.avatar_url} alt={profile.username}
                          className="w-11 h-11 rounded-full object-cover border-2 border-background" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-lg shrink-0"
                        style={{ background: userGradient(profile.username) }}>
                        {profile.username[0]?.toUpperCase()}
                      </div>
                    )}
                  </button>

                  {/* Name */}
                  <button className="flex-1 min-w-0 text-left" onClick={() => navigate(`/profile/${profile.user_id}`)}>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-sm text-foreground truncate">{profile.username}</span>
                      {profile.is_verified && <BadgeCheck className="w-4 h-4 text-primary shrink-0" />}
                    </div>
                    {profile.full_name && (
                      <p className="text-xs text-muted-foreground truncate">{profile.full_name}</p>
                    )}
                  </button>

                  {/* Follow button — own account hide करें */}
                  {!isMe && (
                    <Button
                      size="sm"
                      variant={isFollowing ? 'secondary' : 'default'}
                      className={cn('h-8 text-xs px-4 rounded-xl shrink-0 font-semibold',
                        !isFollowing && 'text-primary-foreground'
                      )}
                      style={!isFollowing ? { background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))', border: 'none' } : {}}
                      onClick={() => handleToggleFollow(profile)}
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </Button>
                  )}
                  {isMe && isOwnProfile && (
                    <span className="text-xs text-muted-foreground shrink-0 pr-1">You</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default FollowListPage;
