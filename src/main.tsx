import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import "./index.css";

Sentry.init({
  dsn: import.meta.env['VITE_SENTRY_DSN'] as string | undefined,
  environment: import.meta.env.MODE,
});

// Register the service worker as early as possible, unconditionally. This is
// what makes the browser treat the site as an installable PWA (together with
// /manifest.json) — on Android that produces a real WebAPK with its own
// "Notifications" toggle in phone Settings → Apps. Without an active SW
// registration here, the OS has nothing to attach a per-app permission to.
//
// Recovery note: an older deploy shipped a caching service worker while
// /sw.js was missing (404), so phones stayed stuck on a stale cached build
// (the endless "reels loading" screen). We now always purge caches, force the
// new worker to activate, and reload once so the fresh app takes over.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    (async () => {
      try {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        const hadOldWorker = !!navigator.serviceWorker.controller;
        const reg = await navigator.serviceWorker.register('/sw.js');
        await reg.update().catch(() => { /* noop */ });

        if (hadOldWorker && !sessionStorage.getItem('sw-refreshed')) {
          sessionStorage.setItem('sw-refreshed', '1');
          window.location.reload();
        }
      } catch {
        /* noop */
      }
    })();
  });
}


createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={<p>应用发生错误，请刷新页面重试</p>}>
    <AppWrapper>
      <App />
    </AppWrapper>
  </Sentry.ErrorBoundary>
);
