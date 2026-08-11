import { useEffect } from 'react';
import React from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
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

  // Max 1.5s loading timeout — never hang forever
  React.useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setTimedOut(true), 1500);
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

  // No spinner/splash screen anywhere. On a protected route we either wait
  // one silent frame for the session check (blank backdrop, hard capped by the
  // timeout above) or send the visitor straight to login — so a first-time
  // visitor without an account can never land on (and get stuck in) the reels
  // or home feed loading screen.
  if (!isPublic && !isReady) {
    return <div className="h-[100dvh] w-full bg-background" />;
  }

  if (!isPublic && !user) {
    return location.pathname.startsWith('/admin')
      ? <Navigate to="/admin-login" replace />
      : <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}