import React, { useState, useEffect } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { getAllProfiles, makeAdmin, removeAdmin, setAccountStatus } from '@/services/api';
import type { Profile } from '@/types/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, ShieldCheck, ShieldOff, UserMinus, BadgeCheck, Ban, Lock, RotateCcw, MoreHorizontal, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const AdminUsers: React.FC = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [filtered, setFiltered] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'verified' | 'suspended' | 'admin'>('all');

  const load = async () => {
    setLoading(true);
    const data = await getAllProfiles(0, 200);
    setProfiles(data);
    setFiltered(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    let result = profiles;
    if (search.trim()) {
      result = result.filter(p =>
        p.username.toLowerCase().includes(search.toLowerCase()) ||
        (p.full_name || '').toLowerCase().includes(search.toLowerCase())
      );
    }
    if (filterStatus === 'verified') result = result.filter(p => p.is_verified);
    if (filterStatus === 'suspended') result = result.filter(p => p.account_status && p.account_status !== 'active');
    if (filterStatus === 'admin') result = result.filter(p => p.is_admin);
    setFiltered(result);
  }, [search, filterStatus, profiles]);

  const handleAction = async (profile: Profile, action: 'suspended' | 'locked' | 'permanently_disabled' | 'active' | 'admin' | 'remove-admin') => {
    if (action === 'admin') {
      await makeAdmin(profile.user_id);
      toast.success(`${profile.username} अब Admin है`);
    } else if (action === 'remove-admin') {
      await removeAdmin(profile.user_id);
      toast.success(`${profile.username} अब Admin नहीं है`);
    } else {
      await setAccountStatus(profile.user_id, action,
        action === 'suspended' ? 'Admin ने suspend किया' :
        action === 'locked' ? 'Admin ने lock किया' :
        action === 'permanently_disabled' ? 'Admin ने permanently disable किया' :
        'Admin ने restore किया'
      );
      const labels = { suspended: 'Suspended', locked: 'Locked', permanently_disabled: 'Permanently Disabled', active: 'Restored' };
      toast.success(`${profile.username} — ${labels[action]}`);
    }
    load();
  };

  const getStatusBadge = (p: Profile) => {
    const status = p.account_status;
    if (status === 'permanently_disabled') return <Badge variant="destructive" className="text-xs">Disabled</Badge>;
    if (status === 'locked') return <Badge className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0">Locked</Badge>;
    if (status === 'suspended' || p.is_suspended) return <Badge variant="destructive" className="text-xs">Suspended</Badge>;
    if (p.is_verified) return <Badge className="text-xs bg-primary/10 text-primary border-0">Verified</Badge>;
    if (p.is_admin) return <Badge className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-0">Admin</Badge>;
    return <Badge variant="secondary" className="text-xs">Active</Badge>;
  };

  const filterTabs = [
    { value: 'all', label: 'All Users' },
    { value: 'verified', label: 'Verified' },
    { value: 'suspended', label: 'Suspended' },
    { value: 'admin', label: 'Admins' },
  ] as const;

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-foreground text-balance">User Management</h2>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} users found</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search users…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {filterTabs.map(tab => (
              <button key={tab.value} onClick={() => setFilterStatus(tab.value)}
                className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  filterStatus === tab.value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                )}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <div className="bg-card border border-border rounded-xl min-w-0 shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Joined</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={4} className="text-center text-muted-foreground py-12">No users found</td></tr>
                  ) : filtered.map(profile => (
                    <tr key={profile.id} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {profile.avatar_url ? (
                            <img src={profile.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                              <span className="text-primary font-bold text-sm">{profile.username[0]?.toUpperCase()}</span>
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-1">
                              <span className="font-semibold text-sm text-foreground">{profile.username}</span>
                              {profile.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-primary" />}
                              {profile.is_admin && <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />}
                            </div>
                            {profile.full_name && <p className="text-xs text-muted-foreground">{profile.full_name}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(profile)}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            {/* Restore / Unsuspend */}
                            {profile.account_status && profile.account_status !== 'active' && (
                              <DropdownMenuItem onClick={() => handleAction(profile, 'active')}>
                                <RotateCcw className="w-4 h-4 mr-2 text-green-500" />Restore Account
                              </DropdownMenuItem>
                            )}
                            {/* Suspend */}
                            {profile.account_status !== 'suspended' && (
                              <DropdownMenuItem onClick={() => handleAction(profile, 'suspended')}>
                                <ShieldOff className="w-4 h-4 mr-2 text-amber-500" />Suspend
                              </DropdownMenuItem>
                            )}
                            {/* Lock */}
                            {profile.account_status !== 'locked' && (
                              <DropdownMenuItem onClick={() => handleAction(profile, 'locked')}>
                                <Lock className="w-4 h-4 mr-2 text-blue-500" />Lock Account
                              </DropdownMenuItem>
                            )}
                            {/* Permanently Disable */}
                            {profile.account_status !== 'permanently_disabled' && (
                              <DropdownMenuItem onClick={() => handleAction(profile, 'permanently_disabled')} className="text-destructive focus:text-destructive">
                                <Ban className="w-4 h-4 mr-2" />Permanently Disable
                              </DropdownMenuItem>
                            )}
                            {!profile.is_admin ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleAction(profile, 'admin')}>
                                  <ShieldCheck className="w-4 h-4 mr-2 text-primary" />Make Admin
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleAction(profile, 'remove-admin')} className="text-destructive focus:text-destructive">
                                  <UserMinus className="w-4 h-4 mr-2" />Remove Admin
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminUsers;
