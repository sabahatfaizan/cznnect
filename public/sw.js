// Cznnect offline shell. Never cache Supabase/API responses or authenticated data.
const CACHE_VERSION = 'cznnect-shell-v31';
const SHELL_URL = new URL('./', self.registration.scope).toString();
const OFFLINE_HTML = `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#111827"><title>Cznnect offline</title><body style="margin:0;background:#111827;color:#fff;font:16px system-ui;display:grid;min-height:100vh;place-items:center"><main style="max-width:28rem;padding:2rem"><h1>Cznnect is offline</h1><p>Reconnect to the internet and reload to use family, account and live features. Previously loaded app files may still be available.</p><button onclick="location.reload()" style="padding:.8rem 1.2rem;border-radius:1rem">Try again</button></main></body></html>`;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    // A missing optional icon/manifest must not prevent the new worker from installing.
    await Promise.allSettled([
      cache.add(SHELL_URL),
      cache.add(new URL('manifest.webmanifest', self.registration.scope).toString()),
      cache.add(new URL('icons/icon-192.png', self.registration.scope).toString()),
    ]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('cznnect-') && key !== CACHE_VERSION).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never intercept Supabase, auth callbacks, or other third-party requests.
  if (url.origin !== self.location.origin) return;
  // The app download is a plain file. Leave it to the browser so it is never mistaken for the app shell.
  if (url.pathname.endsWith('.apk')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_VERSION);
          await cache.put(SHELL_URL, response.clone());
        }
        return response;
      } catch {
        const cached = await caches.match(SHELL_URL);
        return cached || new Response(OFFLINE_HTML, {
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
          status: 503,
        });
      }
    })());
    return;
  }

  // Cache only static app assets. Do not cache JSON, POSTs, user data or API responses.
  if (!['script', 'style', 'image', 'font'].includes(request.destination)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
      return response;
    } catch {
      return new Response('', { status: 504, statusText: 'Offline asset unavailable' });
    }
  })());
});
