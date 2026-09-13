import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, Search, Users } from 'lucide-react';
import MobileLayout from '@/components/layouts/MobileLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { createGroup, searchGroupUsers } from '@/services/groups';
import type { Profile } from '@/types/types';
import { toast } from 'sonner';

const Avatar: React.FC<{ profile?: Profile | null; size?: string }> = ({ profile, size = 'w-10 h-10' }) => (
  profile?.avatar_url ? <img src={profile.avatar_url} alt="" className={size + ' rounded-full object-cover shrink-0'} /> :
    <div className={size + ' rounded-full bg-primary/15 flex items-center justify-center text-primary font-semibold shrink-0'}>
      {(profile?.username?.[0] || '?').toUpperCase()}
    </div>
);

const CreateGroupPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (!query.trim() || !user) { setResults([]); return; }
      setSearching(true);
      try {
        const profiles = await searchGroupUsers(query, [user.id, ...selected.map(item => item.user_id)]);
        if (!cancelled) setResults(profiles);
      } catch { if (!cancelled) setResults([]); }
      finally { if (!cancelled) setSearching(false); }
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [query, selected, user]);

  const toggle = (profile: Profile) => {
    setSelected(current => current.some(item => item.user_id === profile.user_id)
      ? current.filter(item => item.user_id !== profile.user_id)
      : [...current, profile]);
    setResults(current => current.filter(item => item.user_id !== profile.user_id));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !user || loading) return;
    setLoading(true);
    try {
      const groupId = await createGroup(name, description, avatarUrl);
      toast.success('Group created');
      navigate('/group/' + groupId, { state: { selectedUserIds: selected.map(item => item.user_id) } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Group create nahi hua');
    } finally { setLoading(false); }
  };

  return (
    <MobileLayout hideHeader hideNav>
      <div className="min-h-[100dvh] bg-background">
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card/95 backdrop-blur px-3 py-3">
          <button type="button" onClick={() => navigate('/chat')} className="rounded-full p-2 hover:bg-muted" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
          <div><h1 className="font-semibold">Create group</h1><p className="text-xs text-muted-foreground">You will be the owner and first admin</p></div>
        </div>
        <form onSubmit={submit} className="space-y-5 p-4 pb-10">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"><div className="h-14 w-14 rounded-full bg-primary/15 flex items-center justify-center text-primary"><Users className="h-7 w-7" /></div><div className="min-w-0 flex-1"><p className="font-medium">Group details</p><p className="text-xs text-muted-foreground">Name is required. Photo URL is optional.</p></div></div>
          <label className="block space-y-1.5"><span className="text-sm font-medium">Group name</span><Input value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Weekend plans" maxLength={80} required /></label>
          <label className="block space-y-1.5"><span className="text-sm font-medium">Description</span><Textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="What is this group about?" maxLength={500} rows={3} /></label>
          <label className="block space-y-1.5"><span className="text-sm font-medium">Group photo URL <span className="font-normal text-muted-foreground">(optional)</span></span><Input value={avatarUrl} onChange={event => setAvatarUrl(event.target.value)} placeholder="https://…" inputMode="url" /></label>
          <div className="space-y-2"><div><p className="text-sm font-medium">Add members <span className="font-normal text-muted-foreground">(optional)</span></p><p className="text-xs text-muted-foreground">You can add more later from Group Info.</p></div><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search username or name" className="pl-9" /></div>{searching && <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />}{results.length > 0 && <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">{results.map(profile => <button type="button" key={profile.user_id} onClick={() => toggle(profile)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted"><Avatar profile={profile} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{profile.username}</span><span className="block truncate text-xs text-muted-foreground">{profile.full_name || 'AR Pixelgram user'}</span></span><Check className="h-4 w-4 text-muted-foreground" /></button>)}</div>}{selected.length > 0 && <div className="flex flex-wrap gap-2">{selected.map(profile => <button type="button" key={profile.user_id} onClick={() => toggle(profile)} className="flex items-center gap-1.5 rounded-full bg-primary/10 py-1 pl-1 pr-2 text-xs text-primary"><Avatar profile={profile} size="w-5 h-5" />{profile.username}<span aria-hidden="true">×</span></button>)}</div>}</div>
          <Button type="submit" className="w-full" disabled={loading || !name.trim()}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{loading ? 'Creating…' : 'Create group'}</Button>
        </form>
      </div>
    </MobileLayout>
  );
};

export default CreateGroupPage;
