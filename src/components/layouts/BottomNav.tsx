import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Search, BookOpen, MessageCircle, User, Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const BottomNav: React.FC<{ overlay?: boolean }> = ({ overlay = false }) => {
  const location = useLocation();
  const { t } = useLanguage();
  const navItems = [
    { path: '/home', icon: Home, label: t('home') },
    { path: '/search', icon: Search, label: t('search') },
    { path: '/people', icon: Globe, label: 'लोग' },
    { path: '/stories', icon: BookOpen, label: t('stories') },
    { path: '/chat', icon: MessageCircle, label: t('chat') },
    { path: '/profile', icon: User, label: t('profile') },
  ];
  return (
    <nav
      className={cn(
        'fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 safe-bottom',
        overlay
          ? 'bg-gradient-to-t from-black/85 via-black/60 to-transparent pt-3'
          : 'bottom-nav'
      )}
    >
      <div className="flex items-center justify-around px-1 py-2">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive =
            location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
          return (
            <Link
              key={path}
              to={path}
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all relative"
            >
              <div
                className={cn(
                  'w-8 h-8 flex items-center justify-center rounded-xl transition-all',
                  isActive && 'text-primary-foreground scale-105'
                )}
                style={
                  isActive
                    ? { background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))' }
                    : {}
                }
              >
                <Icon
                  className={cn(
                    'w-4 h-4 transition-all',
                    isActive ? 'text-white' : overlay ? 'text-white/80' : 'text-muted-foreground'
                  )}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
              </div>
              <span
                className={cn(
                  'text-[9px] font-medium transition-colors',
                  isActive
                    ? overlay
                      ? 'text-white'
                      : 'text-primary'
                    : overlay
                    ? 'text-white/70'
                    : 'text-muted-foreground'
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;