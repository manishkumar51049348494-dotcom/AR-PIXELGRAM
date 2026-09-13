import React, { useState, useEffect, useCallback } from 'react';
import MobileLayout from '@/components/layouts/MobileLayout';
import PullToRefresh from '@/components/common/PullToRefresh';
import { useAuth } from '@/contexts/AuthContext';
import { withTimeout } from '@/lib/withTimeout';
import { getMutualFollows, getMessages, getUnreadCount, getMessagedProfiles } from '@/services/api';
import { getMyGroups } from '@/services/groups';
import type { Profile, Message } from '@/types/types';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle, Loader2, BadgeCheck, ArrowLeft, Plus, Users } from 'lucide-react';

interface ConversationItem {
  profile: Profile;
  lastMessage: Message | null;
  unreadCount: number;
}

const ChatListPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Awaited<ReturnType<typeof getMyGroups>>>([]);
  const [showGroupMenu, setShowGroupMenu] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    {
      try {
        const [mutuals, messaged, groupList] = await withTimeout(Promise.all([
          getMutualFollows(user.id),
          getMessagedProfiles(user.id),
          getMyGroups(user.id).catch(() => []),
        ]), 20000);
        setGroups(groupList);
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
    <MobileLayout hideHeader hideNav>
      <PullToRefresh onRefresh={load}>
      <div className="page-transition">
        <div className="sticky top-0 z-30 flex items-center gap-3 px-2 py-3 bg-background/95 backdrop-blur border-b border-border">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h2 className="text-xl font-bold text-foreground">Messages</h2>
          <button type="button" onClick={() => setShowGroupMenu(value => !value)} aria-label="Create group" className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"><Plus className="h-4 w-4" /></button>
        </div>

        {showGroupMenu && <div className="border-b border-border bg-card px-4 py-2"><Link to="/groups/new" onClick={() => setShowGroupMenu(false)} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-primary hover:bg-muted"><Users className="h-4 w-4" />Create group</Link></div>}
        {groups.length > 0 && <div className="border-b border-border">{groups.map(({ group, member_count }) => <Link key={group.id} to={'/group/' + group.id} className="flex items-center gap-3 border-b border-border/50 px-4 py-3 hover:bg-muted/60">{group.avatar_url ? <img src={group.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary"><Users className="h-5 w-5" /></div>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{group.name}</p><p className="text-xs text-muted-foreground">{member_count} members</p></div></Link>)}</div>}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : conversations.length === 0 && groups.length === 0 ? (
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
