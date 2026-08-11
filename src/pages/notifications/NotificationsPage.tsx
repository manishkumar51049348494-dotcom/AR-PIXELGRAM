import React, { useState, useEffect } from 'react';
import MobileLayout from '@/components/layouts/MobileLayout';
import { useAuth } from '@/contexts/AuthContext';
import {
  getNotifications, markNotificationsRead, acceptFollowRequest,
  rejectFollowRequest, getPendingFollowRequests, createNotification
} from '@/services/api';
import { supabase } from '@/db/supabase';
import type { Notification } from '@/types/types';
import { BadgeCheck, Heart, MessageCircle, UserPlus, Bell, Check, X, ShieldOff, Megaphone, Film, Mail, CornerDownRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useBrowserNotifications } from '@/hooks/useBrowserNotifications';

const NotificationIcon: React.FC<{ type: Notification['type'] }> = ({ type }) => {
  switch (type) {
    case 'like': return <Heart className="w-4 h-4 text-red-500" />;
    case 'reel_like': return <Heart className="w-4 h-4 text-red-500" />;
    case 'story_like': return <Heart className="w-4 h-4 text-pink-500" />;
    case 'comment': return <MessageCircle className="w-4 h-4 text-blue-500" />;
    case 'reel_comment': return <MessageCircle className="w-4 h-4 text-blue-500" />;
    case 'comment_reply': return <CornerDownRight className="w-4 h-4 text-blue-500" />;
    case 'story_reply': return <CornerDownRight className="w-4 h-4 text-pink-500" />;
    case 'message': return <Mail className="w-4 h-4 text-primary" />;
    case 'follow': return <UserPlus className="w-4 h-4 text-green-500" />;
    case 'follow_request': return <UserPlus className="w-4 h-4 text-amber-500" />;
    case 'follow_accepted': return <UserPlus className="w-4 h-4 text-green-500" />;
    case 'verified': return <BadgeCheck className="w-4 h-4 text-primary" />;
    case 'suspended': return <ShieldOff className="w-4 h-4 text-destructive" />;
    case 'broadcast': return <Megaphone className="w-4 h-4 text-primary" />;
    default: return <Bell className="w-4 h-4 text-primary" />;
  }
};

// Skeleton row
const SkeletonRow = () => (
  <div className="flex items-start gap-3 px-4 py-3.5 border-b border-border/50">
    <div className="w-10 h-10 rounded-full bg-muted animate-pulse shrink-0" />
    <div className="flex-1 space-y-1.5">
      <div className="h-3.5 w-48 bg-muted animate-pulse rounded-full" />
      <div className="h-3 w-28 bg-muted animate-pulse rounded-full" />
    </div>
  </div>
);

const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Enable system/browser notifications for this user
  useBrowserNotifications(user?.id);

  const load = async () => {
    if (!user) return;
    const timer = setTimeout(() => setLoading(false), 5000);
    try {
      const notifs = await getNotifications(user.id);
      setNotifications(notifs);
      await markNotificationsRead(user.id);
    } catch { /* ignore */ }
    finally { clearTimeout(timer); setLoading(false); }
  };

  useEffect(() => { load(); }, [user]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifs-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => { load(); })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [user]);

  const handleAcceptFollow = async (notif: Notification) => {
    if (!notif.actor_id || !user) return;
    const requests = await getPendingFollowRequests(user.id);
    const req = requests.find(r => r.follower_id === notif.actor_id);
    if (req) {
      await acceptFollowRequest(req.id);
      await createNotification(notif.actor_id, 'follow_accepted', user.id);
      toast.success('Follow request accepted');
      load();
    }
  };

  const handleRejectFollow = async (notif: Notification) => {
    if (!notif.actor_id || !user) return;
    const requests = await getPendingFollowRequests(user.id);
    const req = requests.find(r => r.follower_id === notif.actor_id);
    if (req) {
      await rejectFollowRequest(req.id);
      toast.success('Follow request rejected');
      load();
    }
  };

  const getNotifText = (notif: Notification) => {
    const username = notif.actor?.username || 'किसी';
    switch (notif.type) {
      case 'like': return `${username} ने आपकी पोस्ट like की`;
      case 'reel_like': return `${username} ने आपकी reel like की`;
      case 'story_like': return `${username} ने आपकी story like की`;
      case 'comment': return `${username} ने comment किया`;
      case 'reel_comment': return `${username} ने आपकी reel पर comment किया${notif.message ? `: ${notif.message}` : ''}`;
      case 'comment_reply': return `${username} ने आपके comment का reply दिया${notif.message ? `: ${notif.message}` : ''}`;
      case 'story_reply': return `${username} ने आपकी story पर reply भेजा`;
      case 'message': return `${username} ने आपको message भेजा`;
      case 'follow': return `${username} ने follow किया`;
      case 'follow_request': return `${username} ने follow request भेजी`;
      case 'follow_accepted': return `${username} ने आपकी follow request स्वीकार की`;
      case 'verified': return notif.message || 'आपका अकाउंट verify हो गया ✅';
      case 'broadcast': return notif.message || 'नई घोषणा';
      case 'suspended': return notif.message || 'अकाउंट status बदला गया';
      default: return notif.message || 'नई notification';
    }
  };

  const openNotification = (notif: Notification) => {
    // Route to the most useful destination for each type
    switch (notif.type) {
      case 'reel_like':
        if (notif.post_id) navigate(`/reels?r=${notif.post_id}`);
        else navigate('/reels');
        return;
      case 'reel_comment':
      case 'comment_reply':
        if (notif.post_id) navigate(`/reels?r=${notif.post_id}&comments=1`);
        else navigate('/reels');
        return;
      case 'story_like':
      case 'story_reply':
        if (notif.actor_id) navigate(`/profile/${notif.actor_id}`);
        return;
      case 'message':
        if (notif.actor_id) navigate(`/chat/${notif.actor_id}`);
        return;
      case 'like':
      case 'comment':
        if (notif.post_id) navigate(`/post/${notif.post_id}`);
        else if (notif.actor_id) navigate(`/profile/${notif.actor_id}`);
        return;
      case 'follow':
      case 'follow_accepted':
      case 'follow_request':
        if (notif.actor_id) navigate(`/profile/${notif.actor_id}`);
        return;
    }
  };

  return (
    <MobileLayout>
      <div className="page-transition">
        <div className="px-4 py-4 border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-10">
          <h2 className="text-xl font-bold text-foreground">Notifications</h2>
        </div>

        {loading ? (
          <>{Array.from({length:8}).map((_,i) => <SkeletonRow key={i} />)}</>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <Bell className="w-16 h-16 text-muted-foreground mb-3" />
            <h3 className="font-semibold text-foreground mb-1">अभी कोई notification नहीं</h3>
            <p className="text-sm text-muted-foreground text-pretty">जब कोई like, comment, या follow करेगा तो यहाँ दिखेगा।</p>
          </div>
        ) : (
          <div>
            {notifications.map(notif => (
              <div
                key={notif.id}
                className={cn('flex items-start gap-3 px-4 py-3.5 border-b border-border/50 transition-colors cursor-pointer hover:bg-muted/40', !notif.is_read && 'bg-primary/5')}
                onClick={() => openNotification(notif)}
              >
                {/* Actor avatar */}
                <button
                  className="shrink-0"
                  onClick={(e) => { e.stopPropagation(); if (notif.actor_id) navigate(`/profile/${notif.actor_id}`); }}
                >
                  {notif.actor?.avatar_url ? (
                    <img src={notif.actor.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-primary font-bold text-sm">
                        {notif.actor?.username?.[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <NotificationIcon type={notif.type} />
                    <p className="text-sm text-foreground flex-1 min-w-0 text-pretty">{getNotifText(notif)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(notif.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>

                  {notif.type === 'follow_request' && notif.actor_id && (
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" className="h-8 text-xs px-3" onClick={() => handleAcceptFollow(notif)}>
                        <Check className="w-3 h-3 mr-1" />Accept
                      </Button>
                      <Button size="sm" variant="secondary" className="h-8 text-xs px-3" onClick={() => handleRejectFollow(notif)}>
                        <X className="w-3 h-3 mr-1" />Decline
                      </Button>
                    </div>
                  )}
                </div>

                {notif.post?.image_url && (
                  <Link to={`/post/${notif.post_id}`} className="shrink-0">
                    <img src={notif.post.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default NotificationsPage;
