import { useEffect } from 'react';
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { routes } from '@/routes';

interface RouteGuardProps {
  children: React.ReactNode;
}

const SYSTEM_PUBLIC_ROUTES = ['/login', '/admin-login', '/403', '/404'];
const routePublicPaths = routes.filter(r => r.public).map(r => r.path);
const PUBLIC_ROUTES = [...SYSTEM_PUBLIC_ROUTES, ...routePublicPaths];

// Routes accessible even when account is suspended/locked/disabled
const APPEAL_ALLOWED = ['/appeal', '/login', '/admin-login', '/account-deleted'];

function matchPublicRoute(path: string, patterns: string[]) {
  return patterns.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
      return regex.test(path);
    }
    return path === pattern;
  });
}

export function RouteGuard({ children }: RouteGuardProps) {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [timedOut, setTimedOut] = React.useState(false);

  // Max 2s loading timeout — never hang forever
  React.useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setTimedOut(true), 2000);
    return () => clearTimeout(t);
  }, [loading]);

  const isReady = !loading || timedOut;
  const isPublic = matchPublicRoute(location.pathname, PUBLIC_ROUTES);

  useEffect(() => {
    if (!isReady) return;

    const isAppealRoute = APPEAL_ALLOWED.some(p => location.pathname.startsWith(p));

    if (!user && !isPublic) {
      // Admin routes redirect to admin-login, all others to login
      if (location.pathname.startsWith('/admin')) {
        navigate('/admin-login', { replace: true });
      } else {
        navigate('/login', { state: { from: location.pathname }, replace: true });
      }
      return;
    }

    // Logged-in user on landing page → send to home feed
    if (user && location.pathname === '/') {
      navigate('/home', { replace: true });
      return;
    }

    // Redirect suspended/locked/disabled accounts appropriately
    if (user && profile && profile.account_status && profile.account_status !== 'active' && !isAppealRoute) {
      if (profile.account_status === 'permanently_disabled') {
        navigate('/account-deleted', { replace: true });
      } else {
        navigate('/appeal', { replace: true });
      }
    }
  }, [user, profile, isReady, location.pathname, navigate, isPublic]);

  // While auth is loading AND on a protected route → show neutral splash, not page content
  // This prevents unauthenticated users from seeing reels/home loading screen
  // Also never render protected content when there is no signed-in user:
  // the redirect below runs in an effect (one paint later), which is what let
  // unauthenticated visitors briefly land on the reels feed and get stuck on
  // its loading screen.
  if (!isPublic && (!isReady || !user)) {
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-primary/30 shadow-lg bg-white">
            <img
              src="https://miaoda-conversation-file.s3cdn.medo.dev/user-cjml2dkttc74/app-cjmldrzgvw1t/20260709/IMG_20260625_173359_866.jpg"
              alt="AR Pixelgram"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}