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
  // PWA update flow (installed app ko same URL par hi naya build milta hai):
  //  1. har load + har baar app foreground me aane par registration.update()
  //  2. naya worker milte hi use turant activate karo (SKIP_WAITING)
  //  3. jab naya worker control le le, page ko ek hi baar reload karo
  // localStorage ko kabhi clear nahi karte, isliye login session bana rehta
  // hai — update ke baad dobara login nahi karna padta.
  let reloadingForUpdate = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadingForUpdate) return;
    reloadingForUpdate = true;
    // Auth client ko persisted session write/refresh complete karne ka ek pal
    // do; turant reload se kuch Android WebViews me session restore race hoti thi.
    window.setTimeout(() => window.location.reload(), 500);
  });

  window.addEventListener('load', () => {
    (async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');

        const promote = (worker: ServiceWorker | null) => {
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              worker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        };

        if (reg.waiting && navigator.serviceWorker.controller) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        promote(reg.installing);
        reg.addEventListener('updatefound', () => promote(reg.installing));

        const checkForUpdate = () => { reg.update().catch(() => { /* noop */ }); };
        checkForUpdate();
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkForUpdate();
        });
        // Lambi chalne wali installed app ke liye periodic check.
        setInterval(checkForUpdate, 60 * 60 * 1000);
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
