// चैट पेज — seen status, block/unblock, online status, avatar→profile click
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MobileLayout from '@/components/layouts/MobileLayout';
import { useAuth } from '@/contexts/AuthContext';
import {
  getMessages, sendMessage, markConversationSeen, getProfile,
  blockUser, unblockUser, isBlocked, getOnlineStatus, setOnlineStatus, createNotification
} from '@/services/api';
import { supabase } from '@/db/supabase';
import type { Message, Profile } from '@/types/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Send, BadgeCheck, Smile, Phone, Video, MoreVertical, Ban, ShieldOff } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useCall } from '@/contexts/CallContext';

const EMOJI_LIST = ['😀','😂','❤️','👍','🎉','😍','🔥','✨','😎','🙏','💯','🤔','😭','😘','💪'];

const ChatPage: React.FC = () => {
  const { receiverId } = useParams<{ receiverId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { startCall } = useCall();
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockedByOther, setBlockedByOther] = useState(false);
  const [onlineStatus, setOnlineStatusState] = useState<{ is_online: boolean; last_seen_at: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!receiverId || !user) return;
    // Set self online
    setOnlineStatus(user.id, true);
    // Load
    getProfile(receiverId).then(setOtherProfile);
    loadMessages();
    isBlocked(user.id, receiverId).then(setBlocked);
    isBlocked(receiverId, user.id).then(setBlockedByOther);
    getOnlineStatus(receiverId).then(setOnlineStatusState);
    // Cleanup: set offline on unmount
    return () => { setOnlineStatus(user.id, false); };
  }, [receiverId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, otherTyping]);

  const loadMessages = async () => {
    if (!user || !receiverId) return;
    const msgs = await getMessages(user.id, receiverId);
    setMessages(msgs);
    await markConversationSeen(receiverId, user.id);
  };

  // Realtime subscription
  useEffect(() => {
    if (!user || !receiverId) return;
    const channel = supabase
      .channel(`chat-${user.id}-${receiverId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        payload => {
          const msg = payload.new as Message;
          if (msg.sender_id === receiverId) {
            setMessages(prev => [...prev, msg]);
            markConversationSeen(receiverId, user.id);
          }
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `sender_id=eq.${user.id}` },
        payload => {
          const updated = payload.new as Message;
          setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, is_seen: updated.is_seen } : m));
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'online_status', filter: `user_id=eq.${receiverId}` },
        payload => { setOnlineStatusState(payload.new as { is_online: boolean; last_seen_at: string }); })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [user, receiverId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !user || !receiverId || sending || blocked || blockedByOther) return;
    setSending(true);
    const msg: Message = {
      id: Date.now().toString(), sender_id: user.id, receiver_id: receiverId,
      content: content.trim(), is_seen: false, created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, msg]);
    const text = content.trim();
    setContent('');
    await sendMessage(receiverId, text);
    createNotification(receiverId, 'message', user.id, undefined, undefined, text.slice(0, 120)).catch(() => {});
    setSending(false);
  };

  const handleTyping = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {}, 1500);
  };

  const handleBlock = async () => {
    if (!user || !receiverId) return;
    if (blocked) {
      await unblockUser(user.id, receiverId);
      setBlocked(false);
      toast.success('Unblocked');
    } else {
      await blockUser(user.id, receiverId);
      setBlocked(true);
      toast.success('Blocked');
    }
  };

  const formatTime = (d: string) => new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const formatLastSeen = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    if (diff < 60000) return 'अभी ऑनलाइन था';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} मिनट पहले`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} घंटे पहले`;
    return new Date(d).toLocaleDateString('hi-IN');
  };

  const statusText = onlineStatus?.is_online ? '🟢 Online' :
    onlineStatus?.last_seen_at ? `Last seen: ${formatLastSeen(onlineStatus.last_seen_at)}` :
    'Offline';

  return (
    <MobileLayout hideNav>
      <div className="flex flex-col h-screen">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card sticky top-0 z-10">
          <button onClick={() => navigate('/chat')} className="p-1 -ml-1 hover:bg-muted rounded-lg transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          {/* Avatar — click opens profile */}
          <button onClick={() => navigate(`/profile/${receiverId}`)} className="shrink-0">
            {otherProfile?.avatar_url ? (
              <img src={otherProfile.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span className="text-primary font-bold text-sm">{otherProfile?.username?.[0]?.toUpperCase()}</span>
              </div>
            )}
          </button>
          <button className="flex-1 min-w-0 text-left" onClick={() => navigate(`/profile/${receiverId}`)}>
            <div className="flex items-center gap-1">
              <span className="font-semibold text-sm text-foreground truncate">{otherProfile?.username}</span>
              {otherProfile?.is_verified && <BadgeCheck className="w-4 h-4 text-primary shrink-0" />}
            </div>
            <p className="text-xs text-muted-foreground truncate">{otherTyping ? 'टाइप कर रहा है…' : statusText}</p>
          </button>
          {/* Call buttons */}
          <button
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
            onClick={() => { if (receiverId) startCall(receiverId, 'audio'); }}
            disabled={blocked || blockedByOther}
          >
            <Phone className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
            onClick={() => { if (receiverId) startCall(receiverId, 'video'); }}
            disabled={blocked || blockedByOther}
          >
            <Video className="w-4 h-4 text-muted-foreground" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
                <MoreVertical className="w-4 h-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleBlock} className={blocked ? 'text-green-600' : 'text-destructive'}>
                {blocked ? <><ShieldOff className="w-4 h-4 mr-2" />Unblock</> : <><Ban className="w-4 h-4 mr-2" />Block</>}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Blocked banner */}
        {(blocked || blockedByOther) && (
          <div className="bg-destructive/10 text-destructive text-sm text-center py-2 px-4">
            {blocked ? `आपने ${otherProfile?.username} को block किया है` : 'आप इस user को message नहीं कर सकते'}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-muted-foreground text-sm">{otherProfile?.username} को Hi कहें!</p>
            </div>
          )}
          {messages.map((msg, idx) => {
            const isMe = msg.sender_id === user?.id;
            const prevMsg = messages[idx - 1];
            const showTime = !prevMsg || new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 5 * 60 * 1000;
            const isLast = idx === messages.length - 1;
            return (
              <React.Fragment key={msg.id}>
                {showTime && (
                  <p className="text-center text-xs text-muted-foreground my-2">{formatTime(msg.created_at)}</p>
                )}
                <div className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[75%] px-3 py-2 rounded-2xl text-sm', isMe ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm')}>
                    <p className="break-words">{msg.content}</p>
                    <div className={cn('flex items-center gap-1 mt-0.5', isMe ? 'justify-end' : 'justify-start')}>
                      <span className={cn('text-[10px]', isMe ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                        {formatTime(msg.created_at)}
                      </span>
                      {isMe && (
                        <span className="text-[10px] text-primary-foreground/80">
                          {msg.is_seen ? '✓✓ Seen' : '✓'}
                        </span>
                      )}
                    </div>
                    {/* Seen label below last sent message */}
                    {isMe && isLast && msg.is_seen && (
                      <p className="text-[10px] text-primary-foreground/70 text-right mt-0.5">Seen</p>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
          {otherTyping && (
            <div className="flex justify-start">
              <div className="bg-muted px-4 py-2 rounded-2xl rounded-bl-sm">
                <div className="flex gap-1 items-center h-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Emoji picker */}
        {showEmoji && (
          <div className="border-t border-border bg-card px-4 py-3">
            <div className="flex flex-wrap gap-3">
              {EMOJI_LIST.map(emoji => (
                <button key={emoji} onClick={() => { setContent(p => p + emoji); setShowEmoji(false); }} className="text-2xl hover:scale-125 transition-transform">
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSend} className="flex items-center gap-2 px-4 py-3 border-t border-border bg-card" style={{ paddingBottom: 'max(env(safe-area-inset-bottom,0px),12px)' }}>
          <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="p-2 rounded-lg hover:bg-muted transition-colors shrink-0">
            <Smile className={cn('w-5 h-5 transition-colors', showEmoji ? 'text-primary' : 'text-muted-foreground')} />
          </button>
          <Input
            placeholder={blocked || blockedByOther ? 'Message unavailable' : 'Message…'}
            value={content}
            onChange={e => { setContent(e.target.value); handleTyping(); }}
            className="flex-1 h-10"
            maxLength={500}
            disabled={blocked || blockedByOther}
          />
          <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={!content.trim() || sending || blocked || blockedByOther}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </MobileLayout>
  );
};

export default ChatPage;
