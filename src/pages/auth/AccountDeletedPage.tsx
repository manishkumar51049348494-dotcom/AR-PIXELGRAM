import React, { useState } from 'react';
import { supabase } from '@/db/supabase';

// async/await — ensures signOut finishes before hard navigation
const doSignOut = async (dest: string) => {
  try { await supabase.auth.signOut(); } catch { /* ignore */ }
  window.location.href = dest;
};

const AccountDeletedPage: React.FC = () => {
  const [loading, setLoading] = useState<string | null>(null);

  const handleLogin = () => {
    setLoading('login');
    doSignOut('/login');
  };

  const handleRegister = () => {
    setLoading('register');
    doSignOut('/register');
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background px-6">
      {/* App logo */}
      <div className="mb-8 text-center">
        <h1
          className="text-4xl font-black tracking-tight mb-1"
          style={{
            background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          AR Pixelgram
        </h1>
        <p className="text-xs text-muted-foreground tracking-widest uppercase">Social Media</p>
      </div>

      {/* Icon */}
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
          strokeLinejoin="round" className="text-muted-foreground">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>

      <h2 className="text-xl font-bold text-foreground mb-2 text-center">
        यह account हटा दिया गया है
      </h2>
      <p className="text-sm text-muted-foreground text-center max-w-xs mb-10 text-pretty">
        यह account permanently disable कर दिया गया है। आप दूसरे account से login कर सकते हैं
        या नया account बना सकते हैं।
      </p>

      {/* CTA buttons */}
      <div className="w-full max-w-xs flex flex-col gap-3">
        <button
          type="button"
          disabled={!!loading}
          onClick={handleLogin}
          className="w-full h-12 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 active:opacity-80 transition-opacity disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)' }}
        >
          {loading === 'login' ? (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
          )}
          दूसरे account से Login करें
        </button>

        <button
          type="button"
          disabled={!!loading}
          onClick={handleRegister}
          className="w-full h-12 rounded-xl font-bold text-sm text-foreground border-2 border-border bg-background flex items-center justify-center gap-2 active:opacity-80 transition-opacity disabled:opacity-60"
        >
          {loading === 'register' ? (
            <svg className="w-4 h-4 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
          )}
          नया account बनाएं
        </button>
      </div>

      {/* Brand footer */}
      <p className="absolute bottom-8 text-xs text-muted-foreground">AR Pixelgram &copy; {new Date().getFullYear()}</p>
    </div>
  );
};

export default AccountDeletedPage;
