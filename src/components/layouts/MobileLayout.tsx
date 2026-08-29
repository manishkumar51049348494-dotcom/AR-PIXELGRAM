import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Video, BookOpen, MessageCircle, User, Bell, Plus, Globe, ImagePlus, Clapperboard, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSelector from '@/components/common/LanguageSelector';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import { cn } from '@/lib/utils';

interface MobileLayoutProps {
  children: React.ReactNode;
  hideNav?: boolean;
  fullscreen?: boolean; // header + nav दोनों छिपाओ, pure black bg (reels के लिए)
}

const MobileLayout: React.FC<MobileLayoutProps> = ({ children, hideNav = false, fullscreen = false }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { t } = useLanguage();
  const unreadNotifications = useUnreadNotifications(user?.id);
  const [createOpen, setCreateOpen] = React.useState(false);

  const createOptions = [
    {
      path: '/create',
      icon: ImagePlus,
      title: t('newPost'),
      desc: 'Photo ya video post share karein',
    },
    {
      path: '/create-reel',
      icon: Clapperboard,
      title: t('newReel'),
      desc: 'Music aur cover ke saath reel banayein',
    },
  ];

  // fullscreen mode — reels की तरह pure black, no header, no nav
  if (fullscreen) {
    return (
      <div className="fixed inset-0 w-full bg-black overflow-hidden">
        {children}
      </div>
    );
  }

  const navItems = [
    { path: '/home', icon: Home, label: t('home') },
    { path: '/search', icon: Video, label: 'वीडियो' },
    { path: '/people', icon: Globe, label: 'लोग' },
    { path: '/stories', icon: BookOpen, label: t('stories') },
    { path: '/chat', icon: MessageCircle, label: t('chat') },
    { path: '/profile', icon: User, label: t('profile') },
  ];

  return (
    <div className="flex flex-col min-h-screen w-full max-w-lg mx-auto bg-background">
      {/* Premium Top Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 glass-card border-b border-border/40">
        {/* Logo with animated rainbow */}
        <Link to="/home" className="flex items-center gap-2">
          <span className="text-xl font-black rainbow-text tracking-tight">AR Pixelgram</span>
          {profile?.is_verified && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-primary-foreground glow-badge"
              style={{ background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))' }}>
              ✓
            </span>
          )}
        </Link>

        <div className="flex items-center gap-1">
          {/* Language selector */}
          <LanguageSelector compact />

          {/* Create button — Instagram-style bottom sheet */}
          <button
            onClick={() => setCreateOpen(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))' }}
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Notifications */}
          <Link to="/notifications" className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors">
            <Bell className="w-5 h-5 text-foreground" />
            {unreadNotifications > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex min-w-4 h-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground ring-2 ring-background">
                {unreadNotifications > 99 ? '99+' : unreadNotifications}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className={cn('flex-1 overflow-y-auto', !hideNav && 'pb-nav')}>
        {children}
      </main>

      {/* Premium Bottom Navigation */}
      {!hideNav && (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 bottom-nav safe-bottom">
          <div className="flex items-center justify-around px-1 py-2">
            {navItems.map(({ path, icon: Icon, label }) => {
              const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
              return (
                <Link
                  key={path}
                  to={path}
                  className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all relative"
                >
                  <div className={cn(
                    'w-8 h-8 flex items-center justify-center rounded-xl transition-all',
                    isActive && 'text-primary-foreground scale-105'
                  )}
                    style={isActive ? { background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))' } : {}}
                  >
                    <Icon
                      className={cn('w-4 h-4 transition-all', isActive ? 'text-white' : 'text-muted-foreground')}
                      strokeWidth={isActive ? 2.5 : 1.8}
                    />
                  </div>
                  <span className={cn('text-[9px] font-medium transition-colors', isActive ? 'text-primary' : 'text-muted-foreground')}>
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      {/* Premium create sheet (Instagram jaisa) */}
      {createOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={() => setCreateOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg rounded-t-3xl bg-background border-t border-border/50 px-5 pt-3 pb-8 safe-bottom shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" />
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">Create</h2>
              <button onClick={() => setCreateOpen(false)} className="p-1.5 rounded-full hover:bg-muted/60">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-2">
              {createOptions.map(({ path, icon: Icon, title, desc }) => (
                <button
                  key={path}
                  onClick={() => { setCreateOpen(false); navigate(path); }}
                  className="w-full flex items-center gap-4 rounded-2xl border border-border/40 bg-card px-4 py-3.5 text-left transition-all active:scale-[0.98] hover:border-primary/40"
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-primary-foreground shrink-0"
                    style={{ background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))' }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">{title}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Plus className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileLayout;
