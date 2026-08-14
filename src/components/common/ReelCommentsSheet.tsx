import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, CornerDownRight, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  getReelComments, addReelComment, deleteReelComment, createNotification,
  type ReelComment,
} from '@/services/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Props {
  reelId: string;
  reelOwnerId: string;
  open: boolean;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}

const ReelCommentsSheet: React.FC<Props> = ({ reelId, reelOwnerId, open, onClose, onCountChange }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState<ReelComment | null>(null);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refresh = async () => {
    const c = await getReelComments(reelId);
    setComments(c);
    onCountChange?.(c.length);
  };

  useEffect(() => { if (open) refresh(); /* eslint-disable-next-line */ }, [reelId, open]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [comments.length]);

  // Group: top-level + replies
  const grouped = useMemo(() => {
    const parents = comments.filter(c => !c.parent_id);
    const byParent: Record<string, ReelComment[]> = {};
    for (const c of comments) {
      if (c.parent_id) (byParent[c.parent_id] ||= []).push(c);
    }
    return parents.map(p => ({ parent: p, replies: byParent[p.id] || [] }));
  }, [comments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !user) return;
    setLoading(true);
    try {
      const text = content.trim();
      await addReelComment(reelId, text, replyTo?.id || null);
      setContent('');
      const wasReply = replyTo;
      setReplyTo(null);
      toast.success(wasReply ? 'Reply added' : 'Comment added');
      // Notification bhejna optional hai — fail ho to comment fail nahi hona chahiye.
      if (wasReply && wasReply.user_id !== user.id) {
        createNotification(wasReply.user_id, 'comment_reply', user.id, reelId, wasReply.id, text.slice(0, 120)).catch(() => {});
      } else if (!wasReply && reelOwnerId !== user.id) {
        createNotification(reelOwnerId, 'reel_comment', user.id, reelId, undefined, text.slice(0, 120)).catch(() => {});
      }
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Comment save nahi hua');
    } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    await deleteReelComment(id);
    await refresh();
  };

  const goToProfile = (uid?: string) => { if (uid) { onClose(); navigate(`/profile/${uid}`); } };

  if (!open) return null;

  const Row: React.FC<{ c: ReelComment; isReply?: boolean }> = ({ c, isReply }) => (
    <div className={cn('flex gap-3', isReply && 'ml-10 mt-2')}>
      <button onClick={() => goToProfile(c.profile?.user_id)} className="shrink-0">
        {c.profile?.avatar_url ? (
          <img src={c.profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-primary font-bold text-xs">{c.profile?.username?.[0]?.toUpperCase()}</span>
          </div>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-0.5">
          <button onClick={() => goToProfile(c.profile?.user_id)} className="text-sm font-semibold text-foreground hover:underline">
            {c.profile?.username}
          </button>
          {c.profile?.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-primary" />}
          <span className="text-xs text-muted-foreground ml-1">{new Date(c.created_at).toLocaleDateString()}</span>
        </div>
        <p className="text-sm text-foreground break-words">{c.content}</p>
        <div className="flex items-center gap-3 mt-1">
          <button
            className="text-xs text-muted-foreground hover:text-primary"
            onClick={() => setReplyTo(isReply ? comments.find(x => x.id === c.parent_id) || c : c)}
          >
            Reply
          </button>
          {user?.id === c.user_id && (
            <button className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1" onClick={() => handleDelete(c.id)}>
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // Render via portal directly into document.body so the sheet is not clipped
  // or positioned relative to a transformed parent (the reels slide rail uses
  // translateY, which turns position:fixed into relative-to-parent).
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center"
      onTouchStart={e => e.stopPropagation()}
      onTouchMove={e => e.stopPropagation()}
      onTouchEnd={e => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card rounded-t-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground">Comments · {comments.length}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {grouped.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">Sabse pehle comment karo!</p>
          ) : grouped.map(g => (
            <div key={g.parent.id}>
              <Row c={g.parent} />
              {g.replies.map(r => <Row key={r.id} c={r} isReply />)}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {replyTo && (
          <div className="px-4 py-2 border-t border-border bg-muted/40 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
              <CornerDownRight className="w-3 h-3 shrink-0" />
              <span className="truncate">Reply @{replyTo.profile?.username}</span>
            </div>
            <button onClick={() => setReplyTo(null)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        )}

        {user ? (
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 px-4 py-3 border-t border-border"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
          >
            <Input
              placeholder={replyTo ? `Reply to ${replyTo.profile?.username}…` : 'Add a comment…'}
              value={content}
              onChange={e => setContent(e.target.value)}
              className="flex-1 h-10"
              maxLength={500}
            />
            <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={!content.trim() || loading}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        ) : (
          <div
            className="px-4 py-3 border-t border-border bg-muted/40 text-center"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
          >
            <button onClick={() => { onClose(); navigate('/login'); }} className="text-sm font-semibold text-primary hover:underline">
              Sign in to comment
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default ReelCommentsSheet;
