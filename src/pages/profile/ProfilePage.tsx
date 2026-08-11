import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MobileLayout from '@/components/layouts/MobileLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  getProfile, getUserPosts, getFollowStatus, getFollowersCount,
  getFollowingCount, followUser, unfollowUser, createNotification, getUserReels,
  uploadImage, updateProfile
} from '@/services/api';
import { supabase } from '@/db/supabase';
import type { Profile, Post } from '@/types/types';
import type { Reel } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Settings, BadgeCheck, Grid3X3, Lock, Loader2, Film, Camera, Flag, Play, Heart, MessageCircle, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import PostCard from '@/components/common/PostCard';
import { withTimeout } from '@/lib/withTimeout';

// username से unique gradient ring color
function userGradient(username: string) {
  let h = 0;
  for (let i = 0; i < username.length; i++) h = (h * 31 + username.charCodeAt(i)) & 0xffffff;
  const hue1 = h % 360;
  const hue2 = (hue1 + 50) % 360;
  const hue3 = (hue1 + 90) % 360;
  return `linear-gradient(135deg, hsl(${hue1},80%,55%), hsl(${hue2},70%,50%), hsl(${hue3},75%,45%))`;
}

const ProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user, profile: myProfile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const targetUserId = userId || user?.id;
  const isOwnProfile = !userId || userId === user?.id;

  // Sign out करके hard-navigate — async/await ensures signOut completes before redirect
  const signOutTo = async (dest: string) => {
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    window.location.href = dest;
  };

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [reels, setReels] = useState<Reel[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followStatus, setFollowStatus] = useState<'accepted' | 'pending' | null>(null);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'reels'>('posts');
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    if (!targetUserId) return;
    setLoading(true);
    setLoadError(false);
    try {
      // 5 second ka blind timer hata diya gaya — wo slow network par profile ko
      // galti se "User not found" bana deta tha. Ab asli timeout + retry hai.
      const [p, [fc, fgc]] = await withTimeout(Promise.all([
        getProfile(targetUserId),
        Promise.all([getFollowersCount(targetUserId), getFollowingCount(targetUserId)])
      ]), 20000);
      setProfile(p);
      setFollowersCount(fc);
      setFollowingCount(fgc);

      if (!isOwnProfile && user) {
        const status = await getFollowStatus(user.id, targetUserId);
        setFollowStatus(status);
        if (status === 'accepted') {
          const [userPosts, userReels] = await Promise.all([getUserPosts(targetUserId, user?.id), getUserReels(targetUserId)]);
          setPosts(userPosts);
          setReels(userReels);
        } else if (p && !p.is_private) {
          const [userPosts, userReels] = await Promise.all([getUserPosts(targetUserId, user?.id), getUserReels(targetUserId)]);
          setPosts(userPosts);
          setReels(userReels);
        }
      } else {
        const [userPosts, userReels] = await Promise.all([getUserPosts(targetUserId, user?.id), getUserReels(targetUserId)]);
        setPosts(userPosts);
        setReels(userReels);
      }
    } catch (e) {
      console.error('profile load failed', e);
      setLoadError(true);
    }
    finally { setLoading(false); }
  }, [targetUserId, isOwnProfile, user]);

  useEffect(() => { load(); }, [load]);

  const handleFollow = async () => {
    if (!user || !profile) return;
    setFollowLoading(true);
    if (followStatus === 'accepted' || followStatus === 'pending') {
      await unfollowUser(profile.user_id, user.id);
      setFollowStatus(null);
      setFollowersCount(c => c - 1);
      toast.success('Unfollowed');
    } else {
      await followUser(profile.user_id, profile.is_private);
      if (profile.is_private) {
        setFollowStatus('pending');
        await createNotification(profile.user_id, 'follow_request', user.id);
        toast.success('Follow request sent');
      } else {
        setFollowStatus('accepted');
        setFollowersCount(c => c + 1);
        await createNotification(profile.user_id, 'follow', user.id);
        toast.success(`Following ${profile.username}`);
        const [userPosts, userReels] = await Promise.all([getUserPosts(profile.user_id, user?.id), getUserReels(profile.user_id)]);
        setPosts(userPosts);
        setReels(userReels);
      }
    }
    setFollowLoading(false);
  };

  if (loading) {
    return (
      <MobileLayout>
        <div className="px-4 py-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-20 h-20 rounded-full bg-muted animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-muted animate-pulse rounded-full" />
              <div className="h-3 w-24 bg-muted animate-pulse rounded-full" />
              <div className="flex gap-4 mt-2">
                {[0,1,2].map(i => <div key={i} className="h-8 w-12 bg-muted animate-pulse rounded-lg" />)}
              </div>
            </div>
          </div>
          <div className="h-9 w-full bg-muted animate-pulse rounded-xl" />
          <div className="grid grid-cols-3 gap-0.5">
            {Array.from({length:9}).map((_,i) => <div key={i} className="aspect-square bg-muted animate-pulse" />)}
          </div>
        </div>
      </MobileLayout>
    );
  }

  // Network/server problem — account delete nahi hua. Retry dikhao.
  // Apne hi profile par row null aana (network/RLS/trigger race) bhi delete NAHI hai,
  // isliye owner ko bhi "deleted" ki jagah retry screen dikhao.
  if (!profile && (loadError || isOwnProfile)) {
    return (
      <MobileLayout>
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
          <div className="w-20 h-20 rounded-full border-2 border-border flex items-center justify-center mb-4 bg-muted">
            <Loader2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Connection problem</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Profile load nahi ho paaya. Internet check karke dobara try karein.
          </p>
          <Button onClick={() => load()} className="mt-5 rounded-xl font-bold px-8 h-11">
            Retry
          </Button>
        </div>
      </MobileLayout>
    );
  }

  // permanently_disabled accounts → "User Not Found" (Instagram-style) + sign-out option
  if (!profile || profile.account_status === 'permanently_disabled') {
    return (
      <MobileLayout>
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
          <div className="w-20 h-20 rounded-full border-2 border-border flex items-center justify-center mb-4 bg-muted">
            <Lock className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">यह पेज उपलब्ध नहीं है</h2>
          <p className="text-sm text-muted-foreground text-pretty max-w-xs">
            जो link आपने follow किया वह टूटा हुआ हो सकता है, या यह पेज हटा दिया गया है।
          </p>
          <p className="text-xs text-muted-foreground mt-4 bg-muted px-3 py-1.5 rounded-full">User not found</p>

          {/* account delete हो गया — sign out buttons सिर्फ OWNER को दिखाओ */}
          {user && isOwnProfile && (
            <div className="mt-8 flex flex-col items-center gap-3 w-full max-w-xs">
              <p className="text-sm text-muted-foreground">आपका account हटा दिया गया है।</p>
              <button
                type="button"
                onClick={() => signOutTo('/login')}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white active:opacity-80 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)' }}
              >
                दूसरे account से Login करें
              </button>
              <button
                type="button"
                onClick={() => signOutTo('/register')}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm border border-border text-foreground bg-background active:opacity-80 transition-opacity"
              >
                नया account बनाएं
              </button>
            </div>
          )}
        </div>
      </MobileLayout>
    );
  }

  const canSeePosts = isOwnProfile || followStatus === 'accepted' || !profile.is_private;
  // अपने profile पर suspended/locked/permanently_disabled check (RouteGuard already redirects to /appeal but handle edge case)
  const ownAccountRestricted = isOwnProfile && profile.account_status && profile.account_status !== 'active';
  const isSuspended = !isOwnProfile && (profile.account_status === 'suspended' || profile.account_status === 'locked');

  // अपना account restricted है तो Instagram-style suspended page दिखाओ
  if (ownAccountRestricted) {
    const statusMap: Record<string, { title: string; msg: string; color: string }> = {
      suspended: { title: 'Account Suspended', msg: 'आपका account अस्थायी रूप से निलंबित किया गया है। आप appeal कर सकते हैं।', color: 'amber' },
      locked: { title: 'Account Locked', msg: 'आपका account समीक्षा के लिए lock किया गया है। आप appeal कर सकते हैं।', color: 'blue' },
      permanently_disabled: { title: 'Account Disabled', msg: 'आपका account स्थायी रूप से बंद कर दिया गया है।', color: 'red' },
    };
    const info = statusMap[profile.account_status as string] || statusMap.suspended;
    return (
      <MobileLayout hideNav>
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-background">
          <div className="w-24 h-24 rounded-full border-4 border-border flex items-center justify-center mb-5 bg-muted relative">
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover opacity-40" />
              : <span className="text-3xl font-black text-muted-foreground">{profile.username?.[0]?.toUpperCase()}</span>}
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center border-2 border-background">
              <Lock className="w-4 h-4 text-white" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-foreground mb-1">{profile.username}</h2>
          <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-2">{info.title}</p>
          <p className="text-sm text-muted-foreground max-w-xs mb-6 text-pretty">{info.msg}</p>
          {/* Appeal button — permanently_disabled owners are already redirected to User Not Found above */}
          <Link to="/appeal">
            <Button className="rounded-xl font-bold px-8 h-11" style={{ background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))', border: 'none', color: 'white' }}>
              Appeal करें
            </Button>
          </Link>
          <button onClick={() => signOutTo('/login')} className="mt-4 text-sm text-muted-foreground underline underline-offset-2">
            Sign out
          </button>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="page-transition">
        {/* Suspended/Locked banner for other users' profiles */}
        {isSuspended && (
          <div className="mx-4 mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
              {profile.account_status === 'locked' ? 'यह अकाउंट समीक्षा के लिए lock है।' : 'यह अकाउंट अस्थायी रूप से suspend है।'}
            </p>
          </div>
        )}
        <div className="relative px-4 pt-5 pb-4">
          {/* Gradient background strip */}
          <div className="absolute top-0 left-0 right-0 h-24 opacity-10 rounded-b-3xl pointer-events-none"
            style={{ background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))' }} />

          <div className="flex items-start gap-4 mb-3 relative">
            {/* Avatar with story ring — own profile: tap to change photo */}
            <div className="shrink-0 mt-1 relative">
              {isOwnProfile ? (
                <label className="cursor-pointer block">
                  {profile.avatar_url ? (
                    <div className="story-ring animate-pulse-glow">
                      <div className="story-ring-inner">
                        <img src={profile.avatar_url} alt={profile.username} className="w-20 h-20 rounded-full object-cover" />
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-full flex items-center justify-center text-primary-foreground font-black text-2xl"
                      style={{ background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))', width: 88, height: 88 }}>
                      {profile.username[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-md border-2 border-background">
                    <Camera className="w-3.5 h-3.5 text-primary-foreground" />
                  </div>
                  <input
                    type="file" accept="image/*" className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !user) return;
                      if (file.size > 5 * 1024 * 1024) { toast.error('5MB से बड़ी फाइल नहीं'); return; }
                      try {
                        const url = await uploadImage('avatars', file, user.id);
                        await updateProfile(user.id, { avatar_url: url } as Parameters<typeof updateProfile>[1]);
                        await load();
                        toast.success('प्रोफाइल फोटो अपडेट हुई ✨');
                      } catch { toast.error('फोटो अपलोड नहीं हुई'); }
                    }}
                  />
                </label>
              ) : (
                profile.avatar_url ? (
                  <div className="p-0.5 rounded-full" style={{ background: userGradient(profile.username) }}>
                    <div className="bg-background p-0.5 rounded-full">
                      <img src={profile.avatar_url} alt={profile.username} className="w-20 h-20 rounded-full object-cover" />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-full flex items-center justify-center text-white font-black text-2xl"
                    style={{ background: userGradient(profile.username), width: 88, height: 88 }}>
                    {profile.username[0]?.toUpperCase()}
                  </div>
                )
              )}
            </div>

            {/* Stats */}
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                <h2 className="font-black text-lg text-foreground truncate">{profile.username}</h2>
                {profile.is_verified && <BadgeCheck className="w-5 h-5 text-primary shrink-0" />}
                {profile.is_private && <Lock className="w-4 h-4 text-muted-foreground shrink-0" />}
              </div>
              {profile.full_name && <p className="text-xs text-muted-foreground mb-2 truncate">{profile.full_name}</p>}
              <div className="flex items-center gap-3">
                {[
                  { val: posts.length, label: t('posts'), link: null },
                  { val: followersCount, label: t('followers'), link: `/followers/${profile.user_id}` },
                  { val: followingCount, label: t('following'), link: `/following/${profile.user_id}` },
                ].map(({ val, label, link }) => (
                  link ? (
                    <button key={label} onClick={() => navigate(link)} className="text-center hover:opacity-70 transition-opacity">
                      <p className="font-black text-base text-foreground leading-none">{val > 999 ? `${(val/1000).toFixed(1)}k` : val}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                    </button>
                  ) : (
                    <div key={label} className="text-center">
                      <p className="font-black text-base text-foreground leading-none">{val > 999 ? `${(val/1000).toFixed(1)}k` : val}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  )
                ))}
              </div>
            </div>
          </div>

          {profile.bio && <p className="text-sm text-foreground text-pretty mb-3">{profile.bio}</p>}

          {/* Action buttons */}
          <div className="flex gap-2">
            {isOwnProfile ? (
              <>
                <Link to="/edit-profile" className="flex-1">
                  <Button variant="secondary" className="w-full h-9 font-bold text-sm rounded-xl">{t('editProfile')}</Button>
                </Link>
                <Link to="/settings">
                  <Button variant="secondary" size="icon" className="h-9 w-9 shrink-0 rounded-xl">
                    <Settings className="w-4 h-4" />
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Button
                  className="flex-1 h-9 font-bold text-sm rounded-xl"
                  variant={followStatus === 'accepted' ? 'secondary' : 'default'}
                  onClick={handleFollow}
                  disabled={followLoading}
                  style={followStatus !== 'accepted' ? { background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))', border: 'none' } : {}}
                >
                  {followLoading ? <Loader2 className="w-4 h-4 animate-spin" /> :
                    followStatus === 'accepted' ? t('following') :
                    followStatus === 'pending' ? 'Requested' : t('follow')}
                </Button>
                {followStatus === 'accepted' && (
                  <Link to={`/chat/${profile.user_id}`} className="flex-1">
                    <Button variant="secondary" className="w-full h-9 font-bold text-sm rounded-xl">{t('chat')}</Button>
                  </Link>
                )}
                <button
                  onClick={() => navigate(`/report-user/${profile.user_id}`)}
                  className="h-9 w-9 flex items-center justify-center rounded-xl bg-muted hover:bg-muted/80 transition-colors shrink-0"
                  title="रिपोर्ट करें"
                >
                  <Flag className="w-4 h-4 text-muted-foreground" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Posts / Reels tab bar */}
        <div className="border-t border-border sticky top-16 bg-background/90 backdrop-blur-sm z-10">
          <div className="flex">
            <button
              onClick={() => setActiveTab('posts')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-bold transition-all border-b-2 ${
                activeTab === 'posts' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
              {t('posts')}
            </button>
            <button
              onClick={() => setActiveTab('reels')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-bold transition-all border-b-2 ${
                activeTab === 'reels' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Film className="w-4 h-4" />
              {t('reels')}
              {reels.length > 0 && (
                <span className="ml-1 text-[10px] font-bold px-1.5 rounded-full text-primary-foreground"
                  style={{ background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))' }}>
                  {reels.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'posts' && (
          <>
            {!canSeePosts ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <Lock className="w-12 h-12 text-muted-foreground mb-3" />
                <h3 className="font-semibold text-foreground mb-1">This account is private</h3>
                <p className="text-sm text-muted-foreground text-pretty">Follow this account to see their posts.</p>
              </div>
            ) : posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <Grid3X3 className="w-12 h-12 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">{t('noPostsYet')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-0.5">
                {posts.map(post => (
                  <button
                    key={post.id}
                    onClick={() => setOpenPost(post)}
                    className="aspect-square bg-muted overflow-hidden group relative text-left"
                  >
                    <img src={post.image_url} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100">
                      <span className="flex items-center gap-1 text-white text-sm font-semibold">
                        <Heart className="w-4 h-4 fill-white" />{post.likes_count || 0}
                      </span>
                      <span className="flex items-center gap-1 text-white text-sm font-semibold">
                        <MessageCircle className="w-4 h-4 fill-white" />{post.comments_count || 0}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Post detail overlay — like/comment/date/tap-profile, same as Instagram's post view */}
        {openPost && (
          <div className="fixed inset-0 z-[60] bg-black/70 flex items-start justify-center overflow-y-auto py-6 px-3" onClick={() => setOpenPost(null)}>
            <div className="w-full max-w-lg bg-background rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex justify-end p-2">
                <button onClick={() => setOpenPost(null)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
                  <X className="w-5 h-5 text-foreground" />
                </button>
              </div>
              <PostCard
                post={openPost}
                onDelete={isOwnProfile ? (id) => { setPosts(p => p.filter(x => x.id !== id)); setOpenPost(null); } : undefined}
              />
            </div>
          </div>
        )}

        {activeTab === 'reels' && (
          <>
            {!canSeePosts ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <Lock className="w-12 h-12 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Follow this account to see their reels.</p>
              </div>
            ) : reels.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <Film className="w-12 h-12 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">{t('noReelsYet')}</p>
                {isOwnProfile && (
                  <Button
                    className="mt-4 rounded-full font-bold"
                    style={{ background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))', border: 'none', color: 'white' }}
                    onClick={() => navigate('/create-reel')}
                  >
                    + {t('newReel')}
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-0.5">
                {reels.map(reel => (
                  <div key={reel.id} className="aspect-[9/16] max-h-40 bg-black overflow-hidden group relative cursor-pointer"
                    onClick={() => navigate(`/reels?r=${reel.id}`)}>
                    {reel.thumbnail_url ? (
                      <img src={reel.thumbnail_url} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                    ) : (
                      <video src={reel.video_url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                    )}
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <Play className="w-6 h-6 text-white drop-shadow-lg" fill="white" />
                    </div>
                    <div className="absolute bottom-1 right-1.5 flex items-center gap-1 bg-black/40 rounded-full px-1.5 py-0.5">
                      <Play className="w-3 h-3 text-white" fill="white" />
                      <span className="text-white text-[10px] font-semibold">{reel.views_count || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </MobileLayout>
  );
};

export default ProfilePage;

