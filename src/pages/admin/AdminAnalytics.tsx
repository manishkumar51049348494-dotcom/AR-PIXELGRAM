import React, { useEffect, useState } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { getActivityLogs, getAdminStats } from '@/services/api';
import type { ActivityLog } from '@/types/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Activity, BarChart3, Loader2 } from 'lucide-react';

const mockMonthlyData = [
  { month: 'Jan', users: 12, posts: 34, stories: 20 },
  { month: 'Feb', users: 28, posts: 67, stories: 45 },
  { month: 'Mar', users: 45, posts: 89, stories: 67 },
  { month: 'Apr', users: 63, posts: 120, stories: 89 },
  { month: 'May', users: 89, posts: 145, stories: 112 },
  { month: 'Jun', users: 134, posts: 198, stories: 145 },
];

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

const AdminAnalytics: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState({ total_users: 0, total_posts: 0, total_stories: 0, pending_reports: 0, verified_users: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getActivityLogs(0), getAdminStats()]).then(([l, s]) => {
      setLogs(l);
      setStats(s);
      setLoading(false);
    });
  }, []);

  const pieData = [
    { name: 'Users', value: stats.total_users },
    { name: 'Posts', value: stats.total_posts },
    { name: 'Stories', value: stats.total_stories },
    { name: 'Verified', value: stats.verified_users },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-foreground text-balance">Analytics & Activity</h2>
          <p className="text-sm text-muted-foreground mt-1">Platform growth and engagement insights</p>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-xl p-5 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground">Monthly Growth</h3>
            </div>
            <div className="w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={mockMonthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Legend layout="horizontal" wrapperStyle={{ paddingTop: 8, fontSize: 12 }} />
                  <Bar dataKey="users" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} name="Users" />
                  <Bar dataKey="posts" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} name="Posts" />
                  <Bar dataKey="stories" fill="hsl(var(--chart-3))" radius={[3, 3, 0, 0]} name="Stories" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground">Platform Distribution</h3>
            </div>
            <div className="w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Legend layout="horizontal" wrapperStyle={{ paddingTop: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Activity logs */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">Activity Logs</h3>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No activity logs yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Actor</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Action</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Details</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.slice(0, 20).map(log => (
                    <tr key={log.id} className="border-b border-border/50 hover:bg-muted/40">
                      <td className="px-3 py-2.5 text-sm font-medium text-foreground">{log.actor?.username || 'System'}</td>
                      <td className="px-3 py-2.5 text-sm text-muted-foreground">{log.action}</td>
                      <td className="px-3 py-2.5 text-sm text-muted-foreground max-w-xs truncate">{log.details || '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminAnalytics;
