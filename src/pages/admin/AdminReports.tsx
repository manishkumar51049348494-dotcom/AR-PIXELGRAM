import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '@/components/layouts/AdminLayout';
import { getUserReports, updateUserReportStatus, setAccountStatus, getAllAppeals, reviewAppeal, getProblemReports, createNotification } from '@/services/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Flag, CheckCircle, ShieldOff, Lock, Ban, RotateCcw, MessageSquare, AlertTriangle, Bell, Send } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

type Tab = 'reports' | 'appeals' | 'problems';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  reviewed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  resolved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const ACCOUNT_ACTIONS = [
  { label: 'Suspend', value: 'suspended', icon: ShieldOff, color: 'text-amber-600' },
  { label: 'Lock', value: 'locked', icon: Lock, color: 'text-blue-600' },
  { label: 'Permanently Disable', value: 'permanently_disabled', icon: Ban, color: 'text-destructive' },
  { label: 'Restore Account', value: 'active', icon: RotateCcw, color: 'text-green-600' },
];

const AdminReports: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('reports');
  const [reports, setReports] = useState<any[]>([]);
  const [appeals, setAppeals] = useState<any[]>([]);
  const [problems, setProblems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [actionModal, setActionModal] = useState<{ reportId: string; userId: string; username: string; reporterId?: string } | null>(null);
  const [appealModal, setAppealModal] = useState<any | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  // Reporter को notification भेजने का modal
  const [notifModal, setNotifModal] = useState<{ reporterId: string; reporterName: string } | null>(null);
  const [notifMsg, setNotifMsg] = useState('');

  const load = async () => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 8000);
    try {
      const [r, a, p] = await Promise.all([
        getUserReports(filter === 'all' ? undefined : filter),
        getAllAppeals(),
        getProblemReports(),
      ]);
      setReports(r);
      setAppeals(a);
      setProblems(p);
    } catch { /* ignore */ }
    finally { clearTimeout(timer); setLoading(false); }
  };

  useEffect(() => { load(); }, [filter]);

  const handleReportAction = async (reportId: string, status: string) => {
    setProcessingId(reportId);
    await updateUserReportStatus(reportId, status);
    toast.success(`Report ${status}`);
    await load();
    setProcessingId(null);
  };

  const handleAccountAction = async (userId: string, action: string, reportId?: string, reporterId?: string) => {
    setProcessingId(userId);
    await setAccountStatus(
      userId,
      action as 'active' | 'suspended' | 'locked' | 'permanently_disabled',
      `Admin action: ${action}`,
      reporterId  // notify reporter
    );
    if (reportId) await updateUserReportStatus(reportId, 'resolved', action);
    toast.success(`Account ${action === 'active' ? 'restored' : action}`);
    setActionModal(null);
    await load();
    setProcessingId(null);
  };

  const handleAppealReview = async (appealId: string, approved: boolean, userId: string) => {
    setProcessingId(appealId);
    await reviewAppeal(appealId, approved, userId, approved ? 'Appeal approved by admin' : 'Appeal rejected by admin');
    toast.success(approved ? 'Appeal approved — account restored ✅' : 'Appeal rejected');
    setAppealModal(null);
    await load();
    setProcessingId(null);
  };

  // Reporter को custom notification भेजो
  const handleSendNotif = async () => {
    if (!notifModal || !notifMsg.trim()) return;
    await createNotification(notifModal.reporterId, 'broadcast', undefined, undefined, undefined, notifMsg.trim());
    toast.success(`Notification भेजी गई → @${notifModal.reporterName}`);
    setNotifModal(null);
    setNotifMsg('');
  };

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'reports', label: 'User Reports', count: reports.filter(r => r.status === 'pending').length },
    { id: 'appeals', label: 'Appeals', count: appeals.filter(a => a.status === 'pending').length },
    { id: 'problems', label: 'Problem Reports', count: problems.filter(p => p.status === 'pending').length },
  ];

  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-foreground">Reports & Moderation</h2>
            <p className="text-sm text-muted-foreground mt-1">User reports, account actions, appeals</p>
          </div>
          {tab === 'reports' && (
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all',
                tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({length:4}).map((_,i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-5 bg-muted animate-pulse rounded-full" />
                  <div className="w-24 h-5 bg-muted animate-pulse rounded-full" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-28 h-4 bg-muted animate-pulse rounded-full" />
                  <div className="w-4 h-4 bg-muted animate-pulse rounded-full" />
                  <div className="w-28 h-4 bg-muted animate-pulse rounded-full" />
                </div>
                <div className="w-full h-10 bg-muted animate-pulse rounded-lg" />
                <div className="flex gap-2">
                  <div className="w-20 h-7 bg-muted animate-pulse rounded-lg" />
                  <div className="w-24 h-7 bg-muted animate-pulse rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* ── USER REPORTS ── */}
            {tab === 'reports' && (
              <div className="space-y-3">
                {reports.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 bg-card border border-border rounded-xl">
                    <Flag className="w-12 h-12 text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No reports found</p>
                  </div>
                ) : reports.map(report => (
                  <div key={report.id} className="bg-card border border-border rounded-xl p-4">

                    {/* दोनों users — reporter ← → reported, avatars के साथ */}
                    <div className="flex items-center gap-2 mb-3 p-2.5 rounded-xl bg-muted/50">
                      {/* Reporter */}
                      <button onClick={() => report.reporter_id && navigate(`/profile/${report.reporter_id}`)}
                        className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
                        {report.reporter?.avatar_url
                          ? <img src={report.reporter.avatar_url} className="w-9 h-9 rounded-full object-cover shrink-0 border-2 border-amber-400/50" alt="" />
                          : <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0 text-sm font-bold text-amber-700 border-2 border-amber-300/50">
                              {report.reporter?.username?.[0]?.toUpperCase() || '?'}
                            </div>}
                        <div className="min-w-0">
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium leading-none mb-0.5">Reporter</p>
                          <p className="text-xs font-bold text-foreground truncate max-w-[80px]">@{report.reporter?.username || 'Unknown'}</p>
                        </div>
                      </button>

                      <div className="flex flex-col items-center gap-0.5 shrink-0">
                        <Flag className="w-3.5 h-3.5 text-destructive" />
                        <span className="text-[9px] text-muted-foreground leading-none">report</span>
                      </div>

                      {/* Reported */}
                      <button onClick={() => report.reported_user_id && navigate(`/profile/${report.reported_user_id}`)}
                        className="flex items-center gap-1.5 flex-1 min-w-0 justify-end text-right">
                        <div className="min-w-0">
                          <p className="text-[10px] text-destructive font-medium leading-none mb-0.5">Reported</p>
                          <p className="text-xs font-bold text-destructive truncate max-w-[80px] ml-auto">@{report.reported?.username || 'Unknown'}</p>
                        </div>
                        {report.reported?.avatar_url
                          ? <img src={report.reported.avatar_url} className="w-9 h-9 rounded-full object-cover shrink-0 border-2 border-destructive/50" alt="" />
                          : <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0 text-sm font-bold text-red-700 border-2 border-red-300/50">
                              {report.reported?.username?.[0]?.toUpperCase() || '?'}
                            </div>}
                      </button>
                    </div>

                    {/* Status + reason + date */}
                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={cn('text-xs border-0 capitalize', STATUS_COLORS[report.status])}>
                          {report.status}
                        </Badge>
                        <span className="text-xs font-medium text-foreground bg-muted px-2 py-0.5 rounded-full capitalize">
                          {report.reason?.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(report.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {report.description && (
                      <p className="text-sm text-foreground mb-3 text-pretty bg-muted/50 rounded-lg px-3 py-2">
                        {report.description}
                      </p>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 flex-wrap">
                      {report.status === 'pending' && (
                        <Button size="sm" variant="secondary" className="h-7 text-xs px-3"
                          disabled={processingId === report.id}
                          onClick={() => handleReportAction(report.id, 'reviewed')}>
                          Mark Reviewed
                        </Button>
                      )}
                      {report.status !== 'resolved' && (
                        <Button size="sm" className="h-7 text-xs px-3 gap-1"
                          disabled={processingId === report.id}
                          onClick={() => handleReportAction(report.id, 'resolved')}>
                          <CheckCircle className="w-3 h-3" />Resolve
                        </Button>
                      )}
                      {report.reported_user_id && (
                        <Button size="sm" variant="destructive" className="h-7 text-xs px-3 gap-1"
                          onClick={() => setActionModal({
                            reportId: report.id,
                            userId: report.reported_user_id,
                            username: report.reported?.username || 'Unknown',
                            reporterId: report.reporter_id,
                          })}>
                          <ShieldOff className="w-3 h-3" />Action
                        </Button>
                      )}
                      {report.reporter_id && (
                        <Button size="sm" variant="outline" className="h-7 text-xs px-3 gap-1"
                          onClick={() => setNotifModal({
                            reporterId: report.reporter_id,
                            reporterName: report.reporter?.username || 'Unknown',
                          })}>
                          <Bell className="w-3 h-3" />Notify Reporter
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── APPEALS ── */}
            {tab === 'appeals' && (
              <div className="space-y-3">
                {appeals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 bg-card border border-border rounded-xl">
                    <MessageSquare className="w-12 h-12 text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No appeals yet</p>
                  </div>
                ) : appeals.map(appeal => (
                  <div key={appeal.id} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      {appeal.profile?.avatar_url ? (
                        <img src={appeal.profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                          <span className="text-primary font-bold text-sm">{appeal.profile?.username?.[0]?.toUpperCase()}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => appeal.user_id && navigate(`/profile/${appeal.user_id}`)}
                              className="font-semibold text-sm text-foreground hover:text-primary transition-colors"
                            >
                              @{appeal.profile?.username}
                            </button>
                            <Badge className={cn('text-xs border-0 capitalize', STATUS_COLORS[appeal.status])}>{appeal.status}</Badge>
                            <Badge className="text-xs border-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 capitalize">
                              {appeal.profile?.account_status?.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(appeal.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <p className="text-sm text-foreground mb-2 text-pretty">{appeal.appeal_text}</p>
                        {appeal.appeal_photo_url && (
                          <img src={appeal.appeal_photo_url} alt="Appeal photo" className="h-32 rounded-lg object-cover mb-3 cursor-pointer"
                            onClick={() => window.open(appeal.appeal_photo_url, '_blank')} />
                        )}
                        {appeal.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button size="sm" className="h-7 text-xs px-3 gap-1 bg-green-600 hover:bg-green-700 text-white"
                              disabled={processingId === appeal.id}
                              onClick={() => handleAppealReview(appeal.id, true, appeal.user_id)}>
                              <CheckCircle className="w-3 h-3" />Approve — Restore
                            </Button>
                            <Button size="sm" variant="destructive" className="h-7 text-xs px-3"
                              disabled={processingId === appeal.id}
                              onClick={() => handleAppealReview(appeal.id, false, appeal.user_id)}>
                              Reject
                            </Button>
                          </div>
                        )}
                        {appeal.admin_note && (
                          <p className="text-xs text-muted-foreground mt-2">Admin note: {appeal.admin_note}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── PROBLEM REPORTS ── */}
            {tab === 'problems' && (
              <div className="space-y-3">
                {problems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 bg-card border border-border rounded-xl">
                    <AlertTriangle className="w-12 h-12 text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No problem reports</p>
                  </div>
                ) : problems.map(pr => (
                  <div key={pr.id} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      {pr.profile?.avatar_url ? (
                        <img src={pr.profile.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                          <span className="text-primary font-bold text-sm">{pr.profile?.username?.[0]?.toUpperCase()}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => pr.user_id && navigate(`/profile/${pr.user_id}`)}
                              className="font-semibold text-sm text-foreground hover:text-primary transition-colors"
                            >
                              @{pr.profile?.username}
                            </button>
                            <span className="text-xs bg-muted px-2 py-0.5 rounded-full capitalize">
                              {pr.problem_type?.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(pr.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <p className="text-sm text-foreground text-pretty">{pr.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Account Action Modal */}
      <Dialog open={!!actionModal} onOpenChange={() => setActionModal(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Account Action — @{actionModal?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground mb-4">Choose what action to take on this account:</p>
            {ACCOUNT_ACTIONS.map(({ label, value, icon: Icon, color }) => (
              <button
                key={value}
                onClick={() => actionModal && handleAccountAction(
                  actionModal.userId, value, actionModal.reportId, actionModal.reporterId
                )}
                disabled={!!processingId}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:bg-muted/60 transition-colors text-left"
              >
                <Icon className={cn('w-5 h-5 shrink-0', color)} />
                <span className={cn('font-medium text-sm', color)}>{label}</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionModal(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Reporter Notification Modal */}
      <Dialog open={!!notifModal} onOpenChange={() => { setNotifModal(null); setNotifMsg(''); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Notify Reporter — @{notifModal?.reporterName}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">Reporter को एक notification message भेजें जो उन्हें बताए कि action लिया गया:</p>
            <Textarea
              placeholder="उदाहरण: आपकी report की समीक्षा की गई और उचित कार्रवाई की गई। धन्यवाद! 🙏"
              value={notifMsg}
              onChange={e => setNotifMsg(e.target.value)}
              rows={4}
              maxLength={300}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">{notifMsg.length}/300</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setNotifModal(null); setNotifMsg(''); }}>Cancel</Button>
            <Button disabled={!notifMsg.trim()} onClick={handleSendNotif} className="gap-2">
              <Send className="w-4 h-4" />Send Notification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminReports;
