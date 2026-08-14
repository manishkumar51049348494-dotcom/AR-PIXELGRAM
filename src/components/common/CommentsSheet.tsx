import React, { useState, useEffect, useRef } from 'react';
import { X, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getComments, addComment, createNotification } from '@/services/api';
import type { Comment } from '@/types/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';

interface CommentsSheetProps {
  postId: string;
  postOwnerId: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Keyboard-aware comments sheet.
 * Phone par keyboard khulte hi input screen ke neeche chala jata tha. Ab
 * visualViewport se keyboard ki height nikaal kar sheet ko upar utha dete hain,
 * isliye "Add a comment…" hamesha keyboard ke thik uper dikhta hai.
 */
const CommentsSheet: React.FC<CommentsSheetProps> = ({ postId, postOwnerId, open, onClose }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      getComments(postId).then(setComments);
    }
  }, [postId, open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  // Keyboard height track karo (iOS + Android dono par visualViewport milta hai).
  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardInset(inset);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      setKeyboardInset(0);
    };
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !user) return;
    setLoading(true);
    try {
      const text = content.trim();
      await addComment(postId, text);
      setContent('');
      toast.success('Comment added');
      if (postOwnerId !== user.id) {
        createNotification(postOwnerId, 'comment', user.id, postId).catch(() => {});
      }
      const updated = await getComments(postId);
      setComments(updated);
      // Keyboard khula rakho taki user lagataar comment kar sake.
      inputRef.current?.focus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Comment save nahi hua');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative w-full max-w-lg bg-card rounded-t-2xl flex flex-col"
        style={{
          // Keyboard ke barabar upar shift + utni hi height kam.
          bottom: keyboardInset,
          maxHeight: `calc(75vh - ${keyboardInset}px)`,
          height: keyboardInset > 0 ? `calc(75vh - ${keyboardInset}px)` : undefined,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h3 className="font-semibold text-foreground">Comments</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {comments.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">No comments yet. Be the first!</p>
          ) : (
            comments.map(comment => (
              <div key={comment.id} className="flex gap-3">
                {comment.profile?.avatar_url ? (
                  <img src={comment.profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-primary font-bold text-xs">{comment.profile?.username?.[0]?.toUpperCase()}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="text-sm font-semibold text-foreground">{comment.profile?.username}</span>
                    {comment.profile?.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-primary" />}
                    <span className="text-xs text-muted-foreground ml-1">{new Date(comment.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-foreground text-pretty">{comment.content}</p>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Comment input — hamesha keyboard ke uper */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 px-4 py-3 border-t border-border bg-card shrink-0"
          style={{ paddingBottom: keyboardInset > 0 ? 12 : 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <Input
            ref={inputRef}
            placeholder="Add a comment…"
            value={content}
            onChange={e => setContent(e.target.value)}
            onFocus={() => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 250)}
            className="flex-1 h-10"
            maxLength={200}
          />
          <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={!content.trim() || loading}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default CommentsSheet;
