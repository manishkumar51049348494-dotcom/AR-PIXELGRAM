import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, BookOpen, MessageCircle, User, Bell, Plus, Globe } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSelector from '@/components/common/LanguageSelector';
import InstallAppButton from '@/components/common/InstallAppButton';
import { cn } from '@/lib/utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

interface MobileLayoutProps {
  children: React.ReactNode;
  hideNav?: boolean;
  fullscreen?: boolean; // header + nav दोनों छिपाओ, pure black bg (reels के लिए)
}

const MobileLayout: React.FC<MobileLayoutProps> = ({ children, hideNav = false, fullscreen = false }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { t } = useLanguage();

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
    { path: '/search', icon: Search, label: t('search') },
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
          {/* Install app (PWA) */}
          <InstallAppButton label="Install" />

          {/* Language selector */}
          <LanguageSelector compact />

          {/* Create button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-9 h-9 rounded-full flex items-center justify-center text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-95"
                style={{ background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))' }}>
                <Plus className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => navigate('/create')} className="gap-2">
                <span>📷</span> {t('newPost')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/create-reel')} className="gap-2">
                <span>🎬</span> {t('newReel')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notifications */}
          <Link to="/notifications" className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors">
            <Bell className="w-5 h-5 text-foreground" />
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
