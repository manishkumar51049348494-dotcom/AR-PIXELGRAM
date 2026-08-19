import React, { useState, useEffect, useCallback } from 'react';
import MobileLayout from '@/components/layouts/MobileLayout';
import PullToRefresh from '@/components/common/PullToRefresh';
import { useAuth } from '@/contexts/AuthContext';
import { withTimeout } from '@/lib/withTimeout';
import { getMutualFollows, getMessages, getUnreadCount, getMessagedProfiles } from '@/services/api';
import type { Profile, Message } from '@/types/types';
import { Link } from 'react-router-dom';
import { MessageCircle, Loader2, BadgeCheck } from 'lucide-react';

interface ConversationItem {
  profile: Profile;
  lastMessage: Message | null;
  unreadCount: number;
}

const ChatListPage: React.FC = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    {
      try {
        const [mutuals, messaged] = await withTimeout(Promise.all([
          getMutualFollows(user.id),
          getMessagedProfiles(user.id),
        ]), 20000);
        const seen = new Set<string>();
        const combined: Profile[] = [];
        for (const p of [...mutuals, ...messaged]) {
          if (p && !seen.has(p.user_id)) {
            seen.add(p.user_id);
            combined.push(p);
          }
        }
        const convs = await Promise.all(combined.map(async p => {
          const msgs = await getMessages(user.id, p.user_id);
          const lastMessage = msgs[msgs.length - 1] || null;
          const unreadCount = await getUnreadCount(user.id, p.user_id);
          return { profile: p, lastMessage, unreadCount };
        }));
        setConversations(convs.sort((a, b) => {
          if (!a.lastMessage && !b.lastMessage) return 0;
          if (!a.lastMessage) return 1;
          if (!b.lastMessage) return -1;
          return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime();
        }));
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return (
    <MobileLayout>
      <PullToRefresh onRefresh={load}>
      <div className="page-transition">
        <div className="px-4 py-4 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">Messages</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Chat with people you mutually follow</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <MessageCircle className="w-16 h-16 text-muted-foreground mb-3" />
            <h3 className="font-semibold text-foreground mb-1">No messages yet</h3>
            <p className="text-sm text-muted-foreground text-pretty">Follow someone and have them follow back to start chatting.</p>
          </div>
        ) : (
          <div>
            {conversations.map(({ profile, lastMessage, unreadCount }) => (
              <Link
                key={profile.id}
                to={`/chat/${profile.user_id}`}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/60 transition-colors border-b border-border/50"
              >
                <div className="shrink-0 relative">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.username} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-primary font-bold text-lg">{profile.username[0]?.toUpperCase()}</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="font-semibold text-sm text-foreground truncate">{profile.username}</span>
                      {profile.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </div>
                    {lastMessage && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(lastMessage.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground truncate flex-1 min-w-0">
                      {lastMessage ? lastMessage.content : 'Start a conversation'}
                    </p>
                    {unreadCount > 0 && (
                      <span className="shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] text-primary-foreground font-bold">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      </PullToRefresh>
    </MobileLayout>
  );
};

export default ChatListPage;
