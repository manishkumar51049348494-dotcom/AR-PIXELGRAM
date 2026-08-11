import React, { useState, useEffect } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { getAllPosts, deletePost, getAllStories, deleteStory } from '@/services/api';
import type { Post, Story } from '@/types/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, FileImage, BookOpen, Loader2, BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';

const AdminContent: React.FC = () => {
  const [tab, setTab] = useState<'posts' | 'stories'>('posts');
  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (tab === 'posts') {
      getAllPosts().then(p => { setPosts(p); setLoading(false); });
    } else {
      getAllStories().then(s => { setStories(s); setLoading(false); });
    }
  }, [tab]);

  const handleDeletePost = async (postId: string) => {
    await deletePost(postId);
    setPosts(prev => prev.filter(p => p.id !== postId));
    toast.success('Post removed');
  };

  const handleDeleteStory = async (storyId: string) => {
    await deleteStory(storyId);
    setStories(prev => prev.filter(s => s.id !== storyId));
    toast.success('Story removed');
  };

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-foreground text-balance">Content Moderation</h2>
          <p className="text-sm text-muted-foreground mt-1">Review and remove inappropriate content</p>
        </div>

        {/* Tab switch */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab('posts')}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors',
              tab === 'posts' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80')}
          >
            <FileImage className="w-4 h-4" />Posts ({posts.length})
          </button>
          <button
            onClick={() => setTab('stories')}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors',
              tab === 'stories' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80')}
          >
            <BookOpen className="w-4 h-4" />Stories ({stories.length})
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : tab === 'posts' ? (
          <div className="bg-card border border-border rounded-xl min-w-0 shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Post</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Author</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.length === 0 ? (
                    <tr><td colSpan={4} className="text-center text-muted-foreground py-12">No posts</td></tr>
                  ) : posts.map(post => (
                    <tr key={post.id} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img src={post.image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                          <p className="text-sm text-muted-foreground max-w-xs truncate">{post.caption || 'No caption'}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-foreground">{post.profile?.username || 'Unknown'}</span>
                          {post.profile?.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-primary" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove this post?</AlertDialogTitle>
                              <AlertDialogDescription>This will permanently delete the post. This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeletePost(post.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl min-w-0 shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Story</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Author</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expires</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stories.length === 0 ? (
                    <tr><td colSpan={4} className="text-center text-muted-foreground py-12">No stories</td></tr>
                  ) : stories.map(story => (
                    <tr key={story.id} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img src={story.image_url} alt="" className="w-10 h-14 rounded-lg object-cover shrink-0" />
                          <p className="text-sm text-muted-foreground max-w-xs truncate">{story.caption || 'No caption'}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-foreground">{story.profile?.username || 'Unknown'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={new Date(story.expires_at) < new Date() ? 'destructive' : 'secondary'} className="text-xs">
                          {new Date(story.expires_at) < new Date() ? 'Expired' : new Date(story.expires_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove this story?</AlertDialogTitle>
                              <AlertDialogDescription>This will permanently delete the story.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteStory(story.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminContent;
