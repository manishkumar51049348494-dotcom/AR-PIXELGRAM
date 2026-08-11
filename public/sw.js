/* AR Pixelgram service worker.
 *
 * IMPORTANT: earlier builds registered a service worker that cached the app
 * shell. That stale cache is why some phones kept showing an old
 * "reels loading" screen forever, even before creating an account.
 * This worker takes control immediately, deletes every old cache and never
 * caches HTML/JS itself — it only handles Web Push.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Nuke anything cached by any previous service worker version.
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// No fetch handler on purpose: every request goes straight to the network,
// so a deploy is live for users immediately.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'AR Pixelgram', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'AR Pixelgram';
  const options = {
    body: data.body || '',
    icon: data.icon || '/favicon.png',
    badge: '/favicon.png',
    tag: data.tag,
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of all) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) {
            try {
              await client.navigate(url);
            } catch {
              /* ignore */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
