import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '@/components/layouts/MobileLayout';
import { useAuth } from '@/contexts/AuthContext';
import { withTimeout } from '@/lib/withTimeout';
import {
  getFeedStories, getAllPosts, createStory, uploadImage, uploadVideo, deleteStory,
  toggleStoryLike, isStoryLiked, getStoryLikers, getStoryViewers, recordStoryView, sendMessage, createNotification,
  type StoryViewer
} from '@/services/api';
import type { Story, Profile, Post } from '@/types/types';
import PostCard from '@/components/common/PostCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X, ChevronLeft, ChevronRight, Trash2, ImagePlus, Film, Loader2, Share2, Heart, Eye, Send, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

function groupStoriesByUser(stories: Story[]): Record<string, { profile: Profile; stories: Story[] }> {
  const groups: Record<string, { profile: Profile; stories: Story[] }> = {};
  for (const story of stories) {
    if (!story.profile) continue;
    const uid = story.user_id;
    if (!groups[uid]) groups[uid] = { profile: story.profile, stories: [] };
    groups[uid].stories.push(story);
  }
  return groups;
}

const StoriesPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [storyIndex, setStoryIndex] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [caption, setCaption] = useState('');
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [replyText, setReplyText] = useState('');
  const [showReply, setShowReply] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [showLikers, setShowLikers] = useState(false);
  const [likers, setLikers] = useState<Profile[]>([]);
  const [loadingLikers, setLoadingLikers] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<StoryViewer[]>([]);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const videoViewerRef = useRef<HTMLVideoElement>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsPage, setPostsPage] = useState(0);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const POSTS_PAGE_SIZE = 10;

  useEffect(() => {
    if (!user) return;
    withTimeout(getFeedStories(user.id), 20000)
      .then(s => { setStories(s); })
      .catch((e) => { console.error('stories load failed', e); })
      .finally(() => { setLoading(false); });
  }, [user]);

  // Load posts feed (shown below the stories row)
  useEffect(() => {
    if (!user) return;
    setPostsLoading(true);
    withTimeout(getAllPosts(0, POSTS_PAGE_SIZE, user.id), 20000)
      .then(p => { setPosts(p); setPostsPage(0); setHasMorePosts(p.length === POSTS_PAGE_SIZE); })
      .catch(e => { console.error('posts load failed', e); })
      .finally(() => setPostsLoading(false));
  }, [user]);

  const loadMorePosts = async () => {
    if (!user || loadingMore || !hasMorePosts) return;
    setLoadingMore(true);
    try {
      const next = postsPage + 1;
      const more = await withTimeout(getAllPosts(next, POSTS_PAGE_SIZE, user.id), 20000);
      setPosts(prev => {
        const seen = new Set(prev.map(p => p.id));
        return [...prev, ...more.filter(p => !seen.has(p.id))];
      });
      setPostsPage(next);
      setHasMorePosts(more.length === POSTS_PAGE_SIZE);
    } catch (e) {
      console.error('load more posts failed', e);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleDeletePost = (postId: string) => setPosts(prev => prev.filter(p => p.id !== postId));

  // Record view when story is opened + load liked state
  useEffect(() => {
    if (!viewerUserId || !user || !currentStory) return;
    recordStoryView(currentStory.id, user.id).catch(() => {});
    isStoryLiked(currentStory.id, user.id).then(v => setLikedMap(m => ({ ...m, [currentStory.id]: v })));
  }, [viewerUserId, storyIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Story viewer khule to page scroll lock — pura screen sirf story dikhe
  useEffect(() => {
    if (!viewerUserId) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [viewerUserId]);

  const openViewersSheet = async (storyId: string) => {
    setShowViewers(true);
    setLoadingViewers(true);
    const list = await getStoryViewers(storyId).catch(() => [] as StoryViewer[]);
    setViewers(list);
    setLoadingViewers(false);
  };

  const groups = groupStoriesByUser(stories);
  const groupKeys = Object.keys(groups);

  const openViewer = (uid: string) => { setViewerUserId(uid); setStoryIndex(0); setShowReply(false); };

  // Open a specific user's stories when arriving from a notification (/stories?u=<userId>)
  const openedFromQuery = useRef(false);
  useEffect(() => {
    if (openedFromQuery.current || loading) return;
    const uid = new URLSearchParams(window.location.search).get('u');
    if (uid && groups[uid]) {
      openedFromQuery.current = true;
      openViewer(uid);
    }
  }, [loading, stories]); // eslint-disable-line react-hooks/exhaustive-deps
  const closeViewer = () => { setViewerUserId(null); setShowReply(false); setShowViewers(false); };

  const viewerGroup = viewerUserId ? groups[viewerUserId] : null;
  const currentStory = viewerGroup?.stories[storyIndex];

  const nextStory = () => {
    if (!viewerGroup) return;
    setShowReply(false);
    if (storyIndex < viewerGroup.stories.length - 1) {
      setStoryIndex(i => i + 1);
    } else {
      const ci = groupKeys.indexOf(viewerUserId!);
      if (ci < groupKeys.length - 1) { setViewerUserId(groupKeys[ci + 1]); setStoryIndex(0); }
      else closeViewer();
    }
  };

  const prevStory = () => {
    if (storyIndex > 0) { setStoryIndex(i => i - 1); setShowReply(false); }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !currentStory) return;
    const prev = likedMap[currentStory.id] ?? false;
    setLikedMap(m => ({ ...m, [currentStory.id]: !prev }));
    await toggleStoryLike(currentStory.id, user.id, prev);
    setStories(s => s.map(st => st.id === currentStory.id ? { ...st, likes_count: (st.likes_count || 0) + (prev ? -1 : 1) } : st));
    // Notify story owner on new like
    if (!prev && currentStory.user_id !== user.id) {
      createNotification(currentStory.user_id, 'story_like', user.id).catch(() => {});
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !user || !currentStory) return;
    setSendingReply(true);
    await sendMessage(currentStory.user_id, `↩️ Story reply: ${replyText.trim()}`);
    if (currentStory.user_id !== user.id) {
      createNotification(currentStory.user_id, 'story_reply', user.id, undefined, undefined, replyText.trim().slice(0, 120)).catch(() => {});
    }
    toast.success('Reply भेजा गया!');
    setReplyText('');
    setShowReply(false);
    setSendingReply(false);
  };

  // 24h timer
  const getTimeLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return '0h';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (type === 'image' && file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10MB'); return; }
    if (type === 'video' && file.size > 100 * 1024 * 1024) { toast.error('Video must be under 100MB'); return; }
    setMediaFile(file);
    setMediaType(type);
    setMediaPreview(URL.createObjectURL(file));
  };

  const handleUploadStory = async () => {
    if (!mediaFile || !user) return;
    setUploading(true);
    try {
      let url: string;
      if (mediaType === 'video') {
        url = await uploadVideo('stories', mediaFile, user.id);
      } else {
        url = await uploadImage('stories', mediaFile, user.id);
      }
      await createStory(url, caption.trim() || null);
      toast.success(t('newStory') + ' posted! ✨');
      const updated = await getFeedStories(user.id);
      setStories(updated);
      setShowUpload(false);
      setMediaFile(null);
      setMediaPreview(null);
      setCaption('');
    } catch {
      toast.error('Failed to post story');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    await deleteStory(storyId);
    toast.success('Story deleted');
    setStories(prev => prev.filter(s => s.id !== storyId));
    closeViewer();
  };

  const currentIsVideo = currentStory && (
    (currentStory as Story & { media_type?: string }).media_type === 'video' ||
    currentStory.image_url?.match(/\.(mp4|mov|webm|avi)(\?|$)/i)
  );

  return (
    <MobileLayout>
      <div className="page-transition">
        {/* Stories row */}
        <div className="flex items-start gap-3 px-4 py-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {/* Add story button */}
          <button onClick={() => setShowUpload(true)} className="flex flex-col items-center gap-1.5 shrink-0 group">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-primary/50 flex items-center justify-center bg-primary/5 group-hover:bg-primary/10 transition-all group-hover:border-primary">
              <Plus className="w-6 h-6 text-primary transition-transform group-hover:scale-110" />
            </div>
            <span className="text-[11px] text-muted-foreground w-16 text-center truncate">{t('newStory')}</span>
          </button>

          {loading ? (
            <div className="flex items-center justify-center w-full py-2">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : groupKeys.map(uid => {
            const group = groups[uid];
            const p = group.profile;
            return (
              <button key={uid} onClick={() => openViewer(uid)} className="flex flex-col items-center gap-1.5 shrink-0">
                <div className="story-ring animate-pulse-glow">
                  <div className="story-ring-inner">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt={p.username} className="w-14 h-14 rounded-full object-cover" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-primary font-bold">{p.username[0]?.toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-[11px] text-foreground w-16 text-center truncate">{p.username}</span>
              </button>
            );
          })}
        </div>

        {groupKeys.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-8 text-center px-6">
            <span className="text-4xl mb-2">📖</span>
            <h3 className="font-semibold text-foreground mb-1">{t('noStoriesYet')}</h3>
            <p className="text-sm text-muted-foreground text-pretty">Follow people or add your own story!</p>
          </div>
        )}

        {/* Posts feed — below the stories row */}
        <div className="border-t border-border pt-2 pb-24">
          {postsLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <span className="text-5xl mb-4">🖼️</span>
              <h3 className="font-semibold text-foreground mb-1">अभी कोई पोस्ट नहीं</h3>
              <p className="text-sm text-muted-foreground">पहली पोस्ट अपलोड करें!</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {posts.map(post => (
                <PostCard key={post.id} post={post} onDelete={handleDeletePost} />
              ))}
              {hasMorePosts && (
                <div className="flex justify-center py-4">
                  <Button variant="outline" onClick={loadMorePosts} disabled={loadingMore}>
                    {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : 'और पोस्ट देखें'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Story viewer — pura full screen (bottom nav ke upar) */}
      {viewerUserId && currentStory && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center overscroll-none"
          style={{ height: '100dvh', width: '100vw' }}
          onClick={nextStory}
        >
          {/* Progress bars */}
          <div className="absolute top-0 left-0 right-0 flex gap-1 p-3 z-10">
            {viewerGroup!.stories.map((_, i) => (
              <div key={i} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
                <div className={`h-full bg-white transition-all ${i < storyIndex ? 'w-full' : i === storyIndex ? 'w-full' : 'w-0'}`} />
              </div>
            ))}
          </div>

          {/* User info */}
          <div className="absolute top-8 left-4 flex items-center gap-2 z-10" onClick={e => e.stopPropagation()}>
            <button onClick={() => { closeViewer(); navigate(`/profile/${viewerGroup!.profile.user_id}`); }}>
              {viewerGroup!.profile.avatar_url ? (
                <img src={viewerGroup!.profile.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-white" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">{viewerGroup!.profile.username[0]?.toUpperCase()}</span>
                </div>
              )}
            </button>
            <div>
              <button onClick={() => { closeViewer(); navigate(`/profile/${viewerGroup!.profile.user_id}`); }}>
                <p className="text-white font-semibold text-sm">{viewerGroup!.profile.username}</p>
              </button>
              <div className="flex items-center gap-2">
                <p className="text-white/70 text-xs">{new Date(currentStory.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                {currentStory.expires_at && (
                  <span className="flex items-center gap-0.5 text-white/60 text-[10px]">
                    <Clock className="w-2.5 h-2.5" />{getTimeLeft(currentStory.expires_at)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Close & Delete & Share */}
          <div className="absolute top-8 right-4 flex items-center gap-2 z-10" onClick={e => e.stopPropagation()}>
            {currentStory.user_id === user?.id && (
              <>
                {/* Views & Likes count for own story */}
                <div className="flex items-center gap-3 bg-black/30 backdrop-blur-sm rounded-full px-3 py-1.5">
                  <button
                    className="flex items-center gap-1 text-white text-xs"
                    onClick={() => openViewersSheet(currentStory.id)}
                  >
                    <Eye className="w-3 h-3" />{currentStory.views_count || 0}
                  </button>
                  <button
                    className="flex items-center gap-1 text-white text-xs"
                    onClick={async () => {
                      setShowLikers(true);
                      setLoadingLikers(true);
                      const list = await getStoryLikers(currentStory.id).catch(() => []);
                      setLikers(list);
                      setLoadingLikers(false);
                    }}
                  >
                    <Heart className="w-3 h-3" />{currentStory.likes_count || 0}
                  </button>
                </div>
                <button onClick={() => handleDeleteStory(currentStory.id)} className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={() => {
                const url = window.location.origin;
                if (navigator.share) navigator.share({ title: 'AR Pixelgram Story', url }).catch(() => {});
                else navigator.clipboard.writeText(url).then(() => toast.success('Link copied!')).catch(() => {});
              }}
              className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button onClick={closeViewer} className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Story media — image or video */}
          {currentIsVideo ? (
            <video
              ref={videoViewerRef}
              src={currentStory.image_url}
              className="absolute inset-0 w-full h-full object-contain bg-black"
              autoPlay
              loop
              playsInline
              muted={false}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <img src={currentStory.image_url} alt="" className="absolute inset-0 w-full h-full object-contain bg-black" />
          )}

          {/* Caption */}
          {currentStory.caption && (
            <div className="absolute bottom-24 left-4 right-4 text-center" onClick={e => e.stopPropagation()}>
              <p className="text-white font-medium text-sm bg-black/40 rounded-xl px-4 py-2 text-pretty">{currentStory.caption}</p>
            </div>
          )}

          {/* Apni story — "kitno ne dekha" bar (Instagram jaisa) */}
          {currentStory.user_id === user?.id && (
            <button
              className="absolute bottom-6 left-4 right-4 flex items-center gap-2 rounded-full bg-white/10 border border-white/25 px-4 py-2.5"
              onClick={e => { e.stopPropagation(); openViewersSheet(currentStory.id); }}
            >
              <Eye className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-medium">
                {currentStory.views_count || 0} ने देखा
              </span>
              <span className="ml-auto flex items-center gap-1 text-white/80 text-xs">
                <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" />{currentStory.likes_count || 0}
              </span>
            </button>
          )}

          {/* Bottom actions: Like + Reply (for other's stories) */}
          {currentStory.user_id !== user?.id && (
            <div className="absolute bottom-6 left-4 right-4 flex items-center gap-3" onClick={e => e.stopPropagation()}>
              {/* Reply input */}
              {showReply ? (
                <form onSubmit={handleSendReply} className="flex-1 flex items-center gap-2">
                  <Input
                    placeholder="Reply भेजें…"
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    className="flex-1 h-10 bg-white/10 border-white/30 text-white placeholder:text-white/60 rounded-full"
                    autoFocus
                  />
                  <Button type="submit" size="icon" className="h-10 w-10 rounded-full bg-white/20 shrink-0" disabled={!replyText.trim() || sendingReply}>
                    {sendingReply ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4 text-white" />}
                  </Button>
                  <button type="button" onClick={() => setShowReply(false)} className="p-2 rounded-full bg-white/20 text-white">
                    <X className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <>
                  <button
                    onClick={() => setShowReply(true)}
                    className="flex-1 h-10 rounded-full bg-white/10 border border-white/30 text-white/80 text-sm flex items-center px-4 gap-2"
                  >
                    <Send className="w-4 h-4" />Reply भेजें
                  </button>
                  <button onClick={handleLike} className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/10 border border-white/30">
                    <Heart className={`w-5 h-5 transition-all ${likedMap[currentStory.id] ? 'fill-red-500 text-red-500' : 'text-white'}`} />
                    <span className="text-white text-xs font-semibold">{currentStory.likes_count || 0}</span>
                  </button>
                </>
              )}
            </div>
          )}

          {storyIndex > 0 && (
            <button onClick={e => { e.stopPropagation(); prevStory(); }} className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/20 text-white">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); nextStory(); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/20 text-white">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>,
        document.body
      )}

      {/* Who liked this story — like Instagram's story likers list */}
      {showLikers && createPortal(
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowLikers(false)}>
          <div
            className="w-full max-w-lg bg-card rounded-t-3xl border-t border-border/40 overflow-y-auto"
            style={{ maxHeight: '70vh', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-foreground flex items-center gap-1.5">
                  <Heart className="w-4 h-4 fill-red-500 text-red-500" /> Liked by
                </h3>
                <button onClick={() => setShowLikers(false)} className="p-1.5 rounded-full hover:bg-muted/60">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              {loadingLikers ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : likers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No likes yet</p>
              ) : (
                <div className="space-y-3">
                  {likers.map(liker => (
                    <button
                      key={liker.user_id}
                      className="flex items-center gap-3 w-full text-left"
                      onClick={() => { setShowLikers(false); closeViewer(); navigate(`/profile/${liker.user_id}`); }}
                    >
                      {liker.avatar_url ? (
                        <img src={liker.avatar_url} alt={liker.username} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-primary font-bold text-sm">{liker.username[0]?.toUpperCase()}</span>
                        </div>
                      )}
                      <span className="font-semibold text-sm text-foreground">{liker.username}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Kisne dekha — viewers list (name + profile photo + like status) */}
      {showViewers && createPortal(
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowViewers(false)}>
          <div
            className="w-full max-w-lg bg-card rounded-t-3xl border-t border-border/40 overflow-y-auto"
            style={{ maxHeight: '75vh', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-foreground flex items-center gap-1.5">
                  <Eye className="w-4 h-4" /> Viewers ({viewers.length})
                </h3>
                <button onClick={() => setShowViewers(false)} className="p-1.5 rounded-full hover:bg-muted/60">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              {loadingViewers ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : viewers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">अभी किसी ने नहीं देखा</p>
              ) : (
                <div className="space-y-3">
                  {viewers.map(v => (
                    <div key={v.profile.user_id} className="flex items-center gap-3">
                      <button
                        className="flex items-center gap-3 flex-1 text-left"
                        onClick={() => { setShowViewers(false); closeViewer(); navigate(`/profile/${v.profile.user_id}`); }}
                      >
                        {v.profile.avatar_url ? (
                          <img src={v.profile.avatar_url} alt={v.profile.username} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-primary font-bold text-sm">{v.profile.username[0]?.toUpperCase()}</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">{v.profile.username}</p>
                          {v.profile.full_name && <p className="text-xs text-muted-foreground truncate">{v.profile.full_name}</p>}
                        </div>
                      </button>
                      {v.liked && <Heart className="w-4 h-4 fill-red-500 text-red-500 shrink-0" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Upload story modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div
            className="w-full max-w-lg bg-card rounded-t-3xl border-t border-border/40 overflow-y-auto"
            style={{
              maxHeight: '90vh',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
            }}
          >
            <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground">{t('newStory')}</h3>
              <button onClick={() => { setShowUpload(false); setMediaFile(null); setMediaPreview(null); }} className="p-1.5 rounded-full hover:bg-muted/60">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Media type toggle */}
            {!mediaPreview && (
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col items-center justify-center h-32 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors gap-2">
                  <ImagePlus className="w-8 h-8 text-primary" />
                  <span className="text-sm font-medium text-primary">{t('uploadImage')}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleMediaSelect(e, 'image')} />
                </label>
                <label className="flex flex-col items-center justify-center h-32 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors gap-2"
                  style={{ borderColor: 'hsl(var(--p2) / 0.4)', backgroundColor: 'hsl(var(--p2) / 0.05)' }}>
                  <Film className="w-8 h-8" style={{ color: 'hsl(var(--p2))' }} />
                  <span className="text-sm font-medium" style={{ color: 'hsl(var(--p2))' }}>{t('uploadVideo')}</span>
                  <input type="file" accept="video/*" className="hidden" onChange={e => handleMediaSelect(e, 'video')} />
                </label>
              </div>
            )}

            {/* Preview */}
            {mediaPreview && (
              <div className="relative aspect-[9/16] max-h-52 rounded-2xl overflow-hidden bg-black mx-auto">
                {mediaType === 'video' ? (
                  <video src={mediaPreview} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                ) : (
                  <img src={mediaPreview} alt="Preview" className="w-full h-full object-cover" />
                )}
                <button onClick={() => { setMediaFile(null); setMediaPreview(null); }} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-white text-xs font-medium"
                  style={{ background: mediaType === 'video' ? 'hsl(var(--p2) / 0.85)' : 'hsl(var(--p1) / 0.85)' }}>
                  {mediaType === 'video' ? '🎬 Video' : '📷 Photo'}
                </div>
              </div>
            )}

            <input
              type="text"
              placeholder={t('caption') + ' (optional)'}
              value={caption}
              onChange={e => setCaption(e.target.value)}
              maxLength={100}
              className="w-full h-10 px-3 rounded-xl border border-border bg-input text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />

            {/* Publish button — always visible */}
            <Button
              className="w-full h-12 font-bold rounded-xl text-white border-0"
              style={{ background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))' }}
              onClick={handleUploadStory}
              disabled={uploading || !mediaFile}
            >
              {uploading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Posting…</> : `✨ ${t('publish')}`}
            </Button>
            </div>
          </div>
        </div>
      )}
    </MobileLayout>
  );
};
export default StoriesPage;
