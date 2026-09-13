import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Crown, Loader2, MoreVertical, Pin, Reply, Search, Send, Settings, Shield, Smile, UserPlus, Users, X } from 'lucide-react';
import MobileLayout from '@/components/layouts/MobileLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { addGroupMember, getGroup, getGroupMembers, getGroupMessages, leaveGroup, pinGroupMessage, removeGroupMember, searchGroupUsers, sendGroupMessage, toggleGroupReaction, unpinGroupMessage } from '@/services/groups';
import type { Profile } from '@/types/types';
import type { Group, GroupMember, GroupMessage } from '@/types/groups';
import { toast } from 'sonner';

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🙏'];

const Avatar: React.FC<{ profile?: Profile | null; size?: string }> = ({ profile, size = 'w-9 h-9' }) => (
  profile?.avatar_url ? <img src={profile.avatar_url} alt="" className={size + ' rounded-full object-cover shrink-0'} /> :
    <div className={size + ' rounded-full bg-primary/15 flex items-center justify-center text-primary font-semibold shrink-0'}>{(profile?.username?.[0] || '?').toUpperCase()}</div>
);

const GroupChatPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<Profile[]>([]);
  const [reactionMessage, setReactionMessage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const selectedUserIds = ((location.state as { selectedUserIds?: string[] } | null)?.selectedUserIds || []);

  const currentMember = useMemo(() => members.find(member => member.user_id === user?.id), [members, user]);
  const canManage = currentMember?.role === 'owner' || currentMember?.role === 'admin';
  const profileMap = useMemo(() => new Map(members.map(member => [member.user_id, member.profile])), [members]);

  const load = useCallback(async () => {
    if (!groupId) return;
    try {
      const [nextGroup, nextMembers, nextMessages] = await Promise.all([getGroup(groupId), getGroupMembers(groupId), getGroupMessages(groupId)]);
      setGroup(nextGroup);
      setMembers(nextMembers);
      setMessages(nextMessages);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Group load nahi hua');
    } finally { setLoading(false); }
  }, [groupId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!groupId) return;
    const channel = supabase.channel('group-' + groupId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_messages', filter: 'group_id=eq.' + groupId }, () => { void load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: 'group_id=eq.' + groupId }, () => { void load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups', filter: 'id=eq.' + groupId }, () => { void load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_message_reactions' }, () => { void load(); })
      .subscribe();
    return () => { void channel.unsubscribe(); };
  }, [groupId, load]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  useEffect(() => {
    if (!groupId || !canManage || !selectedUserIds.length) return;
    const addSelected = async () => {
      for (const userId of selectedUserIds) {
        try { await addGroupMember(groupId, userId); } catch { /* duplicate or permission failure */ }
      }
      window.history.replaceState({}, document.title);
      await load();
    };
    void addSelected();
  }, [groupId, canManage, selectedUserIds, load]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (!memberQuery.trim()) { setMemberResults([]); return; }
      try {
        const results = await searchGroupUsers(memberQuery, members.map(member => member.user_id));
        if (!cancelled) setMemberResults(results);
      } catch { if (!cancelled) setMemberResults([]); }
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [memberQuery, members]);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!groupId || !content.trim() || sending) return;
    setSending(true);
    const text = content.trim();
    setContent('');
    try { await sendGroupMessage(groupId, text, replyTo?.id); setReplyTo(null); await load(); }
    catch (error) { setContent(text); toast.error(error instanceof Error ? error.message : 'Message send nahi hua'); }
    finally { setSending(false); }
  };

  const handleReaction = async (message: GroupMessage, reaction: string) => {
    const mine = message.reactions?.find(item => item.user_id === user?.id);
    try { await toggleGroupReaction(message.id, reaction, mine); setReactionMessage(null); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Reaction update nahi hua'); }
  };

  const handleAdd = async (profile: Profile) => {
    if (!groupId) return;
    try { await addGroupMember(groupId, profile.user_id); setMemberQuery(''); await load(); toast.success(profile.username + ' added'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Member add nahi hua'); }
  };

  const handleLeave = async () => {
    if (!groupId || !window.confirm('Are you sure you want to leave this group?')) return;
    try { await leaveGroup(groupId); navigate('/chat'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Owner ko pehle ownership transfer karni hogi'); }
  };

  const copyInvite = async () => {
    if (!group) return;
    const link = window.location.origin + '/group/join/' + group.invite_token;
    try { await navigator.clipboard.writeText(link); toast.success('Invite link copied'); }
    catch { toast.error('Invite link copy nahi hua'); }
  };

  if (loading) return <MobileLayout hideHeader hideNav><div className="flex min-h-[100dvh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div></MobileLayout>;
  if (!group || !currentMember) return <MobileLayout hideHeader hideNav><div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 p-6 text-center"><Users className="h-12 w-12 text-muted-foreground" /><p className="font-medium">Group unavailable</p><Button onClick={() => navigate('/chat')}>Back to messages</Button></div></MobileLayout>;

  return (
    <MobileLayout hideHeader hideNav>
      <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-background">
        <header className="z-20 flex shrink-0 items-center gap-2 border-b border-border bg-card/95 px-2 py-2 backdrop-blur">
          <button type="button" onClick={() => navigate('/chat')} className="rounded-full p-2 hover:bg-muted" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
          <button type="button" onClick={() => setShowInfo(true)} className="flex min-w-0 flex-1 items-center gap-2 text-left"><Avatar profile={group.avatar_url ? { avatar_url: group.avatar_url, username: group.name } as Profile : null} /><span className="min-w-0"><span className="block truncate text-sm font-semibold">{group.name}</span><span className="block truncate text-xs text-muted-foreground">{members.length} members</span></span></button>
          <button type="button" onClick={() => setShowInfo(true)} className="rounded-full p-2 hover:bg-muted" aria-label="Group info"><MoreVertical className="h-5 w-5" /></button>
        </header>

        <div className="flex-1 min-h-0 space-y-2 overflow-y-auto p-3">
          <div className="mx-auto max-w-sm rounded-xl bg-primary/8 px-3 py-2 text-center text-xs text-muted-foreground">Messages in this group are visible only to its members.</div>
          {messages.map(message => {
            const mine = message.sender_id === user?.id;
            const sender = profileMap.get(message.sender_id);
            const replied = message.reply_to_id ? messages.find(item => item.id === message.reply_to_id) : null;
            return <div key={message.id} className={'group flex items-end gap-2 ' + (mine ? 'justify-end' : 'justify-start')}>
              {!mine && <Avatar profile={sender} size="w-7 h-7" />}
              <div className="relative max-w-[82%]">
                {!mine && <p className="mb-0.5 px-1 text-[11px] font-medium text-primary">{sender?.username || 'Member'}</p>}
                <div className={'rounded-2xl px-3 py-2 text-sm ' + (mine ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted text-foreground')}>
                  {replied && <button type="button" onClick={() => document.getElementById('group-message-' + replied.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className={'mb-1 block w-full rounded border-l-2 px-2 py-1 text-left text-xs ' + (mine ? 'border-primary-foreground/60 bg-primary-foreground/10' : 'border-primary bg-background/50')}><span className="block font-medium">Reply</span><span className="block truncate opacity-75">{replied.content}</span></button>}
                  <p id={'group-message-' + message.id} className="break-words">{message.content}</p>
                  <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70"><span>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>{message.edited_at && <span>edited</span>}{mine && <Check className="h-3 w-3" />}</div>
                </div>
                {(message.reactions?.length || 0) > 0 && <div className="-mt-2 ml-2 flex w-fit gap-1 rounded-full border border-border bg-card px-1.5 py-0.5 text-xs">{message.reactions?.map(reaction => <span key={reaction.user_id}>{reaction.reaction}</span>)}</div>}
                {reactionMessage === message.id && <div className="absolute bottom-full right-0 z-10 mb-1 flex gap-1 rounded-full border border-border bg-card p-1 shadow-lg">{REACTIONS.map(reaction => <button type="button" key={reaction} onClick={() => void handleReaction(message, reaction)} className="rounded-full p-1.5 text-base hover:bg-muted">{reaction}</button>)}</div>}
                <div className="mt-0.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"><button type="button" onClick={() => setReplyTo(message)} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Reply"><Reply className="h-3.5 w-3.5" /></button><button type="button" onClick={() => setReactionMessage(reactionMessage === message.id ? null : message.id)} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="React"><Smile className="h-3.5 w-3.5" /></button>{canManage && <button type="button" onClick={() => void (message.id ? pinGroupMessage(group.id, message.id).then(load).catch(error => toast.error(error.message)) : null)} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Pin"><Pin className="h-3.5 w-3.5" /></button>}</div>
              </div>
            </div>;
          })}
          <div ref={bottomRef} />
        </div>

        {replyTo && <div className="flex shrink-0 items-center gap-2 border-t border-border bg-card px-3 py-2 text-xs"><Reply className="h-4 w-4 text-primary" /><div className="min-w-0 flex-1"><p className="font-medium text-primary">Replying to {profileMap.get(replyTo.sender_id)?.username || 'member'}</p><p className="truncate text-muted-foreground">{replyTo.content}</p></div><button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply"><X className="h-4 w-4" /></button></div>}
        <form onSubmit={handleSend} className="flex shrink-0 items-center gap-2 border-t border-border bg-card px-3 py-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom,0px),12px)' }}><button type="button" className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Emoji"><Smile className="h-5 w-5" /></button><Input value={content} onChange={event => setContent(event.target.value)} placeholder="Message group…" maxLength={5000} className="h-10 flex-1" /><Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={!content.trim() || sending}>{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button></form>

        {showInfo && <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={() => setShowInfo(false)}><aside className="h-full w-full max-w-md overflow-y-auto bg-background p-4 shadow-xl" onClick={event => event.stopPropagation()}><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><Settings className="h-5 w-5 text-primary" /><h2 className="font-semibold">Group info</h2></div><button type="button" onClick={() => setShowInfo(false)} className="rounded-full p-2 hover:bg-muted"><X className="h-5 w-5" /></button></div><div className="mb-5 flex flex-col items-center text-center"><Avatar profile={group.avatar_url ? { avatar_url: group.avatar_url, username: group.name } as Profile : null} size="w-20 h-20" /><h3 className="mt-2 text-lg font-semibold">{group.name}</h3><p className="text-sm text-muted-foreground">{group.description || 'No description'}</p><button type="button" onClick={() => void copyInvite()} className="mt-3 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary"><Copy className="h-4 w-4" />Copy invite link</button></div><div className="mb-5"><div className="mb-2 flex items-center justify-between"><h3 className="font-medium">Members ({members.length})</h3>{canManage && <UserPlus className="h-4 w-4 text-primary" />}</div>{canManage && <div className="relative mb-2"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={memberQuery} onChange={event => setMemberQuery(event.target.value)} placeholder="Add member" className="pl-9" />{memberResults.length > 0 && <div className="absolute left-0 right-0 top-11 z-10 divide-y divide-border rounded-xl border border-border bg-card shadow-lg">{memberResults.map(profile => <button type="button" key={profile.user_id} onClick={() => void handleAdd(profile)} className="flex w-full items-center gap-2 p-2 text-left hover:bg-muted"><Avatar profile={profile} size="w-8 h-8" /><span className="min-w-0 flex-1 truncate text-sm">{profile.username}</span><UserPlus className="h-4 w-4 text-primary" /></button>)}</div>}</div>}{members.map(member => <div key={member.user_id} className="flex items-center gap-2 py-2"><Avatar profile={member.profile} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{member.profile?.username || 'Member'}</p><p className="flex items-center gap-1 text-xs text-muted-foreground">{member.role === 'owner' ? <><Crown className="h-3 w-3" />Owner</> : member.role === 'admin' ? <><Shield className="h-3 w-3" />Admin</> : 'Member'}</p></div>{canManage && member.user_id !== user?.id && member.role !== 'owner' && <button type="button" onClick={() => void removeGroupMember(group.id, member.user_id).then(load).catch(error => toast.error(error.message))} className="rounded p-2 text-destructive hover:bg-destructive/10" aria-label="Remove member">×</button>}</div>)}</div><div className="space-y-2 border-t border-border pt-4"><button type="button" onClick={() => void handleLeave()} className="w-full rounded-lg px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10">Leave group</button><p className="text-xs text-muted-foreground">Created {new Date(group.created_at).toLocaleDateString()}</p></div></aside></div>}
      </div>
    </MobileLayout>
  );
};

export default GroupChatPage;
