import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, Users } from 'lucide-react';
import MobileLayout from '@/components/layouts/MobileLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { joinGroupByInvite } from '@/services/groups';
import { toast } from 'sonner';

const GroupJoinPage: React.FC = () => {
  const { inviteToken } = useParams<{ inviteToken: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  const join = async () => {
    if (!inviteToken || !user || joining) return;
    setJoining(true);
    setError('');
    try {
      const groupId = await joinGroupByInvite(inviteToken);
      navigate('/group/' + groupId, { replace: true });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Invite link is invalid';
      setError(message);
      toast.error(message);
    } finally { setJoining(false); }
  };

  useEffect(() => { if (user && inviteToken) void join(); }, [user, inviteToken]);

  return <MobileLayout hideHeader hideNav><div className="flex min-h-[100dvh] items-center justify-center p-6"><div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-sm"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary"><Users className="h-8 w-8" /></div><h1 className="mt-4 text-lg font-semibold">Join group</h1>{authLoading || joining ? <><Loader2 className="mx-auto mt-4 h-6 w-6 animate-spin text-primary" /><p className="mt-2 text-sm text-muted-foreground">Joining securely…</p></> : !user ? <><p className="mt-2 text-sm text-muted-foreground">Log in to join this AR Pixelgram group.</p><Button className="mt-4 w-full" onClick={() => navigate('/login')}>Log in</Button></> : error ? <><p className="mt-2 text-sm text-destructive">{error}</p><Button className="mt-4 w-full" onClick={() => void join()}>Try again</Button></> : <p className="mt-2 text-sm text-muted-foreground">Preparing your invite…</p>}</div></div></MobileLayout>;
};

export default GroupJoinPage;
