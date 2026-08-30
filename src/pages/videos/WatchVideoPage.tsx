import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, ThumbsUp, MessageCircle, Share2, Trash2, Eye, Loader2, Lock, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  getVideoById,
  getVideosFeed,
  getVideoComments,
  addVideoComment,
  toggleVideoLike,
  recordVideoView,
  deleteVideo,
  formatVideoViews,
  formatDuration,
  timeAgoHi,
  type AppVideo,
  type AppVideoComment,
} from '@/services/videos';

/** YouTube jaisa watch page — player, views, like, comment, description, related. */
const WatchVideoPage: React.FC = () => {
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [video, setVideo] = useState<AppVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [related, setRelated] = useState<AppVideo[]>([]);
  const [comments, setComments] = useState<AppVideoComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [descOpen, setDescOpen] = useState(false);
  const viewCountedRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!videoId) return;
    setLoading(true);
    try {
      const v = await getVideoById(videoId);
      setVideo(v);
      if (v) {
        setLiked(!!v.is_liked);
        setLikesCount(v.likes_count || 0);
        const [cs, feed] = await Promise.all([getVideoComments(v.id), getVideosFeed(12, 0)]);
        setComments(cs);
        setRelated(feed.filter((r) => r.id !== v.id).slice(0, 8));
      }
    } catch (e) {
      console.error('watch load failed', e);
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => { load(); }, [load]);

  // View sirf ek baar count karo (thoda dekhne ke baad)
  useEffect(() => {
    if (!video || viewCountedRef.current === video.id) return;
    const t = setTimeout(() => {
      viewCountedRef.current = video.id;
      setVideo((prev) => (prev ? { ...prev, views_count: prev.views_count + 1 } : prev));
      recordVideoView(video.id).catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, [video]);

  const handleLike = async () => {
    if (!user || !video) { toast.error('Like karne ke liye login karein'); return; }
    const was = liked;
    setLiked(!was);
    setLikesCount((c) => (was ? c - 1 : c + 1));
    try {
      await toggleVideoLike(video.id, user.id, was);
    } catch {
      setLiked(was);
      setLikesCount((c) => (was ? c + 1 : c - 1));
      toast.error('Like save nahi hua');
    }
  };

  const handleComment = async () => {
    if (!video || !commentText.trim()) return;
    if (!user) { toast.error('Comment karne ke liye login karein'); return; }
    setPosting(true);
    try {
      await addVideoComment(video.id, commentText.trim());
      setCommentText('');
      setComments(await getVideoComments(video.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Comment post nahi hua');
    } finally {
      setPosting(false);
    }
  };

  const handleShare = async () => {
    if (!video) return;
    const url = `${window.location.origin}/videos/${video.id}`;
    try {
      if (navigator.share) await navigator.share({ title: video.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copy ho gaya');
      }
    } catch { /* cancelled */ }
  };

  const handleDelete = async () => {
    if (!video) return;
    try {
      await deleteVideo(video.id);
      toast.success('Video delete ho gaya');
      navigate('/videos', { replace: true });
    } catch {
      toast.error('Delete nahi hua');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-3 px-6 text-center">
        <Lock className="w-8 h-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">यह video उपलब्ध नहीं है या private है।</p>
        <button onClick={() => navigate('/videos')} className="text-sm font-bold text-primary">
          वीडियो पर वापस जाएं
        </button>
      </div>
    );
  }

  const isOwner = user?.id === video.user_id;

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      {/* Player */}
      <div className="relative w-full bg-black shrink-0" style={{ aspectRatio: '16 / 9' }}>
        <video
          src={video.video_url}
          poster={video.thumbnail_url || undefined}
          className="absolute inset-0 w-full h-full"
          controls
          autoPlay
          playsInline
          preload="auto"
        />
        <button
          onClick={() => navigate(-1)}
          className="absolute top-2 left-2 w-9 h-9 rounded-full bg-black/50 flex items-center justify-center"
          aria-label="वापस"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Details */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        <div>
          <h1 className="text-base font-bold text-foreground">{video.title}</h1>
          <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <Eye className="w-3 h-3" />
            {formatVideoViews(video.views_count)} views · {timeAgoHi(video.created_at)}
            {video.visibility === 'private' && ' · Private'}
            {formatDuration(video.duration_sec) && ` · ${formatDuration(video.duration_sec)}`}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold border ${
              liked ? 'border-primary text-primary bg-primary/10' : 'border-border text-foreground'
            }`}
          >
            <ThumbsUp className="w-4 h-4" /> {likesCount}
          </button>
          <span className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold border border-border text-foreground">
            <MessageCircle className="w-4 h-4" /> {comments.length}
          </span>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold border border-border text-foreground"
          >
            <Share2 className="w-4 h-4" /> Share
          </button>
          {isOwner && (
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold border border-destructive/40 text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Uploader */}
        <Link to={`/profile/${video.user_id}`} className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={video.profile?.avatar_url || undefined} />
            <AvatarFallback>{(video.profile?.username || '?').slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground truncate">
              {video.profile?.full_name || video.profile?.username || 'user'}
            </p>
            <p className="text-xs text-muted-foreground truncate">@{video.profile?.username || 'user'}</p>
          </div>
        </Link>

        {/* Description */}
        {video.description && (
          <button
            type="button"
            onClick={() => setDescOpen((o) => !o)}
            className="w-full text-left rounded-2xl bg-muted/60 px-3 py-3"
          >
            <p className={`text-sm text-foreground whitespace-pre-wrap ${descOpen ? '' : 'line-clamp-3'}`}>
              {video.description}
            </p>
            <span className="text-xs font-bold text-muted-foreground mt-1 inline-block">
              {descOpen ? 'कम दिखाएं' : 'और दिखाएं'}
            </span>
          </button>
        )}

        {/* Comments */}
        <div>
          <p className="text-sm font-bold text-foreground mb-2">{comments.length} Comments</p>
          <div className="flex items-center gap-2 mb-3">
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Comment likhein…"
              className="h-10"
              onKeyDown={(e) => { if (e.key === 'Enter') handleComment(); }}
            />
            <button
              onClick={handleComment}
              disabled={posting || !commentText.trim()}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white disabled:opacity-50 shrink-0"
              style={{ background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))' }}
              aria-label="Comment भेजें"
            >
              {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>

          {comments.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">अभी कोई comment नहीं है।</p>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarImage src={c.profile?.avatar_url || undefined} />
                    <AvatarFallback>{(c.profile?.username || '?').slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground">
                      @{c.profile?.username || 'user'}{' '}
                      <span className="font-normal text-muted-foreground">{timeAgoHi(c.created_at)}</span>
                    </p>
                    <p className="text-sm text-foreground whitespace-pre-wrap break-words">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div className="pb-8">
            <p className="text-sm font-bold text-foreground mb-2">और वीडियो</p>
            <div className="space-y-3">
              {related.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => navigate(`/videos/${r.id}`)}
                  className="w-full flex gap-3 text-left"
                >
                  <div className="relative w-32 shrink-0 rounded-xl overflow-hidden bg-muted" style={{ aspectRatio: '16 / 9' }}>
                    {r.thumbnail_url ? (
                      <img src={r.thumbnail_url} alt={r.title} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <video src={r.video_url} className="absolute inset-0 w-full h-full object-cover" muted preload="metadata" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground line-clamp-2">{r.title}</p>
                    <p className="text-xs text-muted-foreground truncate">@{r.profile?.username || 'user'}</p>
                    <p className="text-xs text-muted-foreground">{formatVideoViews(r.views_count)} views</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WatchVideoPage;
