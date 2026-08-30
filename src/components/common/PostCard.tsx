import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Bookmark, Share2, MoreHorizontal, BadgeCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { likePost, unlikePost, savePost, unsavePost } from '@/services/api';
import { createNotification } from '@/services/api';
import type { Post, Comment } from '@/types/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import CommentsSheet from '@/components/common/CommentsSheet';
import { retryMediaOnError } from '@/lib/mediaUrl';

interface PostCardProps {
  post: Post;
  onDelete?: (postId: string) => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, onDelete }) => {
  const { user, profile: myProfile } = useAuth();
  const [liked, setLiked] = useState(post.is_liked || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [saved, setSaved] = useState(post.is_saved || false);
  const [showComments, setShowComments] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const [showMenu, setShowMenu] = useState(false);

  const isOwner = user?.id === post.user_id;

  const handleLike = async () => {
    if (!user) return;
    if (liked) {
      setLiked(false);
      setLikesCount(c => c - 1);
      await unlikePost(post.id, user.id);
    } else {
      setLiked(true);
      setLikesCount(c => c + 1);
      await likePost(post.id);
      if (post.user_id !== user.id) {
        await createNotification(post.user_id, 'like', user.id, post.id);
      }
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (saved) {
      setSaved(false);
      await unsavePost(post.id, user.id);
      toast.success('Removed from saved');
    } else {
      setSaved(true);
      await savePost(post.id);
      toast.success('Post saved!');
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.origin + `/post/${post.id}`);
    toast.success('Link copied!');
  };

  const handleDelete = async () => {
    if (onDelete) onDelete(post.id);
    setShowMenu(false);
  };

  const authorProfile = post.profile;
  const avatarUrl = authorProfile?.avatar_url;
  const username = authorProfile?.username || 'user';

  return (
    <article className="bg-card border-b border-border">
      {/* Post header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Link to={`/profile/${post.user_id}`} className="shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt={username} className="w-9 h-9 rounded-full object-cover ring-2 ring-primary/30" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-primary font-bold text-sm">{username[0]?.toUpperCase()}</span>
            </div>
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <Link to={`/profile/${post.user_id}`} className="flex items-center gap-1">
            <span className="font-semibold text-sm text-foreground truncate">{username}</span>
            {authorProfile?.is_verified && <BadgeCheck className="w-4 h-4 text-primary shrink-0" />}
          </Link>
          <p className="text-xs text-muted-foreground">
            {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        </div>
        {(isOwner || myProfile?.is_admin) && (
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="p-1 rounded-lg hover:bg-muted transition-colors">
              <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-8 z-50 bg-popover border border-border rounded-xl shadow-lg min-w-[140px] overflow-hidden">
                <button
                  onClick={handleDelete}
                  className="w-full text-left px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  Delete Post
                </button>
                <button onClick={() => setShowMenu(false)} className="w-full text-left px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted transition-colors">
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Post image */}
      <div className="aspect-square w-full bg-muted overflow-hidden">
        <img
          onError={(e) => retryMediaOnError(e.currentTarget, post.image_url)}
          src={post.image_url}
          alt={post.caption || 'Post'}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Post actions */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={handleLike}
            className={cn('p-1 transition-all active:scale-110', liked ? 'text-red-500' : 'text-foreground hover:text-red-400')}
          >
            <Heart className={cn('w-6 h-6', liked && 'fill-current')} />
          </button>
          <button onClick={() => setShowComments(true)} className="p-1 flex items-center gap-1 text-foreground hover:text-primary transition-colors">
            <MessageCircle className="w-6 h-6" />
            {commentsCount > 0 && <span className="text-sm font-semibold">{commentsCount.toLocaleString()}</span>}
          </button>
          <button onClick={handleShare} className="p-1 text-foreground hover:text-primary transition-colors">
            <Share2 className="w-6 h-6" />
          </button>
          <button
            onClick={handleSave}
            className={cn('p-1 ml-auto transition-all', saved ? 'text-primary' : 'text-foreground hover:text-primary')}
          >
            <Bookmark className={cn('w-6 h-6', saved && 'fill-current')} />
          </button>
        </div>

        {likesCount > 0 && (
          <p className="text-sm font-semibold text-foreground mb-1">
            {likesCount.toLocaleString()} {likesCount === 1 ? 'like' : 'likes'}
          </p>
        )}

        {post.caption && (
          <p className="text-sm text-foreground">
            <Link to={`/profile/${post.user_id}`} className="font-semibold mr-1">{username}</Link>
            <span className="text-pretty">{post.caption}</span>
          </p>
        )}

        <button
          onClick={() => setShowComments(true)}
          className="text-xs text-muted-foreground mt-1 hover:text-foreground transition-colors"
        >
          {commentsCount > 0
            ? commentsCount === 1 ? 'View 1 comment' : `View all ${commentsCount.toLocaleString()} comments`
            : 'Add a comment'}
        </button>
      </div>

      {/* Comments sheet */}
      {showComments && (
        <CommentsSheet
          postId={post.id}
          postOwnerId={post.user_id}
          open={showComments}
          onClose={() => setShowComments(false)}
          onCountChange={setCommentsCount}
        />
      )}
    </article>
  );
};

export default PostCard;
