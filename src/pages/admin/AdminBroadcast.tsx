import React, { useState, useEffect } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { createBroadcast, getBroadcasts } from '@/services/api';
import type { BroadcastNotification } from '@/types/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Megaphone, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

const AdminBroadcast: React.FC = () => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<BroadcastNotification[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    getBroadcasts().then(b => { setHistory(b); setLoadingHistory(false); });
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) { toast.error('Please fill in title and message'); return; }
    setSending(true);
    await createBroadcast(title.trim(), message.trim());
    toast.success('Broadcast sent to all users!');
    setTitle('');
    setMessage('');
    const updated = await getBroadcasts();
    setHistory(updated);
    setSending(false);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground text-balance">Broadcast Notifications</h2>
          <p className="text-sm text-muted-foreground mt-1">Send announcements to all users</p>
        </div>

        {/* Send form */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Megaphone className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">New Broadcast</h3>
          </div>
          <form onSubmit={handleSend} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Announcement title…"
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={100}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Write your announcement message…"
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
                maxLength={500}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">{message.length}/500</p>
            </div>
            <Button type="submit" className="gap-2" disabled={sending || !title.trim() || !message.trim()}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? 'Sending…' : 'Send to All Users'}
            </Button>
          </form>
        </div>

        {/* Broadcast history */}
        <div>
          <h3 className="font-semibold text-foreground mb-3">Broadcast History</h3>
          {loadingHistory ? (
            <div className="space-y-3">
              {Array.from({length:3}).map((_,i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-4">
                  <div className="h-4 w-48 bg-muted animate-pulse rounded-full mb-2" />
                  <div className="h-3 w-full bg-muted animate-pulse rounded-full" />
                </div>
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 bg-card border border-border rounded-xl">
              <Megaphone className="w-10 h-10 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No broadcasts sent yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map(b => (
                <div key={b.id} className="bg-card border border-border rounded-xl p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground text-balance">{b.title}</p>
                      <p className="text-sm text-muted-foreground mt-1 text-pretty">{b.message}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminBroadcast;
