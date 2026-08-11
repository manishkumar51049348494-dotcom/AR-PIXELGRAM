import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Heart, MessageCircle, Share2, Volume2, VolumeX, MoreVertical, Trash2, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getReelsFeed, getReelById, recordReelView, toggleReelLike, deleteReel, createNotification, getReelCommentsCount, type Reel } from '@/services/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ReelCommentsSheet from '@/components/common/ReelCommentsSheet';
import BottomNav from '@/components/layouts/BottomNav';

// Only render video for active ± 1 reels — prevents loading all videos at once
const RENDER_WINDOW = 1;

const ReelCard: React.FC<{
  reel: Reel;
  isActive: boolean;
  isNear: boolean; // within render window — mount video element
  onDelete: (id: string) => void;
  autoOpenComments?: boolean;
}> = ({ reel, isActive, isNear, onDelete, autoOpenComments }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  const [liked, setLiked] = useState(reel.is_liked || false);
  const [likesCount, setLikesCount] = useState(reel.likes_count || 0);
  const [commentsCount, setCommentsCount] = useState(reel.comments_count || 0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const isOwner = user?.id === reel.user_id;

  // Deep-link from a notification: "reel X, open comments"
  useEffect(() => {
    if (autoOpenComments) setCommentsOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenComments, reel.id]);

  useEffect(() => {
    let alive = true;
    getReelCommentsCount(reel.id).then(c => { if (alive) setCommentsCount(c); });
    return () => { alive = false; };
  }, [reel.id]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      // Wait for enough data before playing to avoid stutter
      const tryPlay = () => v.play().catch(() => {});
      if (v.readyState >= 3) {
        tryPlay();
      } else {
        v.addEventListener('canplay', tryPlay, { once: true });
        return () => v.removeEventListener('canplay', tryPlay);
      }
    } else {
      v.pause();
      v.currentTime = 0;
    }
  }, [isActive]);

  // Count a view once this reel has actually been watched for a moment
  // (avoids counting a quick scroll-past as a "view").
  const [viewsCount, setViewsCount] = useState(reel.views_count || 0);
  const viewRecordedRef = useRef(false);
  useEffect(() => {
    if (!isActive || viewRecordedRef.current) return;
    const t = setTimeout(() => {
      viewRecordedRef.current = true;
      setViewsCount(c => c + 1);
      recordReelView(reel.id).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [isActive, reel.id]);

  const handleLike = async () => {
    if (!user) return;
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikesCount(prev => wasLiked ? prev - 1 : prev + 1);
    try {
      await toggleReelLike(reel.id, user.id, wasLiked);
      // notify reel owner when we newly like
      if (!wasLiked && reel.user_id !== user.id) {
        createNotification(reel.user_id, 'reel_like', user.id, reel.id).catch(() => {});
      }
    } catch {
      setLiked(wasLiked);
      setLikesCount(prev => wasLiked ? prev + 1 : prev - 1);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/reels?r=${reel.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'AR Pixelgram Reel', url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied!');
      }
    } catch { /* user cancelled */ }
  };

  const handleDelete = async () => {
    try {
      await deleteReel(reel.id);
      toast.success('Reel deleted');
      onDelete(reel.id);
    } catch {
      toast.error('Failed to delete reel');
    }
  };

  const profile = reel.profile as { username: string; full_name: string; avatar_url: string; is_verified: boolean; user_id: string } | undefined;

  return (
    <div className="relative w-full h-full bg-black select-none">
      {/* Only mount video element when near active — prevents loading 30 videos at once */}
      {isNear ? (
        <video
          ref={videoRef}
          src={reel.video_url}
          className="absolute inset-0 w-full h-full object-cover"
          loop
          playsInline
          muted={muted}
          preload={isActive ? 'auto' : 'none'}
          onClick={() => {
            const v = videoRef.current;
            if (!v) return;
            v.paused ? v.play().catch(() => {}) : v.pause();
          }}
        />
      ) : (
        // Placeholder for far-away reels — no network load
        <div className="absolute inset-0 bg-black" />
      )}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />

      {/* Top bar — back button + REELS label + owner menu */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 pt-safe" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}>
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <div className="flex items-center gap-1 bg-black/30 backdrop-blur-sm rounded-full px-3 py-1">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-white text-xs font-bold tracking-widest">{t('reels').toUpperCase()}</span>
        </div>
        {isOwner ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-9 h-9 rounded-full bg-black/30 backdrop-blur flex items-center justify-center">
                <MoreVertical className="w-4 h-4 text-white" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDelete} className="text-destructive gap-2">
                <Trash2 className="w-4 h-4" /> {t('delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : <div className="w-9" />}
      </div>

      {/* Right side actions */}
      <div className="absolute right-4 bottom-36 flex flex-col items-center gap-5">
        {/* Avatar */}
        <button onClick={() => navigate(`/profile/${profile?.user_id}`)}>
          <div className="relative">
            <Avatar className="w-12 h-12 border-2 border-white">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                {profile?.username?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-primary flex items-center justify-center border-2 border-black">
              <Plus className="w-3 h-3 text-white" />
            </div>
          </div>
        </button>

        {/* Like */}
        <button onClick={handleLike} className="flex flex-col items-center gap-1">
          <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${liked ? 'scale-110' : ''}`}>
            <Heart className={`w-7 h-7 transition-all ${liked ? 'fill-red-500 text-red-500 scale-110' : 'text-white'}`} />
          </div>
          <span className="text-white text-xs font-semibold">{likesCount > 999 ? `${(likesCount/1000).toFixed(1)}k` : likesCount}</span>
        </button>

        {/* Comment */}
        <button className="flex flex-col items-center gap-1" onClick={() => setCommentsOpen(true)}>
          <div className="w-11 h-11 rounded-full flex items-center justify-center">
            <MessageCircle className="w-7 h-7 text-white" />
          </div>
          <span className="text-white text-xs font-semibold">{commentsCount > 999 ? `${(commentsCount/1000).toFixed(1)}k` : commentsCount}</span>
        </button>

        {/* Share */}
        <button className="flex flex-col items-center gap-1" onClick={handleShare}>
          <div className="w-11 h-11 rounded-full flex items-center justify-center">
            <Share2 className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-xs font-semibold">{t('share')}</span>
        </button>

        {/* Mute */}
        <button onClick={() => setMuted(!muted)} className="w-11 h-11 rounded-full bg-black/40 backdrop-blur flex items-center justify-center">
          {muted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
        </button>
      </div>

      {/* Bottom info */}
      <div className="absolute left-0 right-16 bottom-24 px-4 space-y-2">
        <button onClick={() => navigate(`/profile/${profile?.user_id}`)} className="flex items-center gap-2">
          <span className="text-white font-bold text-sm">@{profile?.username}</span>
          {profile?.is_verified && <span className="text-primary text-xs">✓</span>}
        </button>
        {reel.caption && (
          <p className="text-white/90 text-sm line-clamp-2 leading-relaxed">{reel.caption}</p>
        )}
        {isOwner && (
          <p className="text-white/70 text-xs flex items-center gap-1">
            👁 {viewsCount > 999 ? `${(viewsCount / 1000).toFixed(1)}k` : viewsCount} views
          </p>
        )}
        {/* Animated music note */}
        <div className="flex items-center gap-2 mt-1">
          <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur flex items-center justify-center animate-spin-slow">
            <span className="text-xs">♪</span>
          </div>
          <span className="text-white/80 text-xs">AR Pixelgram Reel</span>
        </div>
      </div>

      {/* Comments sheet */}
      <ReelCommentsSheet
        reelId={reel.id}
        reelOwnerId={reel.user_id}
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        onCountChange={setCommentsCount}
      />
    </div>
  );
};

const ReelsPage: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0); // live drag in px
  const [isSnapping, setIsSnapping] = useState(false); // CSS transition on/off
  const [openCommentsFor, setOpenCommentsFor] = useState<string | null>(null);

  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const isAnimating = useRef(false);
  const reelsCountRef = useRef(0);

  const loadReels = useCallback(async () => {
    try {
      const targetId = searchParams.get('r');
      const wantsComments = searchParams.get('comments') === '1';
      let data = await getReelsFeed(10);

      // Deep link from a notification/share link — if that reel isn't in the
      // first page, fetch it directly and pin it to the front.
      if (targetId && !data.some(r => r.id === targetId)) {
        const target = await getReelById(targetId).catch(() => null);
        if (target) data = [target, ...data];
      }

      setReels(data);
      reelsCountRef.current = data.length;

      if (targetId) {
        const idx = data.findIndex(r => r.id === targetId);
        if (idx >= 0) {
          setActiveIndex(idx);
          if (wantsComments) setOpenCommentsFor(targetId);
        }
        // Clear the query params so it doesn't re-trigger on refresh/back-nav
        setSearchParams({}, { replace: true });
      }
    } catch {
      toast.error('Failed to load reels');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadReels(); }, [loadReels]);

  // Keyboard support for desktop
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isAnimating.current) return;
      if (e.key === 'ArrowDown') snapTo(1);
      if (e.key === 'ArrowUp') snapTo(-1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const snapTo = (direction: number) => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    setIsSnapping(true);
    setDragOffset(0);
    setActiveIndex(prev => {
      const next = Math.max(0, Math.min(reelsCountRef.current - 1, prev + direction));
      return next;
    });
    setTimeout(() => { isAnimating.current = false; }, 350);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isAnimating.current) return;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    setIsSnapping(false); // disable transition while dragging
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isAnimating.current) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    // Resist at boundaries
    setActiveIndex(prev => {
      const atTop = prev === 0 && dy > 0;
      const atBottom = prev === reelsCountRef.current - 1 && dy < 0;
      const resistance = (atTop || atBottom) ? 0.15 : 1;
      setDragOffset(dy * resistance);
      return prev;
    });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isAnimating.current) return;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    const dt = Math.max(1, Date.now() - touchStartTime.current);
    const velocity = Math.abs(dy) / dt;

    // Threshold: 60px drag OR fast flick ≥ 0.25px/ms
    const triggered = Math.abs(dy) > 60 || velocity >= 0.25;

    setIsSnapping(true);
    if (triggered && dy > 0) {
      snapTo(1);  // next
    } else if (triggered && dy < 0) {
      snapTo(-1); // prev
    } else {
      // Snap back to current
      isAnimating.current = true;
      setDragOffset(0);
      setTimeout(() => { isAnimating.current = false; }, 300);
    }
  };

  const handleDelete = (id: string) => {
    setReels(prev => {
      const next = prev.filter(r => r.id !== id);
      reelsCountRef.current = next.length;
      setActiveIndex(i => Math.min(i, Math.max(0, next.length - 1)));
      return next;
    });
  };

  if (loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center"
        style={{ background: 'linear-gradient(160deg, hsl(var(--p1)) 0%, hsl(var(--p2)) 100%)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-white/40 bg-white shadow-xl">
            <img src="https://miaoda-conversation-file.s3cdn.medo.dev/user-cjml2dkttc74/app-cjmldrzgvw1t/20260709/IMG_20260625_173359_866.jpg"
              alt="logo" className="w-full h-full object-cover" />
          </div>
          <div className="w-8 h-8 rounded-full border-2 border-white border-t-transparent animate-spin" />
          <p className="text-white/80 text-sm font-medium">{t('reels')} लोड हो रहे हैं...</p>
        </div>
      </div>
    );
  }

  if (!reels.length) {
    return (
      <div className="h-[100dvh] bg-black flex flex-col items-center justify-center gap-6 px-8">
        <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center">
          <span className="text-4xl">🎬</span>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-white text-xl font-bold">{t('noReelsYet')}</h2>
          <p className="text-white/50 text-sm">Be the first to create a reel!</p>
        </div>
        <button
          onClick={() => navigate('/create-reel')}
          className="px-6 py-3 rounded-full font-bold text-white"
          style={{ background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))' }}
        >
          + {t('newReel')}
        </button>
      </div>
    );
  }

  return (
    <div
      className="h-[100dvh] overflow-hidden bg-black touch-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slide rail — follows finger live, then snaps */}
      <div
        className="flex flex-col"
        style={{
          height: `${reels.length * 100}dvh`,
          transform: `translateY(calc(-${activeIndex * 100}dvh + ${dragOffset}px))`,
          transition: isSnapping ? 'transform 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none',
          willChange: 'transform',
        }}
      >
        {reels.map((reel, idx) => {
          const isActive = idx === activeIndex;
          const isNear = Math.abs(idx - activeIndex) <= RENDER_WINDOW;
          return (
            <div key={reel.id} style={{ height: '100dvh', flexShrink: 0 }} className="relative w-full">
              <ReelCard
                reel={reel}
                isActive={isActive}
                isNear={isNear}
                onDelete={handleDelete}
                autoOpenComments={openCommentsFor === reel.id}
              />
            </div>
          );
        })}
      </div>
      <BottomNav overlay />
    </div>
  );
};

export default ReelsPage;
