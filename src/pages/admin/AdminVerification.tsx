import React, { useState, useEffect } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { getAllVerificationRequests, approveVerification, rejectVerification } from '@/services/api';
import type { VerificationRequest } from '@/types/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, BadgeCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const AdminVerification: React.FC = () => {
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  const load = async () => {
    setLoading(true);
    const data = await getAllVerificationRequests(filter === 'all' ? undefined : filter);
    setRequests(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const handleApprove = async (req: VerificationRequest) => {
    await approveVerification(req.id, req.user_id);
    toast.success(`${req.profile?.username} verified!`);
    load();
  };

  const handleReject = async (req: VerificationRequest) => {
    await rejectVerification(req.id, req.user_id);
    toast.success('Request rejected');
    load();
  };

  const filterTabs = [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'all', label: 'All' },
  ] as const;

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-foreground text-balance">Verification Requests</h2>
          <p className="text-sm text-muted-foreground mt-1">Review and approve blue badge requests</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {filterTabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                filter === tab.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({length:4}).map((_,i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-32 bg-muted animate-pulse rounded-full" />
                  <div className="h-3 w-48 bg-muted animate-pulse rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-card border border-border rounded-xl">
            <BadgeCheck className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No {filter === 'all' ? '' : filter} requests</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map(req => (
              <div key={req.id} className="bg-card border border-border rounded-xl p-4 shadow-card">
                <div className="flex items-start gap-3">
                  {req.profile?.avatar_url ? (
                    <img src={req.profile.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-primary font-bold">{req.profile?.username?.[0]?.toUpperCase()}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-sm text-foreground truncate">{req.profile?.username}</span>
                        {req.profile?.is_verified && <BadgeCheck className="w-4 h-4 text-primary shrink-0" />}
                      </div>
                      <Badge
                        className={cn('text-xs shrink-0',
                          req.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0' :
                          req.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0' :
                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0'
                        )}
                      >
                        {req.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground text-pretty mb-2">{req.reason}</p>
                    <p className="text-xs text-muted-foreground">
                      Submitted: {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    {req.status === 'pending' && (
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" className="h-8 text-xs px-3 gap-1" onClick={() => handleApprove(req)}>
                          <Check className="w-3 h-3" />Approve
                        </Button>
                        <Button size="sm" variant="secondary" className="h-8 text-xs px-3 gap-1" onClick={() => handleReject(req)}>
                          <X className="w-3 h-3" />Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminVerification;
