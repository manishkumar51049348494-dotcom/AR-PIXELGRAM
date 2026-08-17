import React, { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

/**
 * "Install app" button — website khulte hi header me dikhta hai. Tap karte hi
 * Android/Chrome ka native install prompt aa jata hai; iPhone (Safari) par
 * install prompt support nahi hai isliye chhota sa guide dikha dete hain.
 * App install ho chuki ho to button apne aap chhup jata hai.
 */
const InstallAppButton: React.FC<{ className?: string; label?: string }> = ({ className, label = 'Install app' }) => {
  const [canInstall, setCanInstall] = useState(!!deferredPrompt);
  const [iosHelp, setIosHelp] = useState(false);

  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true);

  const isIos =
    typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

  // Signed APK jo repo ke public/ folder se serve hota hai.
  const APK_URL = '/AR-Pixelgram.apk';

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    const onInstalled = () => {
      deferredPrompt = null;
      setCanInstall(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (isStandalone && !isAndroid) return null;

  const handleClick = async () => {
    if (isAndroid) {
      // Android par seedha real signed APK download hota hai.
      const a = document.createElement('a');
      a.href = APK_URL;
      a.download = 'AR-Pixelgram.apk';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        deferredPrompt = null;
        setCanInstall(false);
      }
      return;
    }
    setIosHelp(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={cn(
          'flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-bold text-white shadow-sm active:scale-95 transition-all',
          className,
        )}
        style={{ background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))' }}
      >
        <Download className="w-4 h-4" />
        {isAndroid ? 'Download APK' : label}
      </button>

      {iosHelp && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIosHelp(false)} />
          <div className="relative w-full max-w-lg bg-card rounded-t-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-bold text-foreground">App install karein</p>
              <button onClick={() => setIosHelp(false)} className="p-1 rounded-lg hover:bg-muted">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              Safari me niche <Share className="w-4 h-4" /> Share button dabayein, phir
              <b className="text-foreground"> “Add to Home Screen”</b> chunein.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default InstallAppButton;
