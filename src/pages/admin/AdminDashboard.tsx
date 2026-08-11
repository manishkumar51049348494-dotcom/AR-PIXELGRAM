import React, { useEffect, useState } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { getAdminStats, getBroadcasts } from '@/services/api';
import { Users, FileImage, BookOpen, Flag, ShieldCheck, MessageSquare, TrendingUp, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

const mockGrowthData = [
  { month: 'Jan', users: 12, posts: 34 },
  { month: 'Feb', users: 28, posts: 67 },
  { month: 'Mar', users: 45, posts: 89 },
  { month: 'Apr', users: 63, posts: 120 },
  { month: 'May', users: 89, posts: 145 },
  { month: 'Jun', users: 134, posts: 198 },
];

const mockEngagement = [
  { day: 'Mon', likes: 45, comments: 12 },
  { day: 'Tue', likes: 67, comments: 23 },
  { day: 'Wed', likes: 89, comments: 34 },
  { day: 'Thu', likes: 56, comments: 18 },
  { day: 'Fri', likes: 112, comments: 45 },
  { day: 'Sat', likes: 134, comments: 56 },
  { day: 'Sun', likes: 98, comments: 41 },
];

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState({ total_users: 0, total_posts: 0, total_stories: 0, pending_reports: 0, verified_users: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminStats().then(s => { setStats(s); setLoading(false); });
  }, []);

  const statCards = [
    { label: 'Total Users', value: stats.total_users, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Total Posts', value: stats.total_posts, icon: FileImage, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'Total Stories', value: stats.total_stories, icon: BookOpen, color: 'text-pink-500', bg: 'bg-pink-500/10' },
    { label: 'Pending Reports', value: stats.pending_reports, icon: Flag, color: 'text-red-500', bg: 'bg-red-500/10' },
    { label: 'Verified Users', value: stats.verified_users, icon: ShieldCheck, color: 'text-green-500', bg: 'bg-green-500/10' },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground text-balance">Dashboard Overview</h2>
          <p className="text-muted-foreground text-sm mt-1">Welcome to AR Pixelgram Admin Panel</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {statCards.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4 h-full flex flex-col shadow-card">
              <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center mb-3 shrink-0`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <p className="text-2xl font-bold text-foreground">{loading ? '…' : value.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1 text-pretty">{label}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Growth chart */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground">User & Post Growth</h3>
            </div>
            <div className="w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={mockGrowthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Legend layout="horizontal" wrapperStyle={{ paddingTop: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="users" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Users" />
                  <Line type="monotone" dataKey="posts" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} name="Posts" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Engagement chart */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground">Weekly Engagement</h3>
            </div>
            <div className="w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={mockEngagement}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Legend layout="horizontal" wrapperStyle={{ paddingTop: 8, fontSize: 12 }} />
                  <Bar dataKey="likes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Likes" />
                  <Bar dataKey="comments" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="Comments" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent activity placeholder */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">Quick Actions</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Review Reports', path: '/admin/reports', color: 'bg-red-500/10 text-red-600 dark:text-red-400' },
              { label: 'Verify Requests', path: '/admin/verification', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
              { label: 'Manage Users', path: '/admin/users', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
              { label: 'Broadcast', path: '/admin/broadcast', color: 'bg-green-500/10 text-green-600 dark:text-green-400' },
            ].map(({ label, path, color }) => (
              <a key={label} href={path} className={`flex items-center justify-center py-3 px-4 rounded-xl font-medium text-sm transition-opacity hover:opacity-80 ${color}`}>
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
