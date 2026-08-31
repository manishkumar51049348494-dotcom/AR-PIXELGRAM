import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Video, BookOpen, MessageCircle, User, Bell, Globe } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import { cn } from '@/lib/utils';

interface MobileLayoutProps {
  children: React.ReactNode;
  hideNav?: boolean;
  fullscreen?: boolean; // header + nav दोनों छिपाओ, pure black bg (reels के लिए)
}

const MobileLayout: React.FC<MobileLayoutProps> = ({ children, hideNav = false, fullscreen = false }) => {
  const location = useLocation();
  const { profile, user } = useAuth();
  const { t } = useLanguage();
  const unreadNotifications = useUnreadNotifications(user?.id);
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
    { path: '/videos', icon: Video, label: 'वीडियो' },
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
        </Link>

        <div className="flex items-center gap-1">
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

    </div>
  );
};

export default MobileLayout;
