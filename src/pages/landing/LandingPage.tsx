import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, MessageCircle, Film, Sparkles, Camera } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import InstallAppButton from '@/components/common/InstallAppButton';

const TECH_TRICKS_LOGO = 'https://miaoda-conversation-file.s3cdn.medo.dev/user-cjml2dkttc74/app-cjmldrzgvw1t/20260709/IMG_20260625_173359_866.jpg';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // लॉगिन हो तो तुरंत home पर — 2s wait नहीं
  useEffect(() => {
    if (user) navigate('/home', { replace: true });
  }, [user, navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Hero Section */}
      <div
        className="relative flex-1 flex flex-col items-center justify-center px-6 py-16 overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, hsl(var(--p1)) 0%, hsl(var(--p2)) 50%, hsl(var(--p3,var(--p2))) 100%)',
        }}
      >
        {/* Decorative blobs */}
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />

        {/* Logo — TechTricks circular dp */}
        <div className="relative z-10 flex flex-col items-center gap-4 mb-10">
          <div className="w-24 h-24 rounded-full overflow-hidden shadow-2xl border-4 border-white/40 bg-white">
            <img
              src={TECH_TRICKS_LOGO}
              alt="AR Pixelgram"
              className="w-full h-full object-cover"
              onError={e => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
                (e.currentTarget.parentElement as HTMLElement).classList.add('flex','items-center','justify-center');
              }}
            />
          </div>
          <div className="text-center">
            <h1 className="text-4xl font-black text-white tracking-tight drop-shadow-lg">
              AR Pixelgram
            </h1>
            <p className="text-white/80 text-sm mt-1 font-medium">
              अपनी दुनिया शेयर करें
            </p>
          </div>
        </div>

        {/* Feature pills */}
        <div className="relative z-10 flex flex-wrap justify-center gap-2 mb-12 max-w-xs">
          {[
            { icon: Camera, label: 'फ़ोटो पोस्ट' },
            { icon: Film, label: 'रील्स' },
            { icon: Users, label: 'फ़ॉलोअर्स' },
            { icon: MessageCircle, label: 'चैट' },
            { icon: Sparkles, label: 'स्टोरीज़' },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/20"
            >
              <Icon className="w-3.5 h-3.5 text-white" />
              <span className="text-white text-xs font-medium">{label}</span>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="relative z-10 w-full max-w-xs flex flex-col gap-3">
          <button
            onClick={() => navigate('/register')}
            className="w-full py-3.5 rounded-2xl bg-white font-bold text-base shadow-lg active:scale-95 transition-transform"
            style={{ color: 'hsl(var(--p1))' }}
          >
            नया अकाउंट बनाएं
          </button>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3.5 rounded-2xl border-2 border-white/60 bg-white/10 backdrop-blur-sm font-semibold text-base text-white active:scale-95 transition-transform"
          >
            लॉगिन करें
          </button>

          {/* App install (PWA) */}
          <div className="flex justify-center pt-1">
            <InstallAppButton label="App install करें" className="h-11 px-5 text-sm" />
          </div>
        </div>
      </div>

      {/* Bottom info strip */}
      <div className="bg-card border-t border-border px-6 py-5 text-center space-y-1">
        <p className="text-xs text-muted-foreground">
          AR Pixelgram पर join करके आप हमारी{' '}
          <span className="text-primary font-medium cursor-pointer">Privacy Policy</span>{' '}
          और{' '}
          <span className="text-primary font-medium cursor-pointer">Terms</span>{' '}
          से सहमत हैं।
        </p>
      </div>
    </div>
  );
};

export default LandingPage;
