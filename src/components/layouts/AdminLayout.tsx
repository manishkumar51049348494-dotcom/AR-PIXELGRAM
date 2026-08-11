import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileImage, ShieldCheck, Flag,
  Megaphone, BarChart3, Globe2, LogOut, Menu, X, ChevronRight, Loader2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const adminNavItems = [
  { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/admin/users', icon: Users, label: 'User Management' },
  { path: '/admin/content', icon: FileImage, label: 'Content Moderation' },
  { path: '/admin/verification', icon: ShieldCheck, label: 'Verification Requests' },
  { path: '/admin/reports', icon: Flag, label: 'Reports' },
  { path: '/admin/broadcast', icon: Megaphone, label: 'Broadcast' },
  { path: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/admin/visitors', icon: Globe2, label: 'Visitors & Devices' },
];

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, loading, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Guard: only admin users — wait for loading to finish first
  useEffect(() => {
    if (loading) return;
    if (!profile) {
      navigate('/admin-login', { replace: true });
      return;
    }
    if (!profile.is_admin) {
      navigate('/', { replace: true });
    }
  }, [profile, loading, navigate]);

// Show loading spinner max 2s in AdminLayout too
  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Block render if not admin (redirect fires via useEffect)
  if (!profile.is_admin) return null;

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-sidebar flex flex-col border-r border-sidebar-border transition-transform duration-200 lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          <div>
            <p className="font-bold text-sidebar-foreground gradient-text text-lg">AR Pixelgram</p>
            <p className="text-xs text-muted-foreground">Admin Panel</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-sidebar-foreground"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Admin info */}
        <div className="px-4 py-3 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-primary font-bold text-sm">{profile?.username?.[0]?.toUpperCase()}</span>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-sidebar-foreground truncate">{profile?.username}</p>
              <p className="text-xs text-muted-foreground">Administrator</p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {adminNavItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 min-w-0 truncate">{label}</span>
                {isActive && <ChevronRight className="w-3 h-3 shrink-0" />}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-all w-full"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 px-4 md:px-6 py-3 bg-card border-b border-border">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden shrink-0"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <h1 className="text-base md:text-lg font-semibold text-foreground flex-1 min-w-0 truncate">
            {adminNavItems.find(i => i.path === location.pathname)?.label || 'Admin Panel'}
          </h1>
          <Link
            to="/"
            className="text-xs text-muted-foreground hover:text-primary transition-colors shrink-0"
          >
            ← User View
          </Link>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
